import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { rateLimit } from '../lib/security.js'
import { handleLedgerError } from './ledger.js'
import { LedgerError, lockMembership, writeEntryInTransaction } from '../lib/ledger.js'
import { safeImage } from '../lib/urls.js'

// ─────────────────────────────────────────────────────────────────────────────
// FOODSHARE — boucle complète :
// 1. Le membre publie (photo + note + commentaire) APRÈS une première commande
//    (≥ 1 crédit EARN sur sa carte). La note compte tout de suite (Review),
//    la photo part en attente (Post PENDING).
// 2. Le restaurateur valide : PUBLISHED → la photo alimente le fil public et
//    crédite le membre (écriture FOODSHARE dans le ledger, idempotente).
//    Ou refuse : REJECTED → visible uniquement sur le profil du membre.
// ─────────────────────────────────────────────────────────────────────────────

const publishSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  imageUrl: safeImage,
  caption: z.string().max(300).default(''),
  rating: z.number().int().min(1).max(5),
})

const decideSchema = z.object({
  publish: z.boolean(),
  rewardDelta: z.number().int().min(0).max(1000).default(1),
  note: z.string().max(200).optional(),
})

const postSelect = {
  id: true, imageUrl: true, caption: true, rating: true, status: true, createdAt: true,
  author: { select: { displayName: true, pseudo: true, avatarUrl: true } },
} as const

export function shareRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const shareRateLimit = rateLimit(30, 60_000)

  // Le membre publie un FoodShare — exige une première commande (≥ 1 EARN)
  app.post('/shares', { preHandler: [app.authenticate, shareRateLimit] }, async (req, reply) => {
    const body = publishSchema.parse(req.body)
    const restaurant = await prisma.restaurant.findFirst({ where: { slug: body.slug, status: 'VERIFIED' } })
    if (!restaurant) return reply.code(404).send({ error: 'Restaurant introuvable.' })

    const membership = await prisma.membership.findUnique({
      where: { userId_restaurantId: { userId: req.userId, restaurantId: restaurant.id } },
      select: { id: true },
    })
    if (!membership) {
      return reply.code(403).send({ error: 'FoodShare disponible après une première commande dans ce restaurant.' })
    }
    const earnCount = await prisma.ledgerEntry.count({
      where: { membershipId: membership.id, kind: 'EARN', status: 'CONFIRMED' },
    })
    if (earnCount === 0) {
      return reply.code(403).send({ error: 'FoodShare disponible après une première commande dans ce restaurant.' })
    }

    try {
    const post = await prisma.$transaction(async tx => {
      await lockMembership(tx, membership.id)
      const purchase = await tx.ledgerEntry.findFirst({ where: { membershipId: membership.id, kind: 'EARN', status: 'CONFIRMED', qualifyingPost: null }, orderBy: { createdAt: 'desc' }, select: { id: true } })
      if (!purchase) throw new LedgerError(409, 'Un FoodShare a déjà été proposé pour chaque visite. Reviens après une nouvelle commande.')
      const created = await tx.post.create({
        data: {
          authorId: req.userId,
          taggedRestaurantId: restaurant.id,
          imageUrl: body.imageUrl,
          caption: body.caption,
          rating: body.rating,
          status: 'PENDING',
          qualifyingEntryId: purchase.id,
        },
        select: postSelect,
      })
      // La note compte tout de suite : un avis par membre et par restaurant
      await tx.review.upsert({
        where: { restaurantId_authorId: { restaurantId: restaurant.id, authorId: req.userId } },
        update: { rating: body.rating, text: body.caption },
        create: { restaurantId: restaurant.id, authorId: req.userId, rating: body.rating, text: body.caption },
      })
      return created
    })
    return reply.code(201).send(post)
    } catch (error) { return handleLedgerError(reply, error) }
  })

  // « Mes partages » côté membre (tous statuts, avec le nom du restaurant)
  app.get('/shares/mine', { preHandler: app.authenticate }, async (req) => {
    const posts = await prisma.post.findMany({
      where: { authorId: req.userId, taggedRestaurantId: { not: null } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        ...postSelect,
        taggedRestaurantId: true,
      },
    })
    const restaurantIds = [...new Set(posts.map((p) => p.taggedRestaurantId).filter((id): id is string => !!id))]
    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: restaurantIds } },
      select: { id: true, name: true, slug: true },
    })
    const byId = new Map(restaurants.map((r) => [r.id, r]))
    return posts.map((post) => ({
      ...post,
      restaurant: post.taggedRestaurantId ? (byId.get(post.taggedRestaurantId) ?? null) : null,
    }))
  })

  // File de validation du restaurateur (?status=PENDING|PUBLISHED|REJECTED)
  app.get('/restaurants/:id/shares', { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const { status } = z
      .object({ status: z.enum(['PENDING', 'PUBLISHED', 'REJECTED']).default('PENDING') })
      .parse(req.query)
    const restaurant = await prisma.restaurant.findUnique({ where: { id }, select: { ownerId: true } })
    if (!restaurant) return reply.code(404).send({ error: 'Restaurant introuvable.' })
    if (restaurant.ownerId !== req.userId && req.userRole !== 'ADMIN') {
      return reply.code(403).send({ error: 'Accès interdit : ce restaurant ne t’appartient pas.' })
    }
    return prisma.post.findMany({
      where: { taggedRestaurantId: id, status },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: postSelect,
    })
  })

  // Décision du restaurateur : republier (crédit ledger FOODSHARE) ou refuser
  app.post('/shares/:id/decide', { preHandler: [app.authenticate, shareRateLimit] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const body = decideSchema.parse(req.body ?? {})

    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true, status: true, authorId: true, taggedRestaurantId: true,
      },
    })
    if (!post || !post.taggedRestaurantId || !post.authorId) {
      return reply.code(404).send({ error: 'Partage introuvable.' })
    }
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: post.taggedRestaurantId },
      select: { ownerId: true, status: true, program: true },
    })
    if (!restaurant) return reply.code(404).send({ error: 'Restaurant introuvable.' })
    if (restaurant.ownerId !== req.userId && req.userRole !== 'ADMIN') {
      return reply.code(403).send({ error: 'Accès interdit : ce partage ne concerne pas ton restaurant.' })
    }
    if (post.status !== 'PENDING') {
      return reply.code(409).send({ error: 'Ce partage a déjà été traité.' })
    }

    try {
      const result = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Restaurant" WHERE "id" = ${post.taggedRestaurantId} FOR SHARE`
        await tx.$queryRaw`SELECT "id" FROM "LoyaltyProgram" WHERE "restaurantId" = ${post.taggedRestaurantId} FOR SHARE`
        const current = await tx.restaurant.findUnique({ where: { id: post.taggedRestaurantId! }, include: { program: true } })
        if (!current || (current.ownerId !== req.userId && req.userRole !== 'ADMIN')) throw new LedgerError(403, 'Accès interdit.')
        if (current.status !== 'VERIFIED' || !current.program?.active) throw new LedgerError(409, 'Ce programme est actuellement indisponible.')
        if (body.rewardDelta > (current.program.type === 'STAMPS' ? 10 : 1000)) throw new LedgerError(400, 'Récompense supérieure à la limite du programme.')
        const changed = await tx.post.updateMany({ where: { id: post.id, status: 'PENDING' }, data: { status: body.publish ? 'PUBLISHED' : 'REJECTED' } })
        if (!changed.count) throw new LedgerError(409, 'Ce partage a déjà été traité.')
        let credited = null
        if (body.publish && body.rewardDelta > 0) {
          if (post.authorId === req.userId) throw new LedgerError(403, 'Tu ne peux pas récompenser ton propre partage.')
          const membership = await tx.membership.findUnique({ where: { userId_restaurantId: { userId: post.authorId!, restaurantId: post.taggedRestaurantId! } } })
          if (!membership) throw new LedgerError(409, 'La carte du membre est indisponible.')
          credited = await writeEntryInTransaction(tx, {
            membershipId: membership.id, delta: body.rewardDelta, kind: 'FOODSHARE', source: 'foodshare',
            idempotencyKey: `foodshare:${post.id}`, authorId: req.userId, note: body.note ?? 'Partage FoodShare republié',
          })
        }
        return { post: await tx.post.findUnique({ where: { id: post.id }, select: postSelect }), credited }
      }, { maxWait: 5_000, timeout: 10_000 })
      return reply.send(result)
    } catch (error) { return handleLedgerError(reply, error) }
  })

  // Fil public : les FoodShare republiés d'un restaurant (page resto / Discovery)
  app.get('/restaurants/:slug/shares/public', async (req, reply) => {
    const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(req.params)
    const restaurant = await prisma.restaurant.findFirst({ where: { slug, status: 'VERIFIED' }, select: { id: true } })
    if (!restaurant) return reply.code(404).send({ error: 'Restaurant introuvable.' })
    return prisma.post.findMany({
      where: { taggedRestaurantId: restaurant.id, status: 'PUBLISHED' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: postSelect,
    })
  })
}
