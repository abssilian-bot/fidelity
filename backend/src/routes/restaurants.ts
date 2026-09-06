import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { PrismaClient, Prisma } from '@prisma/client'
import { searchProfileFields } from '../lib/search-profile.js'
import { safeImage, safeUrl } from '../lib/urls.js'
import { balanceOf } from '../lib/ledger.js'

const listQuery = z.object({
  diet: z.string().max(50).optional(),       // ex: "Halal"
  district: z.string().max(50).optional(),   // ex: "Paris 11e"
  q: z.string().max(100).optional(),         // recherche texte
  open: z.enum(['true', 'false']).optional(),
})

const updateRestaurant = z
  .object({
    name: z.string().min(1).max(120),
    cuisine: z.string().max(80),
    description: z.string().max(1000),
    address: z.string().max(200),
    district: z.string().max(50),
    diets: z.array(z.string().max(50)).max(10),
    imageUrl: safeImage,
    menuPdfUrl: safeUrl.nullable(),
    deliverooUrl: safeUrl.nullable(),
    ...searchProfileFields,
  })
  .partial()

const upsertProgram = z.object({
  type: z.enum(['STAMPS', 'POINTS']),
  title: z.string().min(1).max(120),
  target: z.number().int().min(1).max(100000),
  reward: z.string().min(1).max(200),
  rule: z.string().max(300),
  style: z.enum(['BRAISE', 'CREME', 'ENCRE']).default('BRAISE'),
  active: z.boolean().default(true),
})

// Champs publics : JAMAIS siret, ownerId ni email du propriétaire
const publicSelect = {
  id: true, name: true, slug: true, cuisine: true, description: true,
  address: true, district: true, lat: true, lng: true, hours: true,
  diets: true, imageUrl: true, menuPdfUrl: true, deliverooUrl: true,
  foodTags: true, services: true, avgPrice: true, maxGuests: true,
} satisfies Prisma.RestaurantSelect

export function restaurantRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get('/owner/restaurants', { preHandler: app.authenticate }, async (req) => {
    return prisma.restaurant.findMany({ where: { ownerId: req.userId }, select: { ...publicSelect, status: true, program: true }, orderBy: { createdAt: 'asc' } })
  })
  // Liste publique des restos vérifiés (filtres : régime, quartier, recherche)
  app.get('/restaurants', async (req) => {
    const { diet, district, q } = listQuery.parse(req.query)
    return prisma.restaurant.findMany({
      where: {
        status: 'VERIFIED',
        ...(diet ? { diets: { has: diet } } : {}),
        ...(district ? { district: { equals: district, mode: 'insensitive' } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { cuisine: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        ...publicSelect,
        program: { select: { active: true, type: true, title: true, target: true, reward: true, rule: true, style: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  })

  // Page publique d'un resto (profil + programme + menu + avis)
  app.get('/restaurants/:slug', async (req, reply) => {
    const { slug } = z.object({ slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/) }).parse(req.params)
    const restaurant = await prisma.restaurant.findFirst({
      where: { slug, status: 'VERIFIED' },
      select: {
        ...publicSelect,
        program: true,
        menuItems: { orderBy: { position: 'asc' } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true, rating: true, text: true, reply: true, createdAt: true,
            author: { select: { displayName: true, pseudo: true, avatarUrl: true } },
          },
        },
      },
    })
    if (!restaurant) return reply.code(404).send({ error: 'Restaurant introuvable.' })
    return restaurant
  })

  // --- Espace restaurateur (il faut être le propriétaire) ---

  async function requireOwner(req: FastifyRequest, restaurantId: string) {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } })
    if (!restaurant) return { error: 404 as const }
    if (restaurant.ownerId !== req.userId && req.userRole !== 'ADMIN') return { error: 403 as const }
    return { restaurant }
  }

  app.put('/restaurants/:id', { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const data = updateRestaurant.parse(req.body)
    const check = await requireOwner(req, id)
    if ('error' in check && check.error) {
      return reply.code(check.error).send({ error: check.error === 404 ? 'Restaurant introuvable.' : 'Accès interdit : ce restaurant ne t’appartient pas.' })
    }
    return prisma.restaurant.update({ where: { id }, data, select: publicSelect })
  })

  app.put('/restaurants/:id/program', { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const data = upsertProgram.parse(req.body)
    const check = await requireOwner(req, id)
    if ('error' in check && check.error) {
      return reply.code(check.error).send({ error: check.error === 404 ? 'Restaurant introuvable.' : 'Accès interdit : ce restaurant ne t’appartient pas.' })
    }
    return prisma.loyaltyProgram.upsert({
      where: { restaurantId: id },
      update: data,
      create: { ...data, restaurantId: id },
    })
  })

  // Remplacement complet du menu (espace restaurateur)
  const menuSchema = z.object({
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          description: z.string().max(300).default(''),
          priceCents: z.number().int().min(0).max(1_000_000),
        }),
      )
      .max(100),
  })

  app.put('/restaurants/:id/menu', { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const { items } = menuSchema.parse(req.body)
    const check = await requireOwner(req, id)
    if ('error' in check && check.error) {
      return reply.code(check.error).send({ error: check.error === 404 ? 'Restaurant introuvable.' : 'Accès interdit : ce restaurant ne t’appartient pas.' })
    }
    await prisma.$transaction([
      prisma.menuItem.deleteMany({ where: { restaurantId: id } }),
      prisma.menuItem.createMany({
        data: items.map((item, position) => ({ ...item, position, restaurantId: id })),
      }),
    ])
    return prisma.menuItem.findMany({ where: { restaurantId: id }, orderBy: { position: 'asc' } })
  })

  // Clients du programme + activité récente (espace restaurateur)
  app.get('/restaurants/:id/members', { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const check = await requireOwner(req, id)
    if ('error' in check && check.error) {
      return reply.code(check.error).send({ error: check.error === 404 ? 'Restaurant introuvable.' : 'Accès interdit : ce restaurant ne t’appartient pas.' })
    }
    const memberships = await prisma.membership.findMany({
      where: { restaurantId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, createdAt: true,
        user: { select: { displayName: true, pseudo: true } },
        entries: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { balanceAfter: true, createdAt: true },
        },
      },
    })
    const recent = await prisma.ledgerEntry.findMany({
      where: { membership: { restaurantId: id } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
      select: {
        id: true, delta: true, kind: true, createdAt: true,
        membership: { select: { user: { select: { displayName: true, pseudo: true } } } },
      },
    })
    const since = new Date(Date.now() - 7 * 86400_000)
    const [newMembers, credits] = await Promise.all([
      prisma.membership.count({ where: { restaurantId: id, createdAt: { gte: since } } }),
      prisma.ledgerEntry.aggregate({ where: { membership: { restaurantId: id }, status: 'CONFIRMED', delta: { gt: 0 }, createdAt: { gte: since } }, _sum: { delta: true } }),
    ])
    return {
      stats: { newMembers, weeklyCredits: credits._sum.delta ?? 0, totalMembers: memberships.length },
      members: await Promise.all(memberships.map(async (m) => ({
        membershipId: m.id,
        name: m.user.displayName ?? m.user.pseudo ?? 'Membre',
        balance: await balanceOf(prisma, m.id),
        lastActivityAt: m.entries[0]?.createdAt ?? m.createdAt,
      }))),
      recent: recent.map((entry) => ({
        id: entry.id,
        clientName: entry.membership.user.displayName ?? entry.membership.user.pseudo ?? 'Membre',
        delta: entry.delta,
        kind: entry.kind,
        createdAt: entry.createdAt,
      })),
    }
  })
}
