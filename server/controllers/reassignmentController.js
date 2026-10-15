const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const prisma = require('../config/db');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { addTimelineEntry } = require('../services/timelineService');
const { fireWorkflowNotification } = require('../services/workflowNotifier');
const { notifyUser } = require('../services/notificationService');
const { recordAudit } = require('../services/auditService');
const { generateHearingNotice } = require('../services/pdfService');
const logger = require('../config/logger');
const { isCourtClerk } = require('../services/scopeService');
const { getHearingDateAvailability, getWorkingDayWindow } = require('../services/schedulingEngine');

const REQUEST_INCLUDE = {
  hearing: {
    include: {
      judge: { include: { user: { select: { name: true } } } },
    },
  },
  complaint: {
    include: {
      consumer: { select: { id: true, name: true, email: true } },
      category: true,
    },
  },
};

// --------------------------------------------------------------------------
// GET /reassignments  (Clerk, Registrar, Admin)
// --------------------------------------------------------------------------
async function listReassignments(req, res) {
  const { status = 'PENDING' } = req.query;

  // Clerks can follow leave cases from their bench, including after the Registrar
  // moves a case to another bench.
  let scope = {};
  if (req.user.role === 'CLERK') {
    if (!isCourtClerk(req.user) || !req.user.benchId) {
      scope = { id: { in: [] } };
    } else {
      const benchJudges = await prisma.judgeProfile.findMany({
        where: { benchId: req.user.benchId },
        select: { id: true },
      });
      scope = {
        OR: [
          { complaint: { benchId: req.user.benchId } },
          { originalJudgeId: { in: benchJudges.map((judge) => judge.id) } },
        ],
      };
    }
  }

  const requests = await prisma.reassignmentRequest.findMany({
    where: {
      ...(status === 'ALL'
        ? {}
        : status === 'ACTIVE'
          ? { status: { in: ['PENDING', 'APPROVED'] } }
          : { status }),
      ...scope,
    },
    include: REQUEST_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  // Attach the original and recommended judge's display names for the UI.
  const judgeIds = [...new Set(requests.flatMap((r) => [r.originalJudgeId, r.recommendedJudgeId].filter(Boolean)))];
  const judges = await prisma.judgeProfile.findMany({
    where: { id: { in: judgeIds } },
    include: { user: { select: { id: true, name: true } } },
  });
  const judgeMap = new Map(judges.map((j) => [j.id, j.user.name]));

  const enriched = requests.map((r) => ({
    ...r,
    originalJudgeName: judgeMap.get(r.originalJudgeId) || 'Unknown',
    recommendedJudgeName: r.recommendedJudgeId ? judgeMap.get(r.recommendedJudgeId) || 'Unknown' : null,
  }));

  return new ApiResponse(200, { requests: enriched }).send(res);
}

// --------------------------------------------------------------------------
// PATCH /reassignments/:id/approve  (Registrar)
// --------------------------------------------------------------------------
async function approveReassignment(req, res) {
  const { id } = req.params;
  const { judgeId, scheduledDate, scheduledTime } = req.body;

  const request = await prisma.reassignmentRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
  if (!request) throw ApiError.notFound('Reassignment request not found');
  if (request.status !== 'PENDING') throw ApiError.badRequest(`This request has already been ${request.status.toLowerCase()}`);

  const finalJudgeId = judgeId || request.recommendedJudgeId;
  const finalDate = scheduledDate || request.recommendedDate;
  const finalTime = scheduledTime || request.recommendedTime;

  if (!finalJudgeId || !finalDate || !finalTime) {
    throw ApiError.badRequest('No recommended slot is available — provide judgeId, scheduledDate, and scheduledTime manually to approve this reassignment');
  }

  const newJudge = await prisma.judgeProfile.findUnique({ where: { id: finalJudgeId }, include: { user: true, bench: true } });
  if (!newJudge) throw ApiError.badRequest('Selected replacement judge does not exist');

  const { firstDate, deadline } = await getWorkingDayWindow(request.createdAt, 2);
  const selectedDate = dayjs(finalDate).startOf('day');
  if (selectedDate.isBefore(dayjs(firstDate).startOf('day')) || selectedDate.isAfter(dayjs(deadline).startOf('day'))) {
    throw ApiError.badRequest('Judge-leave hearings must be rescheduled to a future date within two working days of the leave being recorded.');
  }
  const availability = await getHearingDateAvailability({
    judgeId: finalJudgeId,
    date: finalDate,
    scheduledTime: finalTime,
    excludeHearingId: request.hearingId,
  });
  if (!availability.available) throw ApiError.badRequest(`${availability.reason} Choose another date.`);

  const movesBench = newJudge.benchId !== request.complaint.benchId;

  const updatedHearing = await prisma.hearing.update({
    where: { id: request.hearingId },
    data: {
      judgeId: finalJudgeId,
      scheduledDate: new Date(finalDate),
      scheduledTime: finalTime,
      isSystemSuggested: !judgeId, // true if the Registrar used the system recommendation untouched
    },
    include: { complaint: { include: { consumer: true, category: true } } },
  });

  await prisma.complaint.update({
    where: { id: request.complaintId },
    data: { assignedJudgeId: finalJudgeId, benchId: newJudge.benchId },
  });
  await prisma.caseAllotment.create({
    data: {
      complaintId: request.complaintId, fromBenchId: request.complaint.benchId, toBenchId: newJudge.benchId,
      judgeId: finalJudgeId, byUserId: req.user.id, method: 'REASSIGNED', reason: 'Original judge on leave',
    },
  });
  if (movesBench) {
    const clerks = await prisma.user.findMany({ where: { role: 'CLERK', clerkType: 'COURT', benchId: newJudge.benchId, isActive: true }, select: { id: true } });
    await Promise.all(clerks.map((c) => notifyUser({
      userId: c.id, title: 'Case Moved to Your Bench',
      message: `Complaint ${request.complaint.complaintNumber} was moved to ${newJudge.bench?.name || 'your bench'} because the original judge is on leave.`,
      type: 'COMPLAINT_ALLOTTED', relatedComplaintId: request.complaintId,
    })));
  }

  // Regenerate the hearing notice PDF to reflect the new judge/date.
  try {
    const noticeBytes = await generateHearingNotice(updatedHearing, updatedHearing.complaint);
    const noticeDir = path.join(__dirname, '..', config.upload.dir, 'complaints');
    if (!fs.existsSync(noticeDir)) fs.mkdirSync(noticeDir, { recursive: true });
    const noticeFilename = `notice-${updatedHearing.id}.pdf`;
    fs.writeFileSync(path.join(noticeDir, noticeFilename), noticeBytes);
    await prisma.hearing.update({ where: { id: updatedHearing.id }, data: { noticeFilePath: path.join('complaints', noticeFilename) } });
  } catch (err) {
    logger.error('Failed to regenerate hearing notice after reassignment:', err.message);
  }

  await prisma.reassignmentRequest.update({
    where: { id },
    data: { status: 'APPROVED', resolvedAt: new Date(), resolvedById: req.user.id },
  });

  const dateLabel = `${dayjs(finalDate).format('DD MMM YYYY')} at ${finalTime}`;
  await addTimelineEntry(
    request.complaintId,
    'HEARING_RESCHEDULED',
    `Reassigned to ${newJudge.user.name} following the original judge's leave. New hearing: ${dateLabel}.`,
    req.user.id
  );

  await fireWorkflowNotification('REASSIGNMENT_APPROVED', {
    userId: request.complaint.consumerId,
    complaintId: request.complaintId,
    complaintNumber: request.complaint.complaintNumber,
    extra: `${newJudge.user.name}, ${dateLabel}`,
  });

  await notifyUser({
    userId: newJudge.user.id,
    title: 'New Case Reassigned to You',
    message: `Complaint ${request.complaint.complaintNumber} was reassigned to you (hearing on ${dateLabel}) due to another judge's leave.`,
    type: 'JUDGE_ASSIGNED',
    relatedComplaintId: request.complaintId,
  });

  await recordAudit({ userId: req.user.id, action: 'REASSIGNMENT_APPROVED', entityType: 'ReassignmentRequest', entityId: id, details: { finalJudgeId }, ipAddress: req.ip });

  return new ApiResponse(200, { hearing: updatedHearing }, 'Reassignment approved and consumer notified').send(res);
}

// --------------------------------------------------------------------------
// PATCH /reassignments/:id/reject  (Registrar)
// --------------------------------------------------------------------------
async function rejectReassignment(req, res) {
  const { id } = req.params;
  const request = await prisma.reassignmentRequest.findUnique({ where: { id } });
  if (!request) throw ApiError.notFound('Reassignment request not found');
  if (request.status !== 'PENDING') throw ApiError.badRequest(`This request has already been ${request.status.toLowerCase()}`);

  await prisma.reassignmentRequest.update({
    where: { id },
    data: { status: 'REJECTED', resolvedAt: new Date(), resolvedById: req.user.id },
  });

  await recordAudit({ userId: req.user.id, action: 'REASSIGNMENT_REJECTED', entityType: 'ReassignmentRequest', entityId: id, ipAddress: req.ip });

  return new ApiResponse(200, null, 'Reassignment request rejected — please reschedule this hearing manually').send(res);
}

module.exports = { listReassignments, approveReassignment, rejectReassignment };
