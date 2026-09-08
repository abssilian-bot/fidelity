import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { randomCode, signToken, verifyToken } from '../lib/tokens.js'
import { rateLimit } from '../lib/security.js'
import { balanceOf, LedgerError, lockMembership } from '../lib/ledger.js'
import { lockWalletVersions } from '../lib/wallet-updates.js'
import { hashDevice, matchesPassToken, renderWalletPass, walletConfig } from '../lib/wallet.js'
import { handleLedgerError } from './ledger.js'

const idSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)
const deviceSchema = z.string().min(16).max(200).regex(/^[a-zA-Z0-9_-]+$/)
const walletCodeSchema = z.string().regex(/^fw1_[A-Za-z0-9_-]{32}$/)

export function walletRoutes(app: FastifyInstance, prisma: PrismaClient, getConfig = walletConfig, render = renderWalletPass) {
  const limited = rateLimit(60, 60_000, req => req.userId || req.ip)
  const configOrFail = () => { const config = getConfig(); if (!config) throw new LedgerError(503, 'L’ajout à Apple Wallet n’est pas encore activé. Ta carte reste accessible dans Fidelity.'); return config }
  app.get('/wallet/status', async () => ({ enabled: !!getConfig() }))
  app.post('/memberships/:id/wallet', { preHandler: [app.authenticate, limited] }, async (req, reply) => {
    try {
      const { id } = z.object({ id: idSchema }).parse(req.params)
      const config = configOrFail()
      const wallet = await prisma.$transaction(async tx => {
        await lockMembership(tx, id)
        const membership = await tx.membership.findFirst({ where: { id, userId: req.userId }, include: { restaurant: { include: { program: true } } } })
        if (!membership) throw new LedgerError(404, 'Carte introuvable.')
        if (membership.restaurant.status !== 'VERIFIED' || !membership.restaurant.program?.active) throw new LedgerError(409, 'Programme indisponible.')
        await lockWalletVersions(tx)
        return tx.walletPass.upsert({ where: { membershipId: id }, update: {}, create: { membershipId: id, authenticationToken: randomCode(32), barcode: `fw1_${randomCode(24)}` } })
      })
      const token = signToken({ scope: 'wallet-download', passId: wallet.id, userId: req.userId }, 60)
      return { url: `${config.webServiceURL}/download?token=${encodeURIComponent(token)}` }
    } catch (error) { return handleLedgerError(reply, error) }
  })
  app.get('/wallet/download', { preHandler: limited }, async (req, reply) => {
    try {
      const { token } = z.object({ token: z.string().max(2000) }).parse(req.query)
      const payload = verifyToken<{ scope: string; passId: string; userId: string }>(token)
      if (!payload || payload.scope !== 'wallet-download' || !idSchema.safeParse(payload.passId).success || !idSchema.safeParse(payload.userId).success) return reply.code(401).send({ error: 'Ce lien de téléchargement a expiré. Réessaie depuis ta carte.' })
      const wallet = await prisma.walletPass.findFirst({ where: { id: payload.passId, membership: { userId: payload.userId } } })
      if (!wallet) return reply.code(404).send({ error: 'Carte introuvable.' })
      return reply.type('application/vnd.apple.pkpass').header('Content-Disposition', 'attachment; filename="Fidelity.pkpass"').send(await render(prisma, wallet, configOrFail()))
    } catch (error) { return handleLedgerError(reply, error) }
  })
  app.post('/wallet/scan', { preHandler: [app.authenticate, limited] }, async (req, reply) => {
    try {
      const { code, restaurantId } = z.object({ code: walletCodeSchema, restaurantId: idSchema }).strict().parse(req.body)
      const wallet = await prisma.walletPass.findUnique({ where: { barcode: code }, include: { membership: { include: {
        restaurant: { include: { program: true } }, user: { select: { displayName: true, pseudo: true } },
      } } } })
      if (!wallet) throw new LedgerError(404, 'Carte Wallet introuvable.')
      const card = wallet.membership
      if (card.restaurant.ownerId !== req.userId && req.userRole !== 'ADMIN') throw new LedgerError(403, 'Cette carte n’appartient pas à ton restaurant.')
      if (card.restaurantId !== restaurantId) throw new LedgerError(409, 'Sélectionne le restaurant de cette carte.')
      if (card.userId === req.userId) throw new LedgerError(403, 'Tu ne peux pas créditer ta propre carte.')
      if (card.restaurant.status !== 'VERIFIED' || !card.restaurant.program?.active) throw new LedgerError(409, 'Programme indisponible.')
      const presentation = await prisma.cardPresentation.create({ data: { id: `fc1_${randomCode(24)}`, membershipId: card.id, expiresAt: new Date(Date.now() + 120_000), source: 'wallet', operatorId: req.userId } })
      return { membershipId: card.id, code: presentation.id, expiresAt: presentation.expiresAt, earnOnly: true,
        member: card.user, restaurant: { id: card.restaurantId, name: card.restaurant.name }, program: card.restaurant.program, balance: await balanceOf(prisma, card.id) }
    } catch (error) { return handleLedgerError(reply, error) }
  })

  const passParams = z.object({ passTypeIdentifier: z.string().max(160), serialNumber: idSchema })
  async function authorize(req: FastifyRequest) {
    const params = passParams.parse(req.params)
    const config = configOrFail()
    const wallet = params.passTypeIdentifier === config.passTypeIdentifier ? await prisma.walletPass.findUnique({ where: { id: params.serialNumber } }) : null
    if (!wallet || !matchesPassToken(req.headers.authorization, wallet.authenticationToken)) throw new LedgerError(401, 'Accès à la carte refusé.')
    return { wallet, config }
  }
  const registrationPath = '/wallet/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber'
  for (const method of ['POST', 'DELETE'] as const) app.route({ method, url: registrationPath, preHandler: limited, handler: async (req, reply) => {
    try {
      const { wallet } = await authorize(req)
      const { deviceLibraryIdentifier } = z.object({ deviceLibraryIdentifier: deviceSchema }).parse(req.params)
      const deviceHash = hashDevice(deviceLibraryIdentifier)
      if (method === 'DELETE') {
        await prisma.walletRegistration.deleteMany({ where: { passId: wallet.id, deviceHash } })
        return reply.code(200).send()
      }
      const { pushToken } = z.object({ pushToken: z.string().min(32).max(200).regex(/^[a-fA-F0-9]+$/) }).parse(req.body)
      const created = await prisma.$transaction(async tx => {
        await lockWalletVersions(tx)
        const existing = await tx.walletRegistration.findUnique({ where: { passId_deviceHash: { passId: wallet.id, deviceHash } } })
        await tx.walletRegistration.updateMany({ where: { deviceHash }, data: { pushToken } })
        await tx.walletRegistration.upsert({ where: { passId_deviceHash: { passId: wallet.id, deviceHash } }, update: { pushToken }, create: { passId: wallet.id, deviceHash, pushToken } })
        // Réveille aussi un appareil inscrit après un crédit survenu pendant l'installation.
        await tx.walletPass.update({ where: { id: wallet.id }, data: { pushedVersion: 0, nextPushAt: new Date(), pushFailures: 0 } })
        return !existing
      })
      return reply.code(created ? 201 : 200).send()
    } catch (error) { return handleLedgerError(reply, error) }
  } })
  app.get('/wallet/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier', { preHandler: limited }, async (req, reply) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier } = z.object({ deviceLibraryIdentifier: deviceSchema, passTypeIdentifier: z.string().max(160) }).parse(req.params)
      const { passesUpdatedSince } = z.object({ passesUpdatedSince: z.string().regex(/^\d{1,18}$/).optional() }).parse(req.query)
      if (passTypeIdentifier !== configOrFail().passTypeIdentifier) return reply.code(204).send()
      const registered = await prisma.walletPass.findMany({ where: { registrations: { some: { deviceHash: hashDevice(deviceLibraryIdentifier) } }, ...(passesUpdatedSince ? { version: { gt: BigInt(passesUpdatedSince) } } : {}) }, select: { id: true, version: true } })
      if (!registered.length) return reply.code(204).send()
      const latest = registered.reduce((max, pass) => pass.version > max ? pass.version : max, 0n)
      return { serialNumbers: registered.map(pass => pass.id), lastUpdated: latest.toString() }
    } catch (error) { return handleLedgerError(reply, error) }
  })
  app.get('/wallet/v1/passes/:passTypeIdentifier/:serialNumber', { preHandler: limited }, async (req, reply) => {
    try {
      const { wallet, config } = await authorize(req)
      const etag = `"${wallet.version}"`
      reply.header('Last-Modified', wallet.updatedAt.toUTCString()).header('ETag', etag)
      // Comparaison stricte : deux crédits dans la même seconde ne doivent pas
      // être perdus à cause de la précision des dates HTTP.
      if (req.headers['if-none-match'] === etag || (!req.headers['if-none-match'] && req.headers['if-modified-since'] && wallet.updatedAt.getTime() < Date.parse(req.headers['if-modified-since']))) return reply.code(304).send()
      return reply.type('application/vnd.apple.pkpass').send(await render(prisma, wallet, config))
    } catch (error) { return handleLedgerError(reply, error) }
  })
  app.post('/wallet/v1/log', { preHandler: limited }, async (req, reply: FastifyReply) => {
    z.object({ logs: z.array(z.string().max(2000)).max(20) }).parse(req.body)
    // Les messages iOS peuvent contenir des secrets : seul le nombre est utile.
    req.log.info('Diagnostic Wallet reçu')
    return reply.code(200).send()
  })
}
