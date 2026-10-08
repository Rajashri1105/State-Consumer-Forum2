-- ==========================================================================
-- Initial migration: State Consumer Forum Portal
-- ==========================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE "Role" AS ENUM ('CONSUMER', 'CLERK', 'JUDGE', 'ADMIN');
CREATE TYPE "ComplaintStatus" AS ENUM ('SUBMITTED', 'UNDER_VERIFICATION', 'ACCEPTED', 'REJECTED', 'JUDGE_ASSIGNED', 'HEARING_SCHEDULED', 'HEARING_COMPLETED', 'JUDGMENT_UPLOADED', 'DISPOSED', 'CLOSED');
CREATE TYPE "Priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "HearingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'ADJOURNED', 'CANCELLED');
CREATE TYPE "EvidenceType" AS ENUM ('INVOICE', 'WARRANTY', 'IMAGE', 'DOCUMENT', 'OTHER');
CREATE TYPE "NotificationType" AS ENUM ('COMPLAINT_SUBMITTED', 'COMPLAINT_VERIFIED', 'COMPLAINT_ACCEPTED', 'COMPLAINT_REJECTED', 'JUDGE_ASSIGNED', 'HEARING_SCHEDULED', 'HEARING_RESCHEDULED', 'HEARING_ADJOURNED', 'JUDGMENT_UPLOADED', 'CASE_CLOSED', 'SYSTEM');

-- users
CREATE TABLE "users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CONSUMER',
    "profileImage" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "emailVerificationExpiry" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");

-- refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- judge_profiles
CREATE TABLE "judge_profiles" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "designation" TEXT NOT NULL DEFAULT 'Member',
    "courtRoom" TEXT,
    "specialization" TEXT,
    "maxHearingsPerDay" INTEGER NOT NULL DEFAULT 8,
    "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "judge_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "judge_profiles_userId_key" ON "judge_profiles"("userId");

-- judge_availability
CREATE TABLE "judge_availability" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "judgeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "maxHearingsPerDay" INTEGER NOT NULL DEFAULT 8,
    CONSTRAINT "judge_availability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "judge_availability_judgeId_dayOfWeek_key" ON "judge_availability"("judgeId", "dayOfWeek");

-- complaint_categories
CREATE TABLE "complaint_categories" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultPriority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "complaint_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "complaint_categories_name_key" ON "complaint_categories"("name");

-- priority_rules
CREATE TABLE "priority_rules" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "keyword" TEXT NOT NULL,
    "categoryId" TEXT,
    "priority" "Priority" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "priority_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "priority_rules_keyword_idx" ON "priority_rules"("keyword");

-- complaints
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintNumber" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "product" TEXT,
    "service" TEXT,
    "sellerName" TEXT NOT NULL,
    "oppositePartyName" TEXT NOT NULL,
    "oppositePartyAddress" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "complaintAmount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'SUBMITTED',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "isPriorityOverridden" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "rejectionReason" TEXT,
    "assignedJudgeId" TEXT,
    "possibleDuplicateOfId" TEXT,
    "duplicateOverridden" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "disposedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "complaints_complaintNumber_key" ON "complaints"("complaintNumber");
CREATE INDEX "complaints_consumerId_idx" ON "complaints"("consumerId");
CREATE INDEX "complaints_status_idx" ON "complaints"("status");
CREATE INDEX "complaints_priority_idx" ON "complaints"("priority");
CREATE INDEX "complaints_assignedJudgeId_idx" ON "complaints"("assignedJudgeId");
CREATE INDEX "complaints_categoryId_idx" ON "complaints"("categoryId");

-- complaint_timeline
CREATE TABLE "complaint_timeline" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "remarks" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "complaint_timeline_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "complaint_timeline_complaintId_idx" ON "complaint_timeline"("complaintId");

-- evidence
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "evidence_complaintId_idx" ON "evidence"("complaintId");

-- hearings
CREATE TABLE "hearings" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "status" "HearingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "remarks" TEXT,
    "adjournReason" TEXT,
    "noticeFilePath" TEXT,
    "isSystemSuggested" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hearings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hearings_complaintId_idx" ON "hearings"("complaintId");
CREATE INDEX "hearings_judgeId_idx" ON "hearings"("judgeId");
CREATE INDEX "hearings_scheduledDate_idx" ON "hearings"("scheduledDate");

-- judgments
CREATE TABLE "judgments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "judgments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "judgments_complaintId_key" ON "judgments"("complaintId");

-- notifications
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedComplaintId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");

-- holidays
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "isRecurringAnnual" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- forum_settings
CREATE TABLE "forum_settings" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "forumName" TEXT NOT NULL DEFAULT 'State Consumer Disputes Redressal Forum',
    "address" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "maxHearingsPerDayDefault" INTEGER NOT NULL DEFAULT 8,
    "workingDays" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "forum_settings_pkey" PRIMARY KEY ("id")
);

-- ==========================================================================
-- FOREIGN KEYS
-- ==========================================================================

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "judge_profiles" ADD CONSTRAINT "judge_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "judge_availability" ADD CONSTRAINT "judge_availability_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "judge_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "priority_rules" ADD CONSTRAINT "priority_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "complaint_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "complaints" ADD CONSTRAINT "complaints_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "complaint_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assignedJudgeId_fkey" FOREIGN KEY ("assignedJudgeId") REFERENCES "judge_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_possibleDuplicateOfId_fkey" FOREIGN KEY ("possibleDuplicateOfId") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "complaint_timeline" ADD CONSTRAINT "complaint_timeline_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "complaint_timeline" ADD CONSTRAINT "complaint_timeline_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "evidence" ADD CONSTRAINT "evidence_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hearings" ADD CONSTRAINT "hearings_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "judge_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "judgments" ADD CONSTRAINT "judgments_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "judgments" ADD CONSTRAINT "judgments_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "judge_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_relatedComplaintId_fkey" FOREIGN KEY ("relatedComplaintId") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
