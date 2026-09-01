import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { verifyToken } from './tokens.js'

// Authentification par token de session (Authorization: Bearer <token>).
// Le token est émis par /auth/verify après clic sur le lien magique.

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    userRole: string
  }
}

type SessionPayload = { sub: string; role: string }

export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('userId', '')
  app.decorateRequest('userRole', '')

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Connexion requise (token manquant).' })
    }
    const payload = verifyToken<SessionPayload>(header.slice(7))
    if (!payload || typeof payload.sub !== 'string') {
      return reply.code(401).send({ error: 'Session invalide ou expirée, reconnecte-toi.' })
    }
    req.userId = payload.sub
    req.userRole = payload.role ?? 'MEMBER'
  })
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  }
}
