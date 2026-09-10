import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomCode, signToken, verifyToken } from '../lib/tokens.js'
import { rateLimit } from '../lib/security.js'
import type { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { PrivateResend } from '../lib/private-resend.js'
import { loginEmail } from '../lib/login-email.js'
import { isConfiguredAdmin } from '../lib/restaurant-registration.js'

const emailSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)), intent: z.enum(['member', 'restaurant']).default('member') })

// Flux « lien magique » :
// 1. POST /auth/magic-link { email }  → le serveur génère un lien de connexion
//    (sans clé : lien dev ; avec clé : e-mail Resend, aucun lien exposé).
// 2. GET  /auth/verify?token=...      → crée/retrouve l'utilisateur, renvoie
//    un token de session (7 jours) à utiliser en Authorization: Bearer.
export function authRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const authRateLimit = rateLimit(10, 60_000) // 10 tentatives / min / IP
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const resend = resendKey ? new PrivateResend(resendKey) : null

  // Le front n'envoie jamais automatiquement d'e-mail aux comptes de démo.
  app.get('/auth/config', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store')
    return { emailEnabled: !!resend || process.env.NODE_ENV === 'production' }
  })

  app.post('/auth/magic-link', { preHandler: authRateLimit }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store')
    const { email, intent } = emailSchema.parse(req.body)
    if (!resend && process.env.NODE_ENV === 'production') return reply.code(503).send({ error: 'Connexion par e-mail temporairement indisponible.' })
    const token = signToken({ scope: 'magic', email, nonce: randomCode() }, 15 * 60)
    if (resend) {
      try {
        const appUrl = new URL(process.env.APP_URL || 'http://localhost:7100')
        if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password) throw new Error('APP_URL invalide')
        const link = new URL('./', appUrl.href.endsWith('/') ? appUrl : `${appUrl.href}/`)
        link.search = ''; link.hash = ''
        link.searchParams.set('token', token)
        if (intent === 'restaurant') link.searchParams.set('espace', 'restaurant')
        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM || 'Fidelity <onboarding@resend.dev>',
          to: email,
          ...loginEmail(link.toString()),
        })
        if (error) throw new Error('Envoi refusé')
        return { message: 'Ton lien de connexion a été envoyé. Vérifie ta boîte e-mail.' }
      } catch {
        // Ne pas journaliser l'erreur du prestataire : elle peut contenir le message et son lien.
        return reply.code(502).send({ error: 'Impossible d’envoyer le lien pour le moment. Réessaie plus tard.' })
      }
    }
    const link = `http://localhost:${process.env.PORT || 3001}/auth/verify?token=${token}`

    app.log.info({ email, link }, 'Lien magique généré (dev)')

    return { message: 'Si ce compte existe, un lien de connexion a été envoyé.', devLink: link }
  })

  app.get('/auth/verify', { preHandler: authRateLimit }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store')
    const { token } = z.object({ token: z.string().min(10).max(2000) }).parse(req.query)
    const payload = verifyToken<{ scope: string; email: string; exp: number }>(token)
    if (!payload || payload.scope !== 'magic' || !z.email().safeParse(payload.email).success) {
      return reply.code(401).send({ error: 'Lien invalide ou expiré, redemande un lien.' })
    }
    const tokenHash = createHash('sha256').update(token).digest('hex')
    let user
    try {
      user = await prisma.$transaction(async (tx) => {
        await tx.usedMagicLink.deleteMany({ where: { expiresAt: { lte: new Date() } } })
        // La clé unique rejette aussi deux validations simultanées, sur plusieurs instances.
        await tx.usedMagicLink.create({ data: { tokenHash, expiresAt: new Date(payload.exp) } })
        return tx.user.upsert({
          where: { email: payload.email },
          update: isConfiguredAdmin(payload.email) ? { role: 'ADMIN' } : {},
          create: { email: payload.email, ...(isConfiguredAdmin(payload.email) ? { role: 'ADMIN' as const } : {}) },
          select: { id: true, email: true, pseudo: true, displayName: true, role: true },
        })
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return reply.code(401).send({ error: 'Lien invalide ou expiré, redemande un lien.' })
      }
      // Aucun token brut dans les journaux d'erreur de validation.
      return reply.code(503).send({ error: 'Connexion indisponible pour le moment. Réessaie plus tard.' })
    }
    const session = signToken({ sub: user.id, role: user.role }, 7 * 24 * 3600)
    return { token: session, user }
  })

  // Qui suis-je ? (utile pour le front au démarrage)
  app.post('/auth/logout', { preHandler: app.authenticate }, async (req) => {
    const token = req.headers.authorization!.slice(7)
    const payload = verifyToken<{ exp: number }>(token)!
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await prisma.revokedSession.upsert({ where: { tokenHash }, update: {}, create: { tokenHash, expiresAt: new Date(payload.exp) } })
    await prisma.revokedSession.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    return { message: 'Déconnexion effectuée.' }
  })

  // Suppression de compte (exigence App Store 5.1.1) : efface le compte et toutes
  // ses données personnelles en une transaction. Refusée si le compte possède un
  // établissement — il doit d'abord le fermer ou le transférer.
  app.delete('/auth/me', { preHandler: app.authenticate }, async (req, reply) => {
    const userId = req.userId
    const owned = await prisma.restaurant.count({ where: { ownerId: userId } })
    if (owned > 0) {
      return reply.code(409).send({
        error: 'Ton compte possède un établissement — ferme-le ou transfère-le avant de supprimer ton compte.',
      })
    }
    await prisma.$transaction(async (tx) => {
      // Le ledger appartient aux adhésions des clients : on détache seulement les
      // opérations que ce compte a validées en tant qu'opérateur (jamais d'effacement).
      await tx.ledgerEntry.updateMany({ where: { authorId: userId }, data: { authorId: null } })
      // Les posts du compte — leurs likes/commentaires partent en cascade.
      await tx.post.deleteMany({ where: { authorId: userId } })
      // Tout le reste cascade : adhésions (+ ledger, QR, passes Wallet), avis,
      // likes, commentaires, follows, favoris, candidatures restaurateur.
      await tx.user.delete({ where: { id: userId } })
    })
    // Le token devient inutilisable immédiatement : l'utilisateur n'existe plus.
    return { message: 'Compte supprimé. Tes données personnelles ont été effacées.' }
  })

  app.get('/auth/me', { preHandler: app.authenticate }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store')
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, pseudo: true, displayName: true, avatarUrl: true, role: true },
    })
    if (!user) return reply.code(401).send({ error: 'Session invalide ou expirée, reconnecte-toi.' })
    return user
  })
}
