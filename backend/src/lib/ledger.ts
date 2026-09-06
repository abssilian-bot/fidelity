import { Prisma, type PrismaClient } from '@prisma/client'

export class LedgerError extends Error {
  constructor(public statusCode: number, message: string) { super(message) }
}
export const entrySelect = { id: true, delta: true, balanceAfter: true, kind: true, status: true, idempotencyKey: true, createdAt: true } as const
export type EntryInput = {
  membershipId: string; delta: number; kind: 'EARN' | 'REDEEM' | 'ADJUST' | 'REFUND' | 'FOODSHARE'
  source: string; idempotencyKey: string; authorId: string; note?: string; presentationId?: string
}
export async function lockMembership(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Membership" WHERE "id" = ${id} FOR UPDATE`
  if (!rows.length) throw new LedgerError(404, 'Carte introuvable.')
}
export async function balanceOf(tx: Prisma.TransactionClient | PrismaClient, membershipId: string) {
  const sum = await tx.ledgerEntry.aggregate({ where: { membershipId, status: 'CONFIRMED' }, _sum: { delta: true } })
  return sum._sum.delta ?? 0
}
// Toutes les écritures, y compris FoodShare, verrouillent la même ligne de carte.
// Le verrou PostgreSQL protège aussi plusieurs serveurs / téléphones simultanés.
export async function writeEntryInTransaction(tx: Prisma.TransactionClient, input: EntryInput) {
  await lockMembership(tx, input.membershipId)
  const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) {
    if (existing.membershipId !== input.membershipId || existing.authorId !== input.authorId || existing.kind !== input.kind ||
        existing.delta !== input.delta || existing.source !== input.source || (existing.note ?? '') !== (input.note ?? '')) {
      throw new LedgerError(409, 'Cette référence a déjà été utilisée pour une autre opération.')
    }
    const { id, delta, balanceAfter, kind, status, idempotencyKey, createdAt } = existing
    return { id, delta, balanceAfter, kind, status, idempotencyKey, createdAt, idempotentReplay: true }
  }
  if (input.presentationId) {
    const used = await tx.cardPresentation.updateMany({
      where: { id: input.presentationId, membershipId: input.membershipId, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    })
    if (used.count !== 1) throw new LedgerError(409, 'Ce QR a expiré ou a déjà été utilisé. Demande au client un nouveau QR.')
  }
  const balanceAfter = await balanceOf(tx, input.membershipId) + input.delta
  if (balanceAfter < 0) throw new LedgerError(409, 'Solde insuffisant pour cette opération.')
  if (!Number.isSafeInteger(balanceAfter) || balanceAfter > 2_000_000_000) throw new LedgerError(409, 'La limite du programme est atteinte.')
  const { presentationId: _presentationId, ...data } = input
  return tx.ledgerEntry.create({ data: { ...data, balanceAfter }, select: entrySelect })
}
export async function writeEntry(prisma: PrismaClient, input: EntryInput) {
  return prisma.$transaction(tx => writeEntryInTransaction(tx, input), { maxWait: 5_000, timeout: 10_000 })
}
