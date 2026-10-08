-- ==========================================================================
-- Migration: judge leave/unavailability, complaint withdrawal,
-- configurable hearing time slots
-- ==========================================================================

-- Add WITHDRAWN to the ComplaintStatus enum
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';

-- judge_leaves
CREATE TABLE "judge_leaves" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "judgeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "judge_leaves_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "judge_leaves_judgeId_idx" ON "judge_leaves"("judgeId");
CREATE INDEX "judge_leaves_startDate_endDate_idx" ON "judge_leaves"("startDate", "endDate");

ALTER TABLE "judge_leaves" ADD CONSTRAINT "judge_leaves_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "judge_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- forum_settings: configurable hearing time slots
ALTER TABLE "forum_settings" ADD COLUMN "hearingTimeSlots" JSONB NOT NULL DEFAULT '["10:00 AM","11:00 AM","12:00 PM","02:00 PM","03:00 PM","04:00 PM","04:45 PM"]';
