import Fastify from 'fastify'
import cors from '@fastify/cors'
import { PrismaClient } from '@prisma/client'
import { registerSecurityHeaders, registerErrorHandler, rateLimit } from './lib/security.js'
import { registerAuth } from './lib/auth.js'
import { authRoutes } from './routes/auth.js'
import { restaurantRoutes } from './routes/restaurants.js'
import { membershipRoutes } from './routes/memberships.js'
import { ledgerRoutes } from './routes/ledger.js'

const prisma = new PrismaClient()
const app = Fastify({ logger: true, trustProxy: true })

// CORS : uniquement les fronts autorisés (dev local par défaut, prod via env)
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ??
  'http://localhost:3000,http://localhost:5173,http://localhost:5174'
)
  .split(',')
  .map((o) => o.trim())
await app.register(cors, {
  origin: allowedOrigins,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})

// Sécurité transversale
registerSecurityHeaders(app)
registerErrorHandler(app)
registerAuth(app)
app.addHook('onRequest', rateLimit(300, 60_000)) // garde-fou global : 300 req/min/IP

app.get('/health', async () => ({ status: 'ok', service: 'fidelity-api' }))

// Routes métier
authRoutes(app, prisma)
restaurantRoutes(app, prisma)
membershipRoutes(app, prisma)
ledgerRoutes(app, prisma)

const port = Number(process.env.PORT || 3001)

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => app.log.info(`API Fidelity sur http://localhost:${port}`))
  .catch((error) => {
    app.log.error(error)
    process.exit(1)
  })

export { prisma }
