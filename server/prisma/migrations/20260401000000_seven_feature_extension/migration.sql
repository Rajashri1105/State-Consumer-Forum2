-- ==========================================================================
-- Migration: 7-feature extension
--   1. Jurisdiction Determination Engine
--   2. AI-Assisted Complaint Drafting (synopsis)
--   3. Document Completeness Checker (no schema change — validated at
--      the API layer, see server/services/completenessChecker.js)
--   4. Notice Delivery Tracker
--   5. Escalation Alert for Overdue Hearings
--   6. Judge-Clerk Pairing with Confirmation Loop
--   7. Auto-Publish Judgment (no schema change — behavioral change only)
-- ==========================================================================

-- --------------------------------------------------------------------------
-- New enums
-- --------------------------------------------------------------------------
CREATE TYPE "JurisdictionLevel" AS ENUM ('DISTRICT_COMMISSION', 'STATE_COMMISSION', 'NATIONAL_COMMISSION');
CREATE TYPE "DeliveryChannel" AS ENUM ('SMS', 'EMAIL');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');
CREATE TYPE "AssignmentResponse" AS ENUM ('PENDING', 'YES', 'NO');

-- Additive enum values
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'PENDING_JUDGE_CONFIRMATION';
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'NEEDS_MANUAL_ASSIGNMENT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JUDGE_CONFIRMATION_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MANUAL_ASSIGNMENT_NEEDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ESCALATION_ALERT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NOTICE_DELIVERY_FAILED';

-- --------------------------------------------------------------------------
-- complaints: jurisdiction, synopsis, escalation, manual-assignment fields
-- --------------------------------------------------------------------------
ALTER TABLE "complaints" ADD COLUMN "jurisdictionLevel" "JurisdictionLevel";
ALTER TABLE "complaints" ADD COLUMN "synopsisText" TEXT;
ALTER TABLE "complaints" ADD COLUMN "synopsisGeneratedAt" TIMESTAMP(3);
ALTER TABLE "complaints" ADD COLUMN "synopsisManualConfirm" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "complaints" ADD COLUMN "isDelayed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "complaints" ADD COLUMN "delayReason" TEXT;
ALTER TABLE "complaints" ADD COLUMN "delayFlaggedAt" TIMESTAMP(3);
ALTER TABLE "complaints" ADD COLUMN "delayResolvedAt" TIMESTAMP(3);
ALTER TABLE "complaints" ADD COLUMN "assignmentAttemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "complaints" ADD COLUMN "needsManualAssignment" BOOLEAN NOT NULL DEFAULT false;

-- --------------------------------------------------------------------------
-- forum_settings: configurable overdue threshold
-- --------------------------------------------------------------------------
ALTER TABLE "forum_settings" ADD COLUMN "overdueThresholdDays" INTEGER NOT NULL DEFAULT 30;

-- --------------------------------------------------------------------------
-- notice_deliveries (Feature 4)
-- --------------------------------------------------------------------------
CREATE TABLE "notice_deliveries" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "hearingId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,
    CONSTRAINT "notice_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notice_deliveries_hearingId_idx" ON "notice_deliveries"("hearingId");
ALTER TABLE "notice_deliveries" ADD CONSTRAINT "notice_deliveries_hearingId_fkey" FOREIGN KEY ("hearingId") REFERENCES "hearings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- judge_clerk_pairs (Feature 6)
-- --------------------------------------------------------------------------
CREATE TABLE "judge_clerk_pairs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "judgeId" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "judge_clerk_pairs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "judge_clerk_pairs_judgeId_key" ON "judge_clerk_pairs"("judgeId");
ALTER TABLE "judge_clerk_pairs" ADD CONSTRAINT "judge_clerk_pairs_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "judge_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "judge_clerk_pairs" ADD CONSTRAINT "judge_clerk_pairs_clerkId_fkey" FOREIGN KEY ("clerkId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- judge_assignment_attempts (Feature 6 — audit trail of confirmation loop)
-- --------------------------------------------------------------------------
CREATE TABLE "judge_assignment_attempts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "response" "AssignmentResponse" NOT NULL DEFAULT 'PENDING',
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "judge_assignment_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "judge_assignment_attempts_complaintId_idx" ON "judge_assignment_attempts"("complaintId");
ALTER TABLE "judge_assignment_attempts" ADD CONSTRAINT "judge_assignment_attempts_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "judge_assignment_attempts" ADD CONSTRAINT "judge_assignment_attempts_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "judge_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "judge_assignment_attempts" ADD CONSTRAINT "judge_assignment_attempts_clerkId_fkey" FOREIGN KEY ("clerkId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
