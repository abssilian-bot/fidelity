import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { registerSecurityHeaders, registerErrorHandler, rateLimit } from './lib/security.js'
import { registerAuth } from './lib/auth.js'
import { authRoutes } from './routes/auth.js'
import { restaurantRoutes } from './routes/restaurants.js'
import { membershipRoutes } from './routes/memberships.js'
import { ledgerRoutes } from './routes/ledger.js'
import { shareRoutes } from './routes/shares.js'
import { memberSearchRoutes } from './routes/member-search.js'

const prisma = new PrismaClient()
const app = Fastify({ logger: {
  // Le logger HTTP ne doit pas exposer le token de /auth/verify ni les en-têtes de session.
  serializers: { req: (req) => ({ method: req.method, url: req.url?.split('?')[0], hostname: req.hostname, remoteAddress: req.ip }) },
  redact: ['req.headers.authorization', 'req.headers.cookie', 'token', 'devLink'],
}, trustProxy: true })

// CORS : uniquement les fronts autorisés (dev local par défaut, prod via env)
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ??
  'http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:7100,http://127.0.0.1:7100'
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
shareRoutes(app, prisma)
memberSearchRoutes(app, prisma)

// Front statique : sert l'app React compilée quand elle existe.
// Deux emplacements possibles, le premier trouvé gagne :
//  1. app/dist     → build frais (dev local, ou Render quand il compile le front)
//  2. backend/public → copie figée commitée dans le dépôt (secours garanti)
// En dev sans build, l'API tourne seule, rien ne change.
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const webCandidates = [
  path.resolve(currentDir, '../../app/dist'),
  path.resolve(currentDir, '../public'),
]
const webDist = webCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')))
if (webDist) {
  await app.register(fastifyStatic, { root: webDist })
  app.log.info(`App web servie depuis ${webDist}`)
}

const port = Number(process.env.PORT || 3001)

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => app.log.info(`API Fidelity sur http://localhost:${port}`))
  .catch((error) => {
    app.log.error(error)
    process.exit(1)
  })

export { prisma }
