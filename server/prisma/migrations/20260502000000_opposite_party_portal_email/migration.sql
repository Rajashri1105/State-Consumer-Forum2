-- ==========================================================================
-- Migration: Opposite-party portal, reply deadlines, settlement, e-mail log
-- ==========================================================================

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OPPOSITE_PARTY';
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'SETTLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CASE_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NOTICE_ISSUED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPLY_FILED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EXTENSION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EXTENSION_DECIDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SETTLEMENT_OFFERED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SETTLEMENT_DECIDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EX_PARTE_ELIGIBLE';

DO $$ BEGIN
    CREATE TYPE "ReplyStatus" AS ENUM ('NOT_APPLICABLE', 'AWAITING_REPLY', 'REPLY_FILED', 'EX_PARTE_ELIGIBLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- complaints
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "oppositePartyEmail" TEXT;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "oppositePartyPhone" TEXT;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "oppositePartyUserId" TEXT;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "noticeIssuedAt" TIMESTAMP(3);
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "replyDueDate" TIMESTAMP(3);
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "replyStatus" "ReplyStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "replyFiledAt" TIMESTAMP(3);
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "extensionDaysGranted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "replyReminder7Sent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "replyReminder1Sent" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "complaints_oppositePartyUserId_idx" ON "complaints"("oppositePartyUserId");

DO $$ BEGIN
    ALTER TABLE "complaints" ADD CONSTRAINT "complaints_oppositePartyUserId_fkey" FOREIGN KEY ("oppositePartyUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "opposite_parties" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- party_replies
CREATE TABLE IF NOT EXISTS "party_replies" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "documents" JSONB NOT NULL DEFAULT '[]',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "party_replies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "party_replies_complaintId_idx" ON "party_replies"("complaintId");

DO $$ BEGIN
    ALTER TABLE "party_replies" ADD CONSTRAINT "party_replies_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- extension_requests
CREATE TABLE IF NOT EXISTS "extension_requests" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "daysRequested" INTEGER NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "daysGranted" INTEGER,
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "extension_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "extension_requests_complaintId_idx" ON "extension_requests"("complaintId");

DO $$ BEGIN
    ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- settlement_offers
CREATE TABLE IF NOT EXISTS "settlement_offers" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "complaintId" TEXT NOT NULL,
    "offeredById" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "terms" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlement_offers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "settlement_offers_complaintId_idx" ON "settlement_offers"("complaintId");

DO $$ BEGIN
    ALTER TABLE "settlement_offers" ADD CONSTRAINT "settlement_offers_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- email_logs
CREATE TABLE IF NOT EXISTS "email_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "event" TEXT,
    "complaintId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "email_logs_createdAt_idx" ON "email_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "email_logs_complaintId_idx" ON "email_logs"("complaintId");
