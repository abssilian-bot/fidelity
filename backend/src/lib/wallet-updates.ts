import type { Prisma } from '@prisma/client'

// Le verrou est conservé jusqu'au commit : aucun numéro de version inférieur
// ne peut devenir visible après un numéro supérieur déjà renvoyé à Apple.
export async function lockWalletVersions(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(73319109)`
}
export async function markWalletChanged(tx: Prisma.TransactionClient, membershipId: string) {
  if (!await tx.walletPass.findUnique({ where: { membershipId }, select: { id: true } })) return
  await lockWalletVersions(tx)
  await tx.$executeRaw`UPDATE "WalletPass" SET "version" = nextval('"WalletPass_version_seq"'), "updatedAt" = clock_timestamp(), "nextPushAt" = clock_timestamp(), "pushFailures" = 0 WHERE "membershipId" = ${membershipId}`
}
export async function markRestaurantWalletsChanged(tx: Prisma.TransactionClient, restaurantId: string) {
  await lockWalletVersions(tx)
  await tx.$executeRaw`UPDATE "WalletPass" SET "version" = nextval('"WalletPass_version_seq"'), "updatedAt" = clock_timestamp(), "nextPushAt" = clock_timestamp(), "pushFailures" = 0 WHERE "membershipId" IN (SELECT "id" FROM "Membership" WHERE "restaurantId" = ${restaurantId})`
}
