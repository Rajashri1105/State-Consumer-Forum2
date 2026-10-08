// --------------------------------------------------------------------------
// Feature 5: Escalation Alert for Overdue Hearings
//
// A complaint is flagged "Delayed — needs attention" when either:
//   (a) it has been adjourned more than 2 times, OR
//   (b) no action has been taken on it for more than X days
//       (configurable via ForumSettings.overdueThresholdDays, default 30)
//
// Runs as a sweep (triggered on page load via the Clerk queue / Admin
// dashboard GET endpoints, and additionally on a scheduled cron job — see
// server.js) rather than as a live join on every read, so that flag
// raised/resolved transitions can be written to the audit log exactly
// once per transition.
// --------------------------------------------------------------------------

const dayjs = require('dayjs');
const prisma = require('../config/db');
const { recordAudit } = require('./auditService');
const logger = require('../config/logger');

const TERMINAL_STATUSES = ['REJECTED', 'DISPOSED', 'CLOSED', 'WITHDRAWN', 'SETTLED'];

async function getThresholdDays() {
  const settings = await prisma.forumSettings.findFirst();
  return settings?.overdueThresholdDays ?? 30;
}

/**
 * Determines whether a single complaint should currently be flagged,
 * and why. `lastActionAt` is the most recent of: complaint.updatedAt,
 * its latest timeline entry, or its latest hearing update.
 */
async function evaluateComplaint(complaint, thresholdDays) {
  if (TERMINAL_STATUSES.includes(complaint.status)) return { shouldFlag: false, reason: null };

  const adjournedCount = await prisma.hearing.count({ where: { complaintId: complaint.id, status: 'ADJOURNED' } });

  const [latestTimeline, latestHearing] = await Promise.all([
    prisma.complaintTimeline.findFirst({ where: { complaintId: complaint.id }, orderBy: { createdAt: 'desc' } }),
    prisma.hearing.findFirst({ where: { complaintId: complaint.id }, orderBy: { updatedAt: 'desc' } }),
  ]);

  const candidateDates = [complaint.updatedAt, latestTimeline?.createdAt, latestHearing?.updatedAt].filter(Boolean);
  const lastActionAt = candidateDates.length ? new Date(Math.max(...candidateDates.map((d) => new Date(d).getTime()))) : complaint.submittedAt;
  const daysSinceLastAction = dayjs().diff(dayjs(lastActionAt), 'day');

  if (adjournedCount > 2) {
    return { shouldFlag: true, reason: `Adjourned ${adjournedCount} times (more than the 2-adjournment threshold).` };
  }
  if (daysSinceLastAction > thresholdDays) {
    return { shouldFlag: true, reason: `No action taken for ${daysSinceLastAction} days (threshold: ${thresholdDays} days).` };
  }
  return { shouldFlag: false, reason: null };
}

/**
 * Sweeps every non-terminal complaint, updates isDelayed/delayReason/
 * delayFlaggedAt/delayResolvedAt, and writes an audit log entry exactly
 * when a flag is raised or resolved (not on every sweep).
 */
async function runEscalationSweep() {
  const thresholdDays = await getThresholdDays();
  const complaints = await prisma.complaint.findMany({
    where: { status: { notIn: TERMINAL_STATUSES } },
    select: { id: true, status: true, updatedAt: true, submittedAt: true, isDelayed: true, complaintNumber: true },
  });

  let flaggedCount = 0;
  let resolvedCount = 0;

  for (const complaint of complaints) {
    try {
      const { shouldFlag, reason } = await evaluateComplaint(complaint, thresholdDays);

      if (shouldFlag && !complaint.isDelayed) {
        await prisma.complaint.update({
          where: { id: complaint.id },
          data: { isDelayed: true, delayReason: reason, delayFlaggedAt: new Date(), delayResolvedAt: null },
        });
        await recordAudit({ action: 'ESCALATION_FLAGGED', entityType: 'Complaint', entityId: complaint.id, details: { reason } });
        flaggedCount += 1;
      } else if (!shouldFlag && complaint.isDelayed) {
        await prisma.complaint.update({
          where: { id: complaint.id },
          data: { isDelayed: false, delayResolvedAt: new Date() },
        });
        await recordAudit({ action: 'ESCALATION_RESOLVED', entityType: 'Complaint', entityId: complaint.id });
        resolvedCount += 1;
      }
    } catch (err) {
      logger.error(`Escalation sweep failed for complaint ${complaint.id}:`, err.message);
    }
  }

  logger.info(`Escalation sweep complete: ${flaggedCount} newly flagged, ${resolvedCount} resolved.`);
  return { flaggedCount, resolvedCount, checked: complaints.length };
}

/**
 * A hearing being marked COMPLETED resolves the escalation flag
 * immediately (per the feature spec: "resolved (hearing successfully
 * completed)") rather than waiting for the next sweep.
 */
async function resolveOnHearingCompleted(complaintId) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId }, select: { isDelayed: true } });
  if (complaint?.isDelayed) {
    await prisma.complaint.update({ where: { id: complaintId }, data: { isDelayed: false, delayResolvedAt: new Date() } });
    await recordAudit({ action: 'ESCALATION_RESOLVED', entityType: 'Complaint', entityId: complaintId, details: { trigger: 'HEARING_COMPLETED' } });
  }
}

module.exports = { runEscalationSweep, resolveOnHearingCompleted, evaluateComplaint };
