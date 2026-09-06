CREATE TABLE "RevokedSession" ("tokenHash" TEXT PRIMARY KEY, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "RevokedSession_expiresAt_idx" ON "RevokedSession"("expiresAt");
CREATE TABLE "CardPresentation" (
  "id" TEXT PRIMARY KEY,
  "membershipId" TEXT NOT NULL REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3)
);
CREATE INDEX "CardPresentation_expiresAt_idx" ON "CardPresentation"("expiresAt");
CREATE INDEX "CardPresentation_membershipId_idx" ON "CardPresentation"("membershipId");
ALTER TABLE "Post" ADD COLUMN "qualifyingEntryId" TEXT;
CREATE UNIQUE INDEX "Post_qualifyingEntryId_key" ON "Post"("qualifyingEntryId");
ALTER TABLE "Post" ADD CONSTRAINT "Post_qualifyingEntryId_fkey" FOREIGN KEY ("qualifyingEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Le registre existant est conservé. Les futurs soldes partent de la somme des mouvements.
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_balance_nonnegative" CHECK ("balanceAfter" >= 0) NOT VALID;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_delta_nonzero" CHECK ("delta" <> 0) NOT VALID;
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_target_positive" CHECK ("target" > 0) NOT VALID;
