import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

// --- En-têtes de sécurité HTTP (protection XSS, clickjacking, sniffing) ---
export function registerSecurityHeaders(app: FastifyInstance) {
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('Permissions-Policy', 'camera=(self), geolocation=(self)')
    reply.header('Cross-Origin-Resource-Policy', 'same-site')
  })
}

// --- Limiteur de débit en mémoire (anti-spam / anti brute-force) ---
// Simple et sans dépendance. Par IP : `max` requêtes par fenêtre `windowMs`.
export function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>()

  const cleaner = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of hits) if (entry.reset < now) hits.delete(key)
  }, windowMs)
  cleaner.unref()

  return async (req: FastifyRequest, reply: FastifyReply) => {
    const now = Date.now()
    const key = req.ip
    const entry = hits.get(key)
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs })
      return
    }
    entry.count += 1
    if (entry.count > max) {
      reply.header('Retry-After', Math.ceil((entry.reset - now) / 1000))
      return reply.code(429).send({ error: 'Trop de requêtes, réessaie dans un instant.' })
    }
  }
}

// --- Erreurs propres : jamais de stack trace ni d'interne exposé au client ---
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, req, reply) => {
    // Erreurs de validation Zod → 400 avec le détail des champs
    if (error.name === 'ZodError') {
      return reply.code(400).send({
        error: 'Données invalides',
        details: JSON.parse(error.message),
      })
    }
    const statusCode = error.statusCode
    if (statusCode && statusCode < 500) {
      return reply.code(statusCode).send({ error: error.message })
    }
    req.log.error(error)
    return reply.code(500).send({ error: 'Erreur interne du serveur' })
  })
}
