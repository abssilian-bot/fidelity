ALTER TABLE "CardPresentation" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'app', ADD COLUMN "operatorId" TEXT;
CREATE TABLE "WalletPass" (
  "id" TEXT PRIMARY KEY, "membershipId" TEXT NOT NULL UNIQUE REFERENCES "Membership"("id") ON DELETE CASCADE,
  "authenticationToken" TEXT NOT NULL, "barcode" TEXT NOT NULL UNIQUE,
  "version" BIGSERIAL NOT NULL, "pushedVersion" BIGINT NOT NULL DEFAULT 0,
  "pushFailures" INTEGER NOT NULL DEFAULT 0, "nextPushAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WalletPass_nextPushAt_idx" ON "WalletPass"("nextPushAt");
CREATE TABLE "WalletRegistration" (
  "passId" TEXT NOT NULL REFERENCES "WalletPass"("id") ON DELETE CASCADE,
  "deviceHash" TEXT NOT NULL, "pushToken" TEXT NOT NULL,
  PRIMARY KEY ("passId", "deviceHash")
);
CREATE INDEX "WalletRegistration_deviceHash_idx" ON "WalletRegistration"("deviceHash");
ALTER TABLE "WalletPass" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WalletRegistration" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "WalletPass", "WalletRegistration" FROM PUBLIC;
REVOKE ALL ON SEQUENCE "WalletPass_version_seq" FROM PUBLIC;
DO $$ DECLARE client_role TEXT; BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE "WalletPass", "WalletRegistration" FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON SEQUENCE "WalletPass_version_seq" FROM %I', client_role);
    END IF;
  END LOOP;
END $$;
