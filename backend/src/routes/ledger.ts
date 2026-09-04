import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { Prisma, type PrismaClient } from '@prisma/client'
import { rateLimit } from '../lib/security.js'

// ─────────────────────────────────────────────────────────────────────────────
// LEDGER — les règles d'or (blueprint Wallet), appliquées ici :
// 1. Aucun point sans scan commerçant : toutes ces routes exigent que
//    l'appelant soit le PROPRIÉTAIRE du restaurant de la carte scannée.
// 2. Idempotence : idempotencyKey unique → un rejeu renvoie l'écriture
//    initiale, jamais un doublon.
// 3. Jamais de suppression : les erreurs se corrigent par ADJUST/REFUND.
// 4. balanceAfter est calculé dans la même transaction que l'écriture.
// ─────────────────────────────────────────────────────────────────────────────

const earnSchema = z.object({
  code: z.string().min(8).max(64),          // QR privé membre (Membership.publicCode)
  delta: z.number().int().min(1).max(100),  // coches ou points à créditer
  idempotencyKey: z.string().min(8).max(120),
  note: z.string().max(200).optional(),
})

const redeemSchema = z.object({
  code: z.string().min(8).max(64),
  idempotencyKey: z.string().min(8).max(120),
  note: z.string().max(200).optional(),
})

const adjustSchema = z.object({
  code: z.string().min(8).max(64),
  delta: z.number().int().min(-1000).max(1000).refine((v) => v !== 0, 'delta ne peut pas être 0'),
  idempotencyKey: z.string().min(8).max(120),
  note: z.string().min(3).max(300), // motif OBLIGATOIRE pour une correction
})

class InsufficientBalance extends Error {}

export async function writeEntry(
  prisma: PrismaClient,
  input: { membershipId: string; delta: number; kind: 'EARN' | 'REDEEM' | 'ADJUST' | 'REFUND' | 'FOODSHARE'; source: string; idempotencyKey: string; authorId: string; note?: string },
) {
  return prisma.$transaction(async (tx) => {
    const last = await tx.ledgerEntry.findFirst({
      where: { membershipId: input.membershipId, status: 'CONFIRMED' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { balanceAfter: true },
    })
    const balanceAfter = (last?.balanceAfter ?? 0) + input.delta
    if (balanceAfter < 0) throw new InsufficientBalance('Solde insuffisant pour cette opération.')
    return tx.ledgerEntry.create({
      data: { ...input, balanceAfter },
      select: { id: true, delta: true, balanceAfter: true, kind: true, status: true, idempotencyKey: true, createdAt: true },
    })
  })
}

export function ledgerRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const scanRateLimit = rateLimit(60, 60_000) // le commerçant scanne en rafale aux heures de pointe

  // Résout un QR membre → carte + solde + programme (écran de confirmation commerçant)
  async function resolveMembershipForOwner(req: FastifyRequest, reply: FastifyReply, code: string) {
    const membership = await prisma.membership.findUnique({
      where: { publicCode: code },
      select: {
        id: true, userId: true,
        user: { select: { displayName: true, pseudo: true, avatarUrl: true } },
        restaurant: { select: { id: true, name: true, ownerId: true, program: true } },
        entries: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { balanceAfter: true } },
      },
    })
    if (!membership) {
      reply.code(404).send({ error: 'QR inconnu : ce code ne correspond à aucune carte.' })
      return null
    }
    if (membership.restaurant.ownerId !== req.userId && req.userRole !== 'ADMIN') {
      reply.code(403).send({ error: 'Accès interdit : cette carte n’appartient pas à ton restaurant.' })
      return null
    }
    return membership
  }

  app.get('/scan/:code', { preHandler: [app.authenticate, scanRateLimit] }, async (req, reply) => {
    const { code } = z.object({ code: z.string().min(8).max(64) }).parse(req.params)
    const membership = await resolveMembershipForOwner(req, reply, code)
    if (!membership) return
    return {
      membershipId: membership.id,
      member: membership.user,
      restaurant: { id: membership.restaurant.id, name: membership.restaurant.name },
      program: membership.restaurant.program,
      balance: membership.entries[0]?.balanceAfter ?? 0,
    }
  })

  // Crédit de points/coches après scan (uniquement le restaurateur)
  app.post('/ledger/earn', { preHandler: [app.authenticate, scanRateLimit] }, async (req, reply) => {
    const body = earnSchema.parse(req.body)
    const membership = await resolveMembershipForOwner(req, reply, body.code)
    if (!membership) return
    try {
      const entry = await writeEntry(prisma, {
        membershipId: membership.id, delta: body.delta, kind: 'EARN',
        source: 'scan', idempotencyKey: body.idempotencyKey, authorId: req.userId, note: body.note,
      })
      return reply.code(201).send(entry)
    } catch (error) {
      return handleLedgerError(reply, error, prisma, body.idempotencyKey)
    }
  })

  // Consommation d'une récompense : débit = objectif du programme
  app.post('/ledger/redeem', { preHandler: [app.authenticate, scanRateLimit] }, async (req, reply) => {
    const body = redeemSchema.parse(req.body)
    const membership = await resolveMembershipForOwner(req, reply, body.code)
    if (!membership) return
    const target = membership.restaurant.program?.target
    if (!membership.restaurant.program || !target) {
      return reply.code(409).send({ error: 'Ce restaurant n’a pas de programme fidélité actif.' })
    }
    try {
      const entry = await writeEntry(prisma, {
        membershipId: membership.id, delta: -target, kind: 'REDEEM',
        source: 'scan', idempotencyKey: body.idempotencyKey, authorId: req.userId, note: body.note,
      })
      return reply.code(201).send(entry)
    } catch (error) {
      if (error instanceof InsufficientBalance) {
        return reply.code(409).send({ error: `Solde insuffisant : il faut ${target} (coches/points) pour cette récompense.` })
      }
      return handleLedgerError(reply, error, prisma, body.idempotencyKey)
    }
  })

  // Correction manuelle (erreur de caisse, geste commercial) — motif obligatoire
  app.post('/ledger/adjust', { preHandler: [app.authenticate, scanRateLimit] }, async (req, reply) => {
    const body = adjustSchema.parse(req.body)
    const membership = await resolveMembershipForOwner(req, reply, body.code)
    if (!membership) return
    try {
      const entry = await writeEntry(prisma, {
        membershipId: membership.id, delta: body.delta, kind: body.delta > 0 ? 'ADJUST' : 'REFUND',
        source: 'admin', idempotencyKey: body.idempotencyKey, authorId: req.userId, note: body.note,
      })
      return reply.code(201).send(entry)
    } catch (error) {
      if (error instanceof InsufficientBalance) {
        return reply.code(409).send({ error: error.message })
      }
      return handleLedgerError(reply, error, prisma, body.idempotencyKey)
    }
  })
}

// Un rejeu (même idempotencyKey) renvoie l'écriture initiale — jamais de doublon
export async function handleLedgerError(reply: FastifyReply, error: unknown, prisma: PrismaClient, idempotencyKey: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const existing = await prisma.ledgerEntry.findUnique({
      where: { idempotencyKey },
      select: { id: true, delta: true, balanceAfter: true, kind: true, status: true, idempotencyKey: true, createdAt: true },
    })
    return reply.code(200).send({ ...existing, idempotentReplay: true })
  }
  throw error
}
