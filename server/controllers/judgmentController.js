const path = require('path');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { addTimelineEntry } = require('../services/timelineService');
const { fireWorkflowNotification } = require('../services/workflowNotifier');
const { recordAudit } = require('../services/auditService');
const { resolveOnHearingCompleted } = require('../services/escalationService');

// --------------------------------------------------------------------------
// Feature 7: Auto-Publish Judgment
//
// POST /judgments/:complaintId  (Judge) — "Finalize Verdict"
//
// Replaces the old two-step upload-judgment + publish/notify flow with a
// single action: the moment the judge fills in verdict, summary, and
// judgment document and clicks "Finalize Verdict", the system
// atomically:
//   1. Creates the Judgment record
//   2. Sets the complaint status straight to CLOSED (no separate
//      "publish" step exists any more)
//   3. Makes the judgment PDF immediately downloadable on the consumer's
//      dashboard (it already is, via GET /judgments/:complaintId, the
//      moment the Judgment row + CLOSED status both exist)
//   4. Fires the existing email notification to the consumer
//   5. Records an immutable "Verdict Finalized" audit-log timestamp
// --------------------------------------------------------------------------
async function finalizeVerdict(req, res) {
  const { complaintId } = req.params;
  const { summary, verdict } = req.body;

  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId }, include: { judgment: true } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.status !== 'HEARING_COMPLETED') {
    throw ApiError.badRequest('At least one hearing must be completed before finalizing the verdict');
  }
  if (complaint.judgment) throw ApiError.badRequest('A verdict has already been finalized for this complaint');
  if (!req.file) throw ApiError.badRequest('Judgment document is required');
  if (!summary || !verdict) throw ApiError.badRequest('Both a verdict and a summary are required to finalize');

  const judgeProfile = await prisma.judgeProfile.findUnique({ where: { userId: req.user.id } });
  if (!judgeProfile || complaint.assignedJudgeId !== judgeProfile.id) {
    throw ApiError.forbidden('Only the assigned judge can finalize the verdict for this complaint');
  }

  const judgment = await prisma.judgment.create({
    data: {
      complaintId,
      judgeId: judgeProfile.id,
      filePath: path.join('judgments', req.file.filename),
      summary,
      verdict,
    },
  });

  // Status goes straight to CLOSED — finalizing IS the publish action.
  const updated = await prisma.complaint.update({
    where: { id: complaintId },
    data: { status: 'CLOSED', disposedAt: new Date() },
  });

  const finalizedAt = new Date();

  await addTimelineEntry(complaintId, 'CLOSED', `Verdict finalized and published: ${verdict}`, req.user.id);
  await fireWorkflowNotification('JUDGMENT_UPLOADED', { userId: complaint.consumerId, complaintId, complaintNumber: complaint.complaintNumber });
  await fireWorkflowNotification('CASE_CLOSED', { userId: complaint.consumerId, complaintId, complaintNumber: complaint.complaintNumber });

  // Immutable audit-log timestamp of "Verdict Finalized".
  await recordAudit({
    userId: req.user.id,
    action: 'VERDICT_FINALIZED',
    entityType: 'Judgment',
    entityId: judgment.id,
    details: { complaintId, verdict, finalizedAt: finalizedAt.toISOString() },
    ipAddress: req.ip,
  });

  await resolveOnHearingCompleted(complaintId); // Feature 5: clears any escalation flag

  return new ApiResponse(201, { judgment, complaint: updated }, 'Verdict finalized and published to the consumer').send(res);
}

// --------------------------------------------------------------------------
// GET /judgments/:complaintId  — consumer download / anyone with access
// --------------------------------------------------------------------------
async function getJudgment(req, res) {
  const { complaintId } = req.params;
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw ApiError.notFound('Complaint not found');

  if (req.user.role === 'CONSUMER' && complaint.consumerId !== req.user.id) {
    throw ApiError.forbidden('You do not have access to this judgment');
  }

  const judgment = await prisma.judgment.findUnique({ where: { complaintId }, include: { judge: { include: { user: { select: { name: true } } } } } });
  if (!judgment) throw ApiError.notFound('Judgment not yet uploaded for this complaint');

  return new ApiResponse(200, { judgment }).send(res);
}

module.exports = { finalizeVerdict, getJudgment };
