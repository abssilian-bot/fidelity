import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { signToken, verifyToken } from '../lib/tokens.js'
import { rateLimit } from '../lib/security.js'
import type { PrismaClient } from '@prisma/client'

const emailSchema = z.object({ email: z.email().max(254) })

// Flux « lien magique » :
// 1. POST /auth/magic-link { email }  → le serveur génère un lien de connexion
//    (en dev, le lien est renvoyé dans la réponse et logué ; en prod, il sera
//    envoyé par e-mail via Supabase Auth — voir RECAP).
// 2. GET  /auth/verify?token=...      → crée/retrouve l'utilisateur, renvoie
//    un token de session (7 jours) à utiliser en Authorization: Bearer.
export function authRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const authRateLimit = rateLimit(10, 60_000) // 10 tentatives / min / IP

  app.post('/auth/magic-link', { preHandler: authRateLimit }, async (req) => {
    const { email } = emailSchema.parse(req.body)
    const token = signToken({ scope: 'magic', email }, 15 * 60)
    const link = `http://localhost:${process.env.PORT || 3001}/auth/verify?token=${token}`

    // TODO prod : envoyer `link` par e-mail (Supabase Auth / SMTP), ne JAMAIS le renvoyer.
    app.log.info({ email, link }, 'Lien magique généré (dev)')

    return { message: 'Si ce compte existe, un lien de connexion a été envoyé.', devLink: link }
  })

  app.get('/auth/verify', { preHandler: authRateLimit }, async (req, reply) => {
    const { token } = z.object({ token: z.string().min(10).max(2000) }).parse(req.query)
    const payload = verifyToken<{ scope: string; email: string }>(token)
    if (!payload || payload.scope !== 'magic') {
      return reply.code(401).send({ error: 'Lien invalide ou expiré, redemande un lien.' })
    }
    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: {},
      create: { email: payload.email },
      select: { id: true, email: true, pseudo: true, displayName: true, role: true },
    })
    const session = signToken({ sub: user.id, role: user.role }, 7 * 24 * 3600)
    return { token: session, user }
  })

  // Qui suis-je ? (utile pour le front au démarrage)
  app.get('/auth/me', { preHandler: app.authenticate }, async (req) => {
    return prisma.user.findUniqueOrThrow({
      where: { id: req.userId },
      select: { id: true, email: true, pseudo: true, displayName: true, avatarUrl: true, role: true },
    })
  })
}
