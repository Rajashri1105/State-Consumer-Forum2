const prisma = require('../config/db');
const logger = require('../config/logger');

const TIMELINE_STAGES = {
  SUBMITTED: 'Complaint Submitted',
  UNDER_VERIFICATION: 'Verification',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  DEFECTIVE: 'Returned as Defective',
  PENDING_ALLOTMENT: 'Awaiting Bench Allotment',
  NEEDS_MANUAL_ASSIGNMENT: 'Awaiting Registrar Allotment',
  JUDGE_ASSIGNED: 'Allotted to Bench',
  HEARING_SCHEDULED: 'Hearing Scheduled',
  HEARING_RESCHEDULED: 'Hearing Rescheduled',
  HEARING_ADJOURNED: 'Hearing Adjourned',
  HEARING_COMPLETED: 'Hearing Completed',
  JUDGMENT_UPLOADED: 'Judgment Uploaded',
  DISPOSED: 'Case Disposed',
  CLOSED: 'Case Closed',
  WITHDRAWN: 'Complaint Withdrawn',
  SETTLED: 'Case Settled',
  NOTICE_ISSUED: 'Notice Served on Opposite Party',
  NOTICE_NOT_SERVED: 'Notice Could Not Be Served Online',
  REPLY_FILED: 'Opposite Party Reply Filed',
  EXTENSION_REQUESTED: 'Extension Requested',
  EXTENSION_GRANTED: 'Extension Granted',
  EXTENSION_REJECTED: 'Extension Refused',
  EX_PARTE_ELIGIBLE: 'Reply Deadline Missed',
  SETTLEMENT_OFFERED: 'Settlement Offered',
  SETTLEMENT_ACCEPTED: 'Settlement Accepted',
  SETTLEMENT_REJECTED: 'Settlement Rejected',
  SETTLEMENT_WITHDRAWN: 'Settlement Withdrawn',
};

/**
 * Records a step on the case timeline AND e-mails the parties about it.
 * opts.email === false  -> internal housekeeping entry, no e-mail
 * opts.audience         -> 'CONSUMER' | 'PARTY' | 'BOTH' (default BOTH)
 */
async function addTimelineEntry(complaintId, stageKey, remarks = null, actorId = null, opts = {}) {
  const entry = await prisma.complaintTimeline.create({
    data: {
      complaintId,
      stage: TIMELINE_STAGES[stageKey] || stageKey,
      remarks,
      actorId,
    },
  });

  if (opts.email !== false) {
    // Lazy require avoids a circular import (caseMailer -> notificationService -> db).
    const { notifyCaseParties } = require('./caseMailer');
    // Fire-and-forget: a slow or failing mail server must never slow down or break the action.
    notifyCaseParties(complaintId, stageKey, remarks, { audience: opts.audience, setupUrl: opts.setupUrl })
      .catch((err) => logger.error(`Case e-mail for ${stageKey} failed: ${err.message}`));
  }
  return entry;
}

async function getTimeline(complaintId) {
  return prisma.complaintTimeline.findMany({
    where: { complaintId },
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
}

module.exports = { addTimelineEntry, getTimeline, TIMELINE_STAGES };
