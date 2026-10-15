const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const prisma = require('../config/db');
const logger = require('../config/logger');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { addTimelineEntry } = require('../services/timelineService');
const { fireWorkflowNotification } = require('../services/workflowNotifier');
const { recordAudit } = require('../services/auditService');
const { resolveOnHearingCompleted } = require('../services/escalationService');
const { generateFinalJudgmentPdf } = require('../services/pdfService');
const { assertComplaintAccess, assertBenchClerkOrOversight, isCourtClerk } = require('../services/scopeService');

async function submitVerdict(req, res) {
  const { complaintId } = req.params;
  const { summary, verdict } = req.body;

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: { judgment: true },
  });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.status !== 'HEARING_COMPLETED') {
    throw ApiError.badRequest('The verdict can only be submitted after a hearing is completed');
  }
  if (complaint.judgment) throw ApiError.badRequest('A verdict has already been submitted for this complaint');

  const judgeProfile = await prisma.judgeProfile.findUnique({ where: { userId: req.user.id } });
  if (!judgeProfile || complaint.assignedJudgeId !== judgeProfile.id) {
    throw ApiError.forbidden('Only the assigned judge can submit the verdict for this complaint');
  }

  const { judgment, updatedComplaint } = await prisma.$transaction(async (tx) => {
    const createdJudgment = await tx.judgment.create({
      data: { complaintId, judgeId: judgeProfile.id, summary, verdict },
    });
    const updated = await tx.complaint.updateMany({
      where: { id: complaintId, status: 'HEARING_COMPLETED', assignedJudgeId: judgeProfile.id },
      data: { status: 'JUDGMENT_UPLOADED' },
    });
    if (updated.count !== 1) throw ApiError.conflict('The complaint changed while the verdict was being submitted');
    const changedComplaint = await tx.complaint.findUnique({ where: { id: complaintId } });
    return { judgment: createdJudgment, updatedComplaint: changedComplaint };
  });

  await addTimelineEntry(
    complaintId,
    'JUDGMENT_UPLOADED',
    'The judge submitted the verdict and summary. The court clerk will prepare the final judgment document.',
    req.user.id,
    { email: false }
  );
  await recordAudit({
    userId: req.user.id,
    action: 'VERDICT_SUBMITTED',
    entityType: 'Judgment',
    entityId: judgment.id,
    details: { complaintId, verdict },
    ipAddress: req.ip,
  });

  return new ApiResponse(201, { judgment, complaint: updatedComplaint }, 'Verdict submitted for final document preparation').send(res);
}

async function finalizeJudgmentDocument(req, res) {
  const { complaintId } = req.params;
  const { consumerPresent, oppositePartyPresent, witnessDetails, advocateDetails } = req.body;

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: {
      judgment: true,
      consumer: { select: { name: true } },
      assignedJudge: { include: { user: { select: { name: true } } } },
      bench: { select: { name: true } },
    },
  });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  assertBenchClerkOrOversight(complaint, req.user);
  if (!isCourtClerk(req.user)) throw ApiError.forbidden('Only the court clerk can prepare the final judgment document');
  if (complaint.status !== 'JUDGMENT_UPLOADED' || !complaint.judgment) {
    throw ApiError.badRequest('The judge must submit the verdict before the final document can be prepared');
  }
  if (complaint.judgment.filePath) throw ApiError.conflict('The final judgment document has already been published');

  const orderDate = new Date();
  const attendance = { consumerPresent, oppositePartyPresent, witnessDetails, advocateDetails };
  const pdfBytes = await generateFinalJudgmentPdf(complaint, complaint.judgment, attendance, orderDate);
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;
  const filePath = path.join('judgments', fileName);
  const absoluteFilePath = path.join(__dirname, '..', config.upload.dir, filePath);
  await fs.promises.mkdir(path.dirname(absoluteFilePath), { recursive: true });
  await fs.promises.writeFile(absoluteFilePath, pdfBytes);

  let finalized;
  try {
    finalized = await prisma.$transaction(async (tx) => {
      const updatedJudgment = await tx.judgment.update({
        where: { complaintId },
        data: {
          filePath,
          consumerPresent,
          oppositePartyPresent,
          witnessDetails,
          advocateDetails,
          orderDate,
        },
      });
      const updated = await tx.complaint.updateMany({
        where: { id: complaintId, status: 'JUDGMENT_UPLOADED' },
        data: { status: 'CLOSED', disposedAt: orderDate },
      });
      if (updated.count !== 1) throw ApiError.conflict('The complaint changed while the final judgment was being published');
      const changedComplaint = await tx.complaint.findUnique({ where: { id: complaintId } });
      return { judgment: updatedJudgment, updatedComplaint: changedComplaint };
    });
  } catch (err) {
    try {
      await fs.promises.unlink(absoluteFilePath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') logger.error(`Could not remove unpublished judgment PDF: ${cleanupError.message}`);
    }
    throw err;
  }

  const { judgment, updatedComplaint } = finalized;
  await addTimelineEntry(
    complaintId,
    'FINAL_JUDGMENT_PUBLISHED',
    [
      `${judgment.verdict}. ${judgment.summary}`,
      `Bench: ${complaint.bench?.name || '—'} | Case type: ${complaint.caseType === 'APPEAL' ? 'Appeal' : 'New Complaint'} | Filed: ${complaint.submittedAt.toISOString().slice(0, 10)} | Ordered: ${orderDate.toISOString().slice(0, 10)}`,
      `Consumer: ${complaint.consumer?.name || '—'} (${consumerPresent ? 'Present' : 'Absent'}); Opposite party: ${complaint.oppositePartyName} (${oppositePartyPresent ? 'Present' : 'Absent'})`,
      `Witness(es): ${witnessDetails}; Advocate(s): ${advocateDetails}; Judge: ${complaint.assignedJudge?.user?.name || '—'}`,
    ].join('\n'),
    req.user.id
  );
  await fireWorkflowNotification('JUDGMENT_UPLOADED', {
    userId: complaint.consumerId,
    complaintId,
    complaintNumber: complaint.complaintNumber,
  });
  await fireWorkflowNotification('CASE_CLOSED', {
    userId: complaint.consumerId,
    complaintId,
    complaintNumber: complaint.complaintNumber,
  });
  await recordAudit({
    userId: req.user.id,
    action: 'FINAL_JUDGMENT_PUBLISHED',
    entityType: 'Judgment',
    entityId: judgment.id,
    details: { complaintId, filePath, orderDate: orderDate.toISOString() },
    ipAddress: req.ip,
  });
  await resolveOnHearingCompleted(complaintId);

  return new ApiResponse(200, { judgment, complaint: updatedComplaint }, 'Final judgment document published').send(res);
}

async function getJudgment(req, res) {
  const { complaintId } = req.params;
  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: { assignedJudge: { include: { user: { select: { id: true } } } } },
  });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  assertComplaintAccess(complaint, req.user);

  const judgment = await prisma.judgment.findUnique({
    where: { complaintId },
    include: { judge: { include: { user: { select: { name: true } } } } },
  });
  if (!judgment || (!judgment.filePath && ['CONSUMER', 'OPPOSITE_PARTY'].includes(req.user.role))) {
    throw ApiError.notFound('Final judgment document is not yet available');
  }

  return new ApiResponse(200, { judgment }).send(res);
}

module.exports = { submitVerdict, finalizeJudgmentDocument, getJudgment };
