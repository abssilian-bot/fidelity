import type { FastifyInstance } from 'fastify'
import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { normalizeMemberQuery } from '../lib/search-profile.js'

const publicFields = { id: true, displayName: true, pseudo: true, bio: true, avatarUrl: true } as const

/** Annuaire public : aucun e-mail, historique d'achat ou code de fidélité ne sort de ces routes. */
export function memberSearchRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get('/members/search', async (req) => {
    const { q } = z.object({ q: z.string().trim().max(160).default('') }).parse(req.query)
    const handleOnly = q.startsWith('@')
    const query = handleOnly ? normalizeMemberQuery(q).replace(/ /g, '') : normalizeMemberQuery(q)
    if (query.length < 2) return []
    const tokens = query.split(' ').slice(0, 8)
    const name = Prisma.sql`public.fidelity_search_text("displayName")`
    const handle = Prisma.sql`replace(public.fidelity_search_text("pseudo"), ' ', '')`
    const predicates = tokens.map((token) => {
      const pattern = `%${token}%`
      // Les noms exacts et préfixes restent prioritaires. Les trigrammes rattrapent les fautes.
      const handleMatch = token.length >= 4 ? Prisma.sql`(${handle} LIKE ${pattern} OR ${token} <% ${handle})` : Prisma.sql`${handle} LIKE ${pattern}`
      const nameMatch = token.length >= 4 ? Prisma.sql`(${name} LIKE ${pattern} OR ${token} <% ${name})` : Prisma.sql`${name} LIKE ${pattern}`
      return handleOnly ? handleMatch : Prisma.sql`(${handleMatch} OR ${nameMatch})`
    })
    const sql = Prisma.sql`
      SELECT "id", "displayName", "pseudo", "bio", "avatarUrl" FROM "User"
      WHERE "role" = 'MEMBER' AND "pseudo" IS NOT NULL AND ${Prisma.join(predicates, ' AND ')}
      ORDER BY CASE WHEN ${handle} = ${query} THEN 0 WHEN ${name} = ${query} THEN 1
        WHEN ${handle} LIKE ${query + '%'} THEN 2 WHEN ${name} LIKE ${query + '%'} THEN 3 ELSE 4 END,
        GREATEST(word_similarity(${query}, ${handle}), word_similarity(${query}, ${name})) DESC, "id"
      LIMIT 50
    `
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL search_path TO public, extensions`
      return tx.$queryRaw<Array<{ id: string; displayName: string | null; pseudo: string; bio: string | null; avatarUrl: string | null }>>(sql)
    })
  })

  app.get('/members/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const member = await prisma.user.findFirst({ where: { id, role: 'MEMBER', pseudo: { not: null } }, select: {
      ...publicFields,
      posts: { where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: 12, select: { imageUrl: true } },
      _count: { select: { posts: { where: { status: 'PUBLISHED' } }, reviews: true } },
    } })
    if (!member) return reply.code(404).send({ error: 'Profil introuvable.' })
    return member
  })
}
