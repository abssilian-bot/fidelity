import { PrismaClient } from '@prisma/client'
const url = process.argv[2]
const p = new PrismaClient({ datasources: { db: { url } } })
try {
  console.log('CONNEXION OK, restaurants =', await p.restaurant.count())
} catch (e) {
  console.error('ECHEC COMPLET:', JSON.stringify(e.message ?? e, null, 1))
  process.exit(1)
} finally { await p.$disconnect() }
