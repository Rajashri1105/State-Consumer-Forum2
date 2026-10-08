-- ==========================================================================
-- Migration: Benches, Registrar role, scrutiny-clerk claim queue
--   * Replaces the 1:1 judge_clerk_pairs + clerk Yes/No confirmation loop
--     with Bench (presiding judge + court clerk) based allotment.
--   * Adds REGISTRAR role and the CLERK sub-type (SCRUTINY | COURT).
--   * Existing judge/clerk pairs are converted into benches so no data is lost.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------
CREATE TYPE "ClerkType" AS ENUM ('SCRUTINY', 'COURT');

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'REGISTRAR';
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'PENDING_ALLOTMENT';
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'DEFECTIVE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPLAINT_CLAIMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPLAINT_ALLOTTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPLAINT_DEFECTIVE';

-- --------------------------------------------------------------------------
-- benches + case_allotments
-- --------------------------------------------------------------------------
CREATE TABLE "benches" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "courtRoom" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "benches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "benches_name_key" ON "benches"("name");

CREATE TABLE "case_allotments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "fromBenchId" TEXT,
    "toBenchId" TEXT,
    "judgeId" TEXT,
    "byUserId" TEXT,
    "method" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_allotments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "case_allotments_complaintId_idx" ON "case_allotments"("complaintId");
ALTER TABLE "case_allotments" ADD CONSTRAINT "case_allotments_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_allotments" ADD CONSTRAINT "case_allotments_toBenchId_fkey" FOREIGN KEY ("toBenchId") REFERENCES "benches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- New columns
-- --------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN "clerkType" "ClerkType";
ALTER TABLE "users" ADD COLUMN "benchId" TEXT;
CREATE INDEX "users_benchId_idx" ON "users"("benchId");
ALTER TABLE "users" ADD CONSTRAINT "users_benchId_fkey" FOREIGN KEY ("benchId") REFERENCES "benches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "judge_profiles" ADD COLUMN "benchId" TEXT;
CREATE INDEX "judge_profiles_benchId_idx" ON "judge_profiles"("benchId");
ALTER TABLE "judge_profiles" ADD CONSTRAINT "judge_profiles_benchId_fkey" FOREIGN KEY ("benchId") REFERENCES "benches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "complaints" ADD COLUMN "benchId" TEXT;
ALTER TABLE "complaints" ADD COLUMN "allottedById" TEXT;
ALTER TABLE "complaints" ADD COLUMN "allottedAt" TIMESTAMP(3);
ALTER TABLE "complaints" ADD COLUMN "defectRemarks" TEXT;
CREATE INDEX "complaints_benchId_idx" ON "complaints"("benchId");
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_benchId_fkey" FOREIGN KEY ("benchId") REFERENCES "benches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_allottedById_fkey" FOREIGN KEY ("allottedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- Data migration: one bench per existing judge (bench id = judge profile id),
-- paired clerks become that bench's court clerk, every other clerk becomes a
-- scrutiny clerk, complaints inherit the bench of their assigned judge.
-- --------------------------------------------------------------------------
INSERT INTO "benches" ("id", "name", "courtRoom")
SELECT jp."id", 'Bench ' || ROW_NUMBER() OVER (ORDER BY jp."joiningDate", jp."id"), jp."courtRoom"
FROM "judge_profiles" jp;

UPDATE "judge_profiles" SET "benchId" = "id";

UPDATE "users" u
SET "benchId" = p."judgeId", "clerkType" = 'COURT'
FROM "judge_clerk_pairs" p
WHERE p."clerkId" = u."id";

UPDATE "users" SET "clerkType" = 'SCRUTINY' WHERE "role" = 'CLERK' AND "clerkType" IS NULL;

UPDATE "complaints" c
SET "benchId" = jp."benchId"
FROM "judge_profiles" jp
WHERE c."assignedJudgeId" = jp."id";

-- Complaints that were mid-way through the old Yes/No loop go to the
-- Registrar's queue (NEEDS_MANUAL_ASSIGNMENT already exists from an earlier migration).
UPDATE "complaints"
SET "status" = 'NEEDS_MANUAL_ASSIGNMENT', "needsManualAssignment" = true
WHERE "status" = 'PENDING_JUDGE_CONFIRMATION';

-- --------------------------------------------------------------------------
-- Remove the old pairing / confirmation-loop structures
-- --------------------------------------------------------------------------
DROP TABLE "judge_assignment_attempts";
DROP TABLE "judge_clerk_pairs";
DROP TYPE "AssignmentResponse";
ALTER TABLE "complaints" DROP COLUMN "assignmentAttemptCount";

-- --------------------------------------------------------------------------
-- forum_settings: allotment mode + claim timeout
-- --------------------------------------------------------------------------
ALTER TABLE "forum_settings" ADD COLUMN "allotmentMode" TEXT NOT NULL DEFAULT 'AUTO';
ALTER TABLE "forum_settings" ADD COLUMN "claimTimeoutHours" INTEGER NOT NULL DEFAULT 4;
