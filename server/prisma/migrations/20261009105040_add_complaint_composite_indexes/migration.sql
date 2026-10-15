-- DropForeignKey
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_consumerId_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "benches" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "case_allotments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "complaint_categories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "complaint_timeline" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "complaints" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "email_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "evidence" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "extension_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "feedback" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "forum_settings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hearings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "holidays" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "judge_availability" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "judge_leaves" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "judge_profiles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "judgments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notice_deliveries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "opposite_parties" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "party_replies" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "priority_rules" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reassignment_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "settlement_offers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "complaints_status_priority_createdAt_idx" ON "complaints"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "complaints_assignedClerkId_status_idx" ON "complaints"("assignedClerkId", "status");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
