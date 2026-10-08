-- ==========================================================================
-- Migration: clerk priority-routing, auto court fees, multiple opposite
-- parties, post-judgment feedback, judge-absence reassignment workflow,
-- 15-minute hearing slots with lunch break
-- ==========================================================================

-- New enum for reassignment approval workflow
CREATE TYPE "ReassignmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- New notification types
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JUDGE_ABSENCE_ALERT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REASSIGNMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DAILY_CASE_DIGEST';

-- complaints: title, court fee, clerk assignment
ALTER TABLE "complaints" ADD COLUMN "title" TEXT;
ALTER TABLE "complaints" ADD COLUMN "courtFee" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "complaints" ADD COLUMN "assignedClerkId" TEXT;
CREATE INDEX "complaints_assignedClerkId_idx" ON "complaints"("assignedClerkId");
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assignedClerkId_fkey" FOREIGN KEY ("assignedClerkId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- opposite_parties
CREATE TABLE "opposite_parties" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "opposite_parties_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "opposite_parties_complaintId_idx" ON "opposite_parties"("complaintId");
ALTER TABLE "opposite_parties" ADD CONSTRAINT "opposite_parties_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- feedback
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feedback_complaintId_key" ON "feedback"("complaintId");
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- reassignment_requests
CREATE TABLE "reassignment_requests" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "hearingId" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "originalJudgeId" TEXT NOT NULL,
    "recommendedJudgeId" TEXT,
    "recommendedDate" TIMESTAMP(3),
    "recommendedTime" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ReassignmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    CONSTRAINT "reassignment_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reassignment_requests_hearingId_idx" ON "reassignment_requests"("hearingId");
CREATE INDEX "reassignment_requests_status_idx" ON "reassignment_requests"("status");
ALTER TABLE "reassignment_requests" ADD CONSTRAINT "reassignment_requests_hearingId_fkey" FOREIGN KEY ("hearingId") REFERENCES "hearings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reassignment_requests" ADD CONSTRAINT "reassignment_requests_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- forum_settings: court hours, session length, new default 15-minute slot list
ALTER TABLE "forum_settings" ADD COLUMN "sessionDurationMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "forum_settings" ADD COLUMN "courtStartTime" TEXT NOT NULL DEFAULT '10:30 AM';
ALTER TABLE "forum_settings" ADD COLUMN "courtEndTime" TEXT NOT NULL DEFAULT '04:30 PM';
ALTER TABLE "forum_settings" ADD COLUMN "lunchStartTime" TEXT NOT NULL DEFAULT '01:30 PM';
ALTER TABLE "forum_settings" ADD COLUMN "lunchEndTime" TEXT NOT NULL DEFAULT '02:30 PM';

ALTER TABLE "forum_settings" ALTER COLUMN "maxHearingsPerDayDefault" SET DEFAULT 20;
ALTER TABLE "forum_settings" ALTER COLUMN "hearingTimeSlots" SET DEFAULT '["10:30 AM","10:45 AM","11:00 AM","11:15 AM","11:30 AM","11:45 AM","12:00 PM","12:15 PM","12:30 PM","12:45 PM","1:00 PM","1:15 PM","2:30 PM","2:45 PM","3:00 PM","3:15 PM","3:30 PM","3:45 PM","4:00 PM","4:15 PM"]';

-- Migrate any existing rows still on the old 7-slot list to the new schedule
UPDATE "forum_settings" SET "hearingTimeSlots" = '["10:30 AM","10:45 AM","11:00 AM","11:15 AM","11:30 AM","11:45 AM","12:00 PM","12:15 PM","12:30 PM","12:45 PM","1:00 PM","1:15 PM","2:30 PM","2:45 PM","3:00 PM","3:15 PM","3:30 PM","3:45 PM","4:00 PM","4:15 PM"]'::jsonb,
    "maxHearingsPerDayDefault" = 20
WHERE "hearingTimeSlots" = '["10:00 AM","11:00 AM","12:00 PM","02:00 PM","03:00 PM","04:00 PM","04:45 PM"]'::jsonb;

-- Backfill existing complaints' court fee (5% of claim amount)
UPDATE "complaints" SET "courtFee" = ROUND("complaintAmount" * 0.05, 2);
