import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { Prisma, type PrismaClient } from '@prisma/client'
import { rateLimit } from '../lib/security.js'
import { balanceOf, LedgerError, writeEntryInTransaction } from '../lib/ledger.js'

const codeSchema = z.string().regex(/^fc1_[A-Za-z0-9_-]{32}$/, 'Présente le QR temporaire de la carte Fidelity.')
const referenceSchema = z.string().min(8).max(120).regex(/^[a-zA-Z0-9_-]+$/, 'Référence invalide.')
const base = { code: codeSchema, restaurantId: z.string().min(1).max(40), idempotencyKey: referenceSchema }
const earnSchema = z.object({ ...base, delta: z.number().int().min(1).max(1000), note: z.string().trim().max(200).optional() }).strict()
const redeemSchema = z.object({ ...base, note: z.string().trim().max(200).optional() }).strict()
const adjustSchema = z.object({ ...base, delta: z.number().int().min(-1000).max(1000).refine(v => v !== 0), note: z.string().trim().min(3).max(300) }).strict()

export function ledgerRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const scanRateLimit = rateLimit(120, 60_000, req => req.userId || req.ip)
  async function resolve(tx: Prisma.TransactionClient | PrismaClient, req: FastifyRequest, code: string, restaurantId?: string) {
    const presentation = await tx.cardPresentation.findUnique({ where: { id: code }, include: {
      membership: { include: {
        user: { select: { displayName: true, pseudo: true, avatarUrl: true } },
        restaurant: { include: { program: true } },
      } },
    } })
    if (!presentation) throw new LedgerError(404, 'QR inconnu. Demande au client d’ouvrir sa carte Fidelity.')
    const { membership } = presentation
    if (membership.restaurant.ownerId !== req.userId && req.userRole !== 'ADMIN') throw new LedgerError(403, 'Cette carte n’appartient pas à ton restaurant.')
    if (restaurantId && membership.restaurantId !== restaurantId) throw new LedgerError(409, 'Cette carte concerne un autre établissement. Sélectionne le bon restaurant.')
    if (membership.restaurant.status !== 'VERIFIED' || !membership.restaurant.program?.active) throw new LedgerError(409, 'Ce programme de fidélité est actuellement indisponible.')
    if (membership.userId === req.userId) throw new LedgerError(403, 'Tu ne peux pas créditer ou utiliser ta propre carte de fidélité.')
    return presentation
  }
  app.get('/scan/:code', { preHandler: [app.authenticate, scanRateLimit] }, async (req, reply) => {
    try {
      const { code } = z.object({ code: codeSchema }).parse(req.params)
      const { restaurantId } = z.object({ restaurantId: z.string().max(40).optional() }).parse(req.query)
      const presentation = await resolve(prisma, req, code, restaurantId)
      if (presentation.consumedAt || presentation.expiresAt <= new Date()) throw new LedgerError(409, 'Ce QR a expiré ou a déjà été utilisé. Demande un nouveau QR au client.')
      const { membership } = presentation
      return {
        membershipId: membership.id, member: membership.user,
        restaurant: { id: membership.restaurantId, name: membership.restaurant.name },
        program: membership.restaurant.program, balance: await balanceOf(prisma, membership.id), expiresAt: presentation.expiresAt,
      }
    } catch (error) { return handleLedgerError(reply, error) }
  })
  for (const operation of ['earn', 'redeem', 'adjust'] as const) {
    app.post(`/ledger/${operation}`, { preHandler: [app.authenticate, scanRateLimit] }, async (req, reply) => {
      const body = (operation === 'earn' ? earnSchema : operation === 'redeem' ? redeemSchema : adjustSchema).parse(req.body)
      try {
        const entry = await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT "id" FROM "Restaurant" WHERE "id" = ${body.restaurantId} FOR SHARE`
          await tx.$queryRaw`SELECT "id" FROM "LoyaltyProgram" WHERE "restaurantId" = ${body.restaurantId} FOR SHARE`
          const presentation = await resolve(tx, req, body.code, body.restaurantId)
          const program = presentation.membership.restaurant.program!
          const delta = operation === 'redeem' ? -program.target : ('delta' in body && typeof body.delta === 'number' ? body.delta : 0)
          const limit = program.type === 'STAMPS' ? 10 : 1000
          if (operation !== 'redeem' && Math.abs(delta) > limit) throw new LedgerError(400, `Maximum ${limit} ${program.type === 'STAMPS' ? 'coches' : 'points'} par opération.`)
          return writeEntryInTransaction(tx, {
            membershipId: presentation.membershipId, presentationId: presentation.id, delta,
            kind: operation === 'earn' ? 'EARN' : operation === 'redeem' ? 'REDEEM' : delta > 0 ? 'ADJUST' : 'REFUND',
            source: operation === 'adjust' ? 'admin' : 'scan', idempotencyKey: body.idempotencyKey, authorId: req.userId, note: body.note,
          })
        }, { maxWait: 5_000, timeout: 10_000 })
        return reply.code('idempotentReplay' in entry ? 200 : 201).send(entry)
      } catch (error) { return handleLedgerError(reply, error) }
    })
  }
}
export function handleLedgerError(reply: FastifyReply, error: unknown) {
  if (error instanceof LedgerError) return reply.code(error.statusCode).send({ error: error.message })
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return reply.code(409).send({ error: 'Cette référence a déjà été utilisée. Vérifie l’historique avant de recommencer.' })
  throw error
}
