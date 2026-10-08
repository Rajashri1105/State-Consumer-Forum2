const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const prisma = require('../config/db');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { suggestHearingDate } = require('../services/schedulingEngine');
const { addTimelineEntry } = require('../services/timelineService');
const { fireWorkflowNotification } = require('../services/workflowNotifier');
const { notifyUser } = require('../services/notificationService');
const { recordAudit } = require('../services/auditService');
const { generateHearingNotice } = require('../services/pdfService');
const { sendAndLogNotice, getDeliveryStatus, resendChannel } = require('../services/deliveryTrackerService');
const { resolveOnHearingCompleted } = require('../services/escalationService');
const { assertBenchClerkOrOversight, isCourtClerk, getJudgeProfileId } = require('../services/scopeService');

const HEARING_INCLUDE = {
  complaint: {
    include: {
      consumer: { select: { id: true, name: true, email: true, phone: true } },
      category: true,
    },
  },
  judge: { include: { user: { select: { id: true, name: true } }, bench: { select: { id: true, name: true } } } },
  createdBy: { select: { id: true, name: true } },
};

/** A judge may only act on hearings in their own court. */
async function assertOwnHearing(hearing, user) {
  const judgeId = await getJudgeProfileId(user.id);
  if (!judgeId || hearing.judgeId !== judgeId) throw ApiError.forbidden('This hearing is not on your docket');
}

function paginationParams(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

// --------------------------------------------------------------------------
// GET /hearings/suggest?complaintId=...  (Clerk) — Novelty #1 preview
// --------------------------------------------------------------------------
async function getSuggestedDate(req, res) {
  const { complaintId } = req.query;
  if (!complaintId) throw ApiError.badRequest('complaintId is required');

  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  assertBenchClerkOrOversight(complaint, req.user);
  if (!complaint.assignedJudgeId) throw ApiError.badRequest('A judge must be assigned before scheduling a hearing');

  const suggestion = await suggestHearingDate({ judgeId: complaint.assignedJudgeId, priority: complaint.priority });
  if (!suggestion) throw ApiError.badRequest('No available hearing slot found within the search window. Try again later or adjust judge availability.');

  return new ApiResponse(200, { suggestion }, 'Suggested hearing date computed').send(res);
}

// --------------------------------------------------------------------------
// POST /hearings  (Clerk) — Novelty #1: accept suggestion or override
// --------------------------------------------------------------------------
async function scheduleHearing(req, res) {
  const { complaintId, useSuggested = true, scheduledDate, scheduledTime } = req.body;

  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  assertBenchClerkOrOversight(complaint, req.user);
  if (!complaint.assignedJudgeId) throw ApiError.badRequest('A judge must be assigned before scheduling a hearing');
  if (!['JUDGE_ASSIGNED', 'HEARING_COMPLETED'].includes(complaint.status)) {
    throw ApiError.badRequest(`Cannot schedule a hearing while complaint is in "${complaint.status}" status`);
  }

  let finalDate, finalTime, isSystemSuggested;

  if (useSuggested === true || useSuggested === 'true') {
    const suggestion = await suggestHearingDate({ judgeId: complaint.assignedJudgeId, priority: complaint.priority });
    if (!suggestion) throw ApiError.badRequest('No available hearing slot found. Please try a manual date.');
    finalDate = suggestion.suggestedDate;
    finalTime = suggestion.suggestedTime;
    isSystemSuggested = true;
  } else {
    if (!scheduledDate || !scheduledTime) throw ApiError.badRequest('scheduledDate and scheduledTime are required when overriding the suggestion');
    finalDate = new Date(scheduledDate);
    finalTime = scheduledTime;
    isSystemSuggested = false;
  }

  const hearing = await prisma.hearing.create({
    data: {
      complaintId,
      judgeId: complaint.assignedJudgeId,
      scheduledDate: finalDate,
      scheduledTime: finalTime,
      isSystemSuggested,
      createdById: req.user.id,
    },
    include: HEARING_INCLUDE,
  });

  // Auto-generate the hearing notice PDF — no manual authoring/upload needed.
  try {
    const noticeBytes = await generateHearingNotice(hearing, hearing.complaint);
    const noticeDir = path.join(__dirname, '..', config.upload.dir, 'complaints');
    if (!fs.existsSync(noticeDir)) fs.mkdirSync(noticeDir, { recursive: true });
    const noticeFilename = `notice-${hearing.id}.pdf`;
    fs.writeFileSync(path.join(noticeDir, noticeFilename), noticeBytes);
    await prisma.hearing.update({ where: { id: hearing.id }, data: { noticeFilePath: path.join('complaints', noticeFilename) } });
    hearing.noticeFilePath = path.join('complaints', noticeFilename);
  } catch (err) {
    // Notice generation failure must not block the hearing from being scheduled.
    require('../config/logger').error('Failed to auto-generate hearing notice:', err.message);
  }

  // Feature 4: Notice Delivery Tracker — log SMS + Email delivery status.
  await sendAndLogNotice(hearing, hearing.complaint);

  await prisma.complaint.update({ where: { id: complaintId }, data: { status: 'HEARING_SCHEDULED' } });
  await addTimelineEntry(complaintId, 'HEARING_SCHEDULED', `Hearing scheduled for ${dayjs(finalDate).format('DD MMM YYYY')} at ${finalTime}${isSystemSuggested ? ' (system-suggested)' : ' (manually set by clerk)'}.`, req.user.id, { audience: 'PARTY' });
  await fireWorkflowNotification('HEARING_SCHEDULED', {
    userId: complaint.consumerId,
    complaintId,
    complaintNumber: complaint.complaintNumber,
    extra: `${dayjs(finalDate).format('DD MMM YYYY')} at ${finalTime}`,
  });
  await notifyUser({
    userId: hearing.judge.user.id,
    title: 'Hearing Scheduled — Case on Your Docket',
    message: `${hearing.complaint.title || complaint.complaintNumber}: hearing set for ${dayjs(finalDate).format('DD MMM YYYY')} at ${finalTime}.`,
    type: 'HEARING_SCHEDULED',
    relatedComplaintId: complaintId,
  });
  await recordAudit({ userId: req.user.id, action: 'HEARING_SCHEDULED', entityType: 'Hearing', entityId: hearing.id, ipAddress: req.ip });

  return new ApiResponse(201, { hearing }, 'Hearing scheduled successfully').send(res);
}

// --------------------------------------------------------------------------
// PATCH /hearings/:id/reschedule  (Clerk)
// --------------------------------------------------------------------------
async function rescheduleHearing(req, res) {
  const { id } = req.params;
  const { scheduledDate, scheduledTime, remarks } = req.body;

  const hearing = await prisma.hearing.findUnique({ where: { id }, include: { complaint: true } });
  if (!hearing) throw ApiError.notFound('Hearing not found');
  assertBenchClerkOrOversight(hearing.complaint, req.user);
  if (hearing.status !== 'SCHEDULED') throw ApiError.badRequest('Only scheduled hearings can be rescheduled');

  const updated = await prisma.hearing.update({
    where: { id },
    data: { scheduledDate: new Date(scheduledDate), scheduledTime, remarks, isSystemSuggested: false },
    include: HEARING_INCLUDE,
  });

  try {
    const noticeBytes = await generateHearingNotice(updated, updated.complaint);
    const noticeDir = path.join(__dirname, '..', config.upload.dir, 'complaints');
    if (!fs.existsSync(noticeDir)) fs.mkdirSync(noticeDir, { recursive: true });
    const noticeFilename = `notice-${updated.id}.pdf`;
    fs.writeFileSync(path.join(noticeDir, noticeFilename), noticeBytes);
    await prisma.hearing.update({ where: { id: updated.id }, data: { noticeFilePath: path.join('complaints', noticeFilename) } });
    updated.noticeFilePath = path.join('complaints', noticeFilename);
  } catch (err) {
    require('../config/logger').error('Failed to regenerate hearing notice:', err.message);
  }

  // Feature 4: log delivery status for the re-issued notice.
  await sendAndLogNotice(updated, updated.complaint);

  await addTimelineEntry(hearing.complaintId, 'HEARING_RESCHEDULED', `Rescheduled to ${dayjs(scheduledDate).format('DD MMM YYYY')} at ${scheduledTime}.`, req.user.id, { audience: 'PARTY' });
  await fireWorkflowNotification('HEARING_RESCHEDULED', {
    userId: hearing.complaint.consumerId,
    complaintId: hearing.complaintId,
    complaintNumber: hearing.complaint.complaintNumber,
    extra: `${dayjs(scheduledDate).format('DD MMM YYYY')} at ${scheduledTime}`,
  });
  await notifyUser({
    userId: updated.judge.user.id,
    title: 'Hearing Rescheduled',
    message: `${updated.complaint.title || hearing.complaint.complaintNumber}: hearing moved to ${dayjs(scheduledDate).format('DD MMM YYYY')} at ${scheduledTime}.`,
    type: 'HEARING_RESCHEDULED',
    relatedComplaintId: hearing.complaintId,
  });
  await recordAudit({ userId: req.user.id, action: 'HEARING_RESCHEDULED', entityType: 'Hearing', entityId: id, ipAddress: req.ip });

  return new ApiResponse(200, { hearing: updated }, 'Hearing rescheduled').send(res);
}

// --------------------------------------------------------------------------
// PATCH /hearings/:id/adjourn  (Judge)
// --------------------------------------------------------------------------
async function adjournHearing(req, res) {
  const { id } = req.params;
  const { adjournReason } = req.body;

  const hearing = await prisma.hearing.findUnique({ where: { id }, include: { complaint: true } });
  if (!hearing) throw ApiError.notFound('Hearing not found');
  await assertOwnHearing(hearing, req.user);
  if (hearing.status !== 'SCHEDULED') throw ApiError.badRequest('Only scheduled hearings can be adjourned');

  const updated = await prisma.hearing.update({
    where: { id },
    data: { status: 'ADJOURNED', adjournReason },
    include: HEARING_INCLUDE,
  });

  await addTimelineEntry(hearing.complaintId, 'HEARING_ADJOURNED', adjournReason, req.user.id);
  await fireWorkflowNotification('HEARING_ADJOURNED', {
    userId: hearing.complaint.consumerId,
    complaintId: hearing.complaintId,
    complaintNumber: hearing.complaint.complaintNumber,
    extra: adjournReason,
  });
  await recordAudit({ userId: req.user.id, action: 'HEARING_ADJOURNED', entityType: 'Hearing', entityId: id, ipAddress: req.ip });

  return new ApiResponse(200, { hearing: updated }, 'Hearing adjourned').send(res);
}

// --------------------------------------------------------------------------
// PATCH /hearings/:id/complete  (Judge) — add remarks & mark completed
// --------------------------------------------------------------------------
async function completeHearing(req, res) {
  const { id } = req.params;
  const { remarks } = req.body;

  const hearing = await prisma.hearing.findUnique({ where: { id }, include: { complaint: true } });
  if (!hearing) throw ApiError.notFound('Hearing not found');
  await assertOwnHearing(hearing, req.user);
  if (hearing.status !== 'SCHEDULED') throw ApiError.badRequest('Only scheduled hearings can be marked completed');

  const updated = await prisma.hearing.update({
    where: { id },
    data: { status: 'COMPLETED', remarks },
    include: HEARING_INCLUDE,
  });

  await prisma.complaint.update({ where: { id: hearing.complaintId }, data: { status: 'HEARING_COMPLETED' } });
  await addTimelineEntry(hearing.complaintId, 'HEARING_COMPLETED', remarks, req.user.id);
  await recordAudit({ userId: req.user.id, action: 'HEARING_COMPLETED', entityType: 'Hearing', entityId: id, ipAddress: req.ip });
  await resolveOnHearingCompleted(hearing.complaintId); // Feature 5: resolves any "Delayed" flag

  return new ApiResponse(200, { hearing: updated }, 'Hearing marked as completed').send(res);
}

// --------------------------------------------------------------------------
// GET /hearings/:id/notice-status  — Feature 4 per-channel delivery log
// --------------------------------------------------------------------------
async function getNoticeStatus(req, res) {
  const { id } = req.params;
  const deliveries = await getDeliveryStatus(id);
  return new ApiResponse(200, { deliveries }).send(res);
}

// --------------------------------------------------------------------------
// POST /hearings/:id/notice-status/:channel/resend  (Clerk) — Feature 4
// --------------------------------------------------------------------------
async function resendNotice(req, res) {
  const { id, channel } = req.params;
  const hearing = await prisma.hearing.findUnique({ where: { id }, include: { complaint: true } });
  if (!hearing) throw ApiError.notFound('Hearing not found');
  assertBenchClerkOrOversight(hearing.complaint, req.user);
  const delivery = await resendChannel(id, channel.toUpperCase());
  await recordAudit({ userId: req.user.id, action: 'NOTICE_RESENT', entityType: 'Hearing', entityId: id, details: { channel: channel.toUpperCase() }, ipAddress: req.ip });
  return new ApiResponse(200, { delivery }, `Notice resent over ${channel.toUpperCase()}`).send(res);
}

// --------------------------------------------------------------------------
// GET /hearings/calendar  — monthly/weekly hearing list, role-aware
// --------------------------------------------------------------------------
async function getCalendar(req, res) {
  const { from, to } = req.query;
  const rangeStart = from ? dayjs(from).startOf('day').toDate() : dayjs().startOf('month').toDate();
  const rangeEnd = to ? dayjs(to).endOf('day').toDate() : dayjs().endOf('month').toDate();

  const where = { scheduledDate: { gte: rangeStart, lte: rangeEnd } };

  if (req.user.role === 'JUDGE') {
    const judgeProfile = await prisma.judgeProfile.findUnique({ where: { userId: req.user.id } });
    if (!judgeProfile) throw ApiError.forbidden('Judge profile not found');
    where.judgeId = judgeProfile.id;
  } else if (req.user.role === 'CONSUMER') {
    where.complaint = { consumerId: req.user.id };
  } else if (req.user.role === 'CLERK') {
    // Court clerks see their own bench's cause list; scrutiny clerks have no hearings.
    if (isCourtClerk(req.user) && req.user.benchId) where.judge = { benchId: req.user.benchId };
    else where.id = { in: [] };
  } else if (req.query.benchId) {
    // Registrar / Admin may narrow to one bench.
    where.judge = { benchId: req.query.benchId };
  }

  const hearings = await prisma.hearing.findMany({ where, include: HEARING_INCLUDE, orderBy: { scheduledDate: 'asc' } });

  return new ApiResponse(200, {
    hearings,
    today: hearings.filter((h) => dayjs(h.scheduledDate).isSame(dayjs(), 'day')),
    upcoming: hearings.filter((h) => dayjs(h.scheduledDate).isAfter(dayjs(), 'day') && h.status === 'SCHEDULED'),
    completed: hearings.filter((h) => h.status === 'COMPLETED'),
    adjourned: hearings.filter((h) => h.status === 'ADJOURNED'),
  }).send(res);
}

module.exports = {
  getSuggestedDate,
  scheduleHearing,
  rescheduleHearing,
  adjournHearing,
  completeHearing,
  getCalendar,
  getNoticeStatus,
  resendNotice,
};
