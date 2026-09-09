CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TABLE "RestaurantApplication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicantId" TEXT NOT NULL,
  "siret" TEXT NOT NULL,
  "tradingName" TEXT NOT NULL,
  "cuisine" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactRole" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "website" TEXT NOT NULL DEFAULT '',
  "message" TEXT NOT NULL DEFAULT '',
  "registry" JSONB NOT NULL,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "decisionReason" TEXT NOT NULL DEFAULT '',
  "verificationNote" TEXT NOT NULL DEFAULT '',
  "reviewHistory" JSONB NOT NULL DEFAULT '[]',
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "restaurantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RestaurantApplication_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RestaurantApplication_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RestaurantApplication_restaurantId_key" ON "RestaurantApplication"("restaurantId");
CREATE UNIQUE INDEX "RestaurantApplication_applicantId_siret_key" ON "RestaurantApplication"("applicantId", "siret");
CREATE INDEX "RestaurantApplication_status_createdAt_idx" ON "RestaurantApplication"("status", "createdAt");
CREATE UNIQUE INDEX "Restaurant_siret_key" ON "Restaurant"("siret");
ALTER TABLE "RestaurantApplication" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "RestaurantApplication" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON TABLE "RestaurantApplication" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON TABLE "RestaurantApplication" FROM authenticated; END IF;
END $$;
