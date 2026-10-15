ALTER TABLE "judgments"
  ALTER COLUMN "filePath" DROP NOT NULL,
  ADD COLUMN "consumerPresent" BOOLEAN,
  ADD COLUMN "oppositePartyPresent" BOOLEAN,
  ADD COLUMN "witnessDetails" TEXT,
  ADD COLUMN "advocateDetails" TEXT,
  ADD COLUMN "orderDate" TIMESTAMP(3);
