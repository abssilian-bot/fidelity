import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { verifyToken } from './tokens.js'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

// Authentification par token de session (Authorization: Bearer <token>).
// Le token est émis par /auth/verify après clic sur le lien magique.

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    userRole: string
  }
}

type SessionPayload = { sub: string; role: string }

export function registerAuth(app: FastifyInstance, prisma: PrismaClient) {
  app.decorateRequest('userId', '')
  app.decorateRequest('userRole', '')

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Connexion requise (token manquant).' })
    }
    const payload = verifyToken<SessionPayload>(header.slice(7))
    if (!payload || typeof payload.sub !== 'string' || !['MEMBER', 'RESTAURANT', 'ADMIN'].includes(payload.role)) {
      return reply.code(401).send({ error: 'Session invalide ou expirée, reconnecte-toi.' })
    }
    const [user, revoked] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true } }),
      prisma.revokedSession.findUnique({ where: { tokenHash: createHash('sha256').update(header.slice(7)).digest('hex') }, select: { tokenHash: true } }),
    ])
    if (!user || revoked) return reply.code(401).send({ error: 'Session invalide ou expirée, reconnecte-toi.' })
    req.userRole = user.role
    req.userId = payload.sub
  })
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  }
}
