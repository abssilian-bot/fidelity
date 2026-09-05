CREATE TABLE "UsedMagicLink" (
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UsedMagicLink_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "UsedMagicLink_expiresAt_idx" ON "UsedMagicLink"("expiresAt");
