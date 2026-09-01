import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { randomCode } from '../lib/tokens.js'

export function membershipRoutes(app: FastifyInstance, prisma: PrismaClient) {
  // Adhésion via le QR public du restaurant (/r/:slug côté front)
  app.post('/memberships', { preHandler: app.authenticate }, async (req, reply) => {
    const { slug } = z.object({ slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/) }).parse(req.body)
    const restaurant = await prisma.restaurant.findFirst({ where: { slug, status: 'VERIFIED' } })
    if (!restaurant) return reply.code(404).send({ error: 'Restaurant introuvable.' })

    const membership = await prisma.membership.upsert({
      where: { userId_restaurantId: { userId: req.userId, restaurantId: restaurant.id } },
      update: {},
      create: { userId: req.userId, restaurantId: restaurant.id, publicCode: randomCode(16) },
      select: { id: true, publicCode: true, createdAt: true, restaurant: { select: { name: true, slug: true } } },
    })
    return reply.code(201).send(membership)
  })

  // « Mes cartes » : adhésions + solde dérivé du ledger (dernier balanceAfter)
  app.get('/memberships/mine', { preHandler: app.authenticate }, async (req) => {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, publicCode: true, createdAt: true,
        restaurant: {
          select: {
            name: true, slug: true, cuisine: true, district: true, imageUrl: true,
            program: { select: { type: true, title: true, target: true, reward: true, rule: true, style: true } },
          },
        },
        entries: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { balanceAfter: true } },
      },
    })
    return memberships.map(({ entries, ...m }) => ({
      ...m,
      balance: entries[0]?.balanceAfter ?? 0,
    }))
  })

  // Historique des mouvements d'une carte — visible par le membre ET le restaurateur
  app.get('/memberships/:id/history', { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const membership = await prisma.membership.findUnique({
      where: { id },
      select: { userId: true, restaurant: { select: { ownerId: true } } },
    })
    if (!membership) return reply.code(404).send({ error: 'Carte introuvable.' })
    const isMember = membership.userId === req.userId
    const isOwner = membership.restaurant.ownerId === req.userId
    if (!isMember && !isOwner && req.userRole !== 'ADMIN') {
      return reply.code(403).send({ error: 'Accès interdit à cet historique.' })
    }
    return prisma.ledgerEntry.findMany({
      where: { membershipId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true, delta: true, balanceAfter: true, kind: true, status: true,
        source: true, note: true, createdAt: true,
      },
    })
  })
}
