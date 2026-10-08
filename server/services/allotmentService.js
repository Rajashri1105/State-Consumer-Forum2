// --------------------------------------------------------------------------
// Bench allotment — replaces the old judge-clerk Yes/No confirmation loop.
//
//   SUBMITTED ──claim──> UNDER_VERIFICATION ──accept──> PENDING_ALLOTMENT
//                              │                              │
//                              ├─ DEFECTIVE (back to consumer)│  auto (least-loaded) or Registrar
//                              └─ REJECTED                    ▼
//                                                      JUDGE_ASSIGNED  (bench + presiding judge set)
//
// Everything after JUDGE_ASSIGNED (hearings, judgment) is scoped to the bench.
// If no bench/judge is available the case waits in the Registrar's queue
// (status NEEDS_MANUAL_ASSIGNMENT).
// --------------------------------------------------------------------------
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { recommendJudge } = require('./workloadBalancerService');
const { notifyUser } = require('./notificationService');
const { addTimelineEntry } = require('./timelineService');
const { fireWorkflowNotification } = require('./workflowNotifier');
const { recordAudit } = require('./auditService');

const REALLOTTABLE_STATUSES = ['JUDGE_ASSIGNED', 'HEARING_SCHEDULED', 'HEARING_COMPLETED'];
const ALLOTTABLE_STATUSES = ['PENDING_ALLOTMENT', 'NEEDS_MANUAL_ASSIGNMENT', ...REALLOTTABLE_STATUSES];

// ------------------------------------------------------------------ claiming
/**
 * Atomic claim: only one scrutiny clerk can win. The WHERE clause is the lock —
 * if another clerk already took it, updateMany touches 0 rows.
 */
async function claimComplaint(complaintId, user) {
  const result = await prisma.complaint.updateMany({
    where: { id: complaintId, status: 'SUBMITTED', assignedClerkId: null },
    data: { assignedClerkId: user.id, status: 'UNDER_VERIFICATION' },
  });
  if (result.count === 0) {
    throw ApiError.conflict('This complaint was already claimed by another clerk or is no longer awaiting scrutiny');
  }
  await addTimelineEntry(complaintId, 'UNDER_VERIFICATION', 'Claimed by a scrutiny clerk for verification.', user.id);
  await recordAudit({ userId: user.id, action: 'COMPLAINT_CLAIMED', entityType: 'Complaint', entityId: complaintId });
  return prisma.complaint.findUnique({ where: { id: complaintId } });
}

/** Hand a claimed complaint back to the shared pool. */
async function releaseComplaint(complaintId, user) {
  const result = await prisma.complaint.updateMany({
    where: { id: complaintId, status: 'UNDER_VERIFICATION', assignedClerkId: user.id },
    data: { assignedClerkId: null, status: 'SUBMITTED' },
  });
  if (result.count === 0) throw ApiError.badRequest('You can only release a complaint that you currently have claimed');
  await addTimelineEntry(complaintId, 'SUBMITTED', 'Released back to the intake queue by the clerk.', user.id, { email: false });
  await recordAudit({ userId: user.id, action: 'COMPLAINT_RELEASED', entityType: 'Complaint', entityId: complaintId });
}

/** Cron: claimed-but-untouched complaints go back to the pool after the timeout. */
async function releaseStaleClaims() {
  const settings = await prisma.forumSettings.findFirst();
  const hours = settings?.claimTimeoutHours ?? 4;
  const cutoff = new Date(Date.now() - hours * 3600 * 1000);

  const stale = await prisma.complaint.findMany({
    where: { status: 'UNDER_VERIFICATION', updatedAt: { lt: cutoff } },
    select: { id: true, assignedClerkId: true },
  });
  for (const c of stale) {
    const r = await prisma.complaint.updateMany({
      where: { id: c.id, status: 'UNDER_VERIFICATION', updatedAt: { lt: cutoff } },
      data: { assignedClerkId: null, status: 'SUBMITTED' },
    });
    if (r.count) {
      await addTimelineEntry(c.id, 'SUBMITTED', `Claim timed out after ${hours}h without action; returned to the intake queue.`, null, { email: false });
      logger.info(`Released stale claim on complaint ${c.id}`);
    }
  }
  return { released: stale.length };
}

// ----------------------------------------------------------------- allotting
async function notifyRegistrars({ title, message, type, complaintId }) {
  const staff = await prisma.user.findMany({ where: { role: { in: ['REGISTRAR', 'ADMIN'] }, isActive: true }, select: { id: true } });
  await Promise.all(staff.map((u) => notifyUser({ userId: u.id, title, message, type, relatedComplaintId: complaintId })));
}

/** Park the case in the Registrar's queue and tell the Registrar why. */
async function escalateToRegistrar(complaintId, actorId, reason) {
  const complaint = await prisma.complaint.update({
    where: { id: complaintId },
    data: { status: 'NEEDS_MANUAL_ASSIGNMENT', needsManualAssignment: true },
  });
  await addTimelineEntry(complaintId, 'NEEDS_MANUAL_ASSIGNMENT', reason, actorId);
  await recordAudit({ userId: actorId, action: 'ESCALATED_TO_REGISTRAR', entityType: 'Complaint', entityId: complaintId, details: { reason } });
  await notifyRegistrars({
    title: 'Manual Bench Allotment Needed',
    message: `Complaint ${complaint.complaintNumber} needs a bench: ${reason}`,
    type: 'MANUAL_ASSIGNMENT_NEEDED',
    complaintId,
  });
  return { complaint, escalated: true };
}

/**
 * Allot (or re-allot) a complaint to a bench.
 *   - judgeId given  -> that judge (and therefore that judge's bench)
 *   - benchId given  -> least-loaded available judge inside that bench
 *   - neither        -> least-loaded available judge across all benches
 * `method`: AUTO_LEAST_LOADED | MANUAL | RECUSAL (set by caller)
 */
async function allotComplaint(complaintId, actor, { judgeId, benchId, method = 'MANUAL', reason } = {}) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (!ALLOTTABLE_STATUSES.includes(complaint.status)) {
    throw ApiError.badRequest(`A complaint in "${complaint.status}" status cannot be allotted to a bench`);
  }

  // ---- choose the judge ----
  let judge;
  if (judgeId) {
    judge = await prisma.judgeProfile.findUnique({ where: { id: judgeId }, include: { user: true, bench: true } });
    if (!judge || !judge.user.isActive) throw ApiError.badRequest('Selected judge does not exist or is inactive');
    if (!judge.benchId || !judge.bench?.isActive) throw ApiError.badRequest('Selected judge is not seated on an active bench');
  } else {
    const exclude = method === 'RECUSAL' && complaint.assignedJudgeId ? [complaint.assignedJudgeId] : [];
    const { recommended } = await recommendJudge({ exclude, benchId: benchId || null });
    if (!recommended) {
      if (method === 'AUTO_LEAST_LOADED') {
        return escalateToRegistrar(complaintId, actor?.id || null, 'No bench with an available judge was found (all judges on leave, inactive, or not seated on a bench).');
      }
      throw ApiError.badRequest('No available judge found for that selection');
    }
    judge = await prisma.judgeProfile.findUnique({ where: { id: recommended.judgeId }, include: { user: true, bench: true } });
  }

  const fromBenchId = complaint.benchId;
  const isReallotment = REALLOTTABLE_STATUSES.includes(complaint.status);

  // ---- re-allotment: scheduled hearings with the old judge are cancelled ----
  let cancelledHearings = 0;
  if (isReallotment) {
    const r = await prisma.hearing.updateMany({
      where: { complaintId, status: 'SCHEDULED' },
      data: { status: 'CANCELLED', remarks: 'Case re-allotted to another bench — to be rescheduled by the new court clerk.' },
    });
    cancelledHearings = r.count;
  }

  const updated = await prisma.complaint.update({
    where: { id: complaintId },
    data: {
      benchId: judge.benchId,
      assignedJudgeId: judge.id,
      status: 'JUDGE_ASSIGNED',
      needsManualAssignment: false,
      // Automatic allotments carry no 'allotted by' person (the scrutiny clerk only accepted the case).
      allottedById: method === 'AUTO_LEAST_LOADED' ? null : (actor?.id || null),
      allottedAt: new Date(),
    },
  });

  await prisma.caseAllotment.create({
    data: {
      complaintId, fromBenchId, toBenchId: judge.benchId, judgeId: judge.id,
      byUserId: actor?.id || null,
      method: isReallotment && method === 'MANUAL' ? 'REASSIGNED' : method,
      reason: reason || null,
    },
  });

  const how = method === 'AUTO_LEAST_LOADED' ? 'automatically (least-loaded bench)' : isReallotment ? 're-allotted by the Registrar' : 'by the Registrar';
  await addTimelineEntry(
    complaintId, 'JUDGE_ASSIGNED',
    `Allotted ${how} to ${judge.bench.name} — ${judge.user.name}.${reason ? ` Reason: ${reason}` : ''}${cancelledHearings ? ` ${cancelledHearings} scheduled hearing(s) cancelled for rescheduling.` : ''}`,
    actor?.id || null,
    // First allotment: the opposite party doesn't know about the case yet (the notice below tells them).
    { audience: isReallotment ? 'BOTH' : 'CONSUMER' }
  );
  await recordAudit({
    userId: actor?.id || null, action: isReallotment ? 'COMPLAINT_REALLOTTED' : 'COMPLAINT_ALLOTTED',
    entityType: 'Complaint', entityId: complaintId,
    details: { fromBenchId, toBenchId: judge.benchId, judgeId: judge.id, method, reason },
  });

  // ---- notifications: consumer, judge, bench court clerks ----
  await fireWorkflowNotification('JUDGE_ASSIGNED', { userId: complaint.consumerId, complaintId, complaintNumber: complaint.complaintNumber });
  await notifyUser({
    userId: judge.user.id,
    title: 'New Case Allotted to Your Bench',
    message: `Complaint ${complaint.complaintNumber} has been allotted to you (${judge.bench.name}).`,
    type: 'JUDGE_ASSIGNED',
    relatedComplaintId: complaintId,
  });
  const courtClerks = await prisma.user.findMany({ where: { role: 'CLERK', clerkType: 'COURT', benchId: judge.benchId, isActive: true }, select: { id: true } });
  await Promise.all(courtClerks.map((c) => notifyUser({
    userId: c.id,
    title: 'New Case on Your Bench',
    message: `Complaint ${complaint.complaintNumber} was allotted to ${judge.bench.name}. Please schedule the first hearing.`,
    type: 'COMPLAINT_ALLOTTED',
    relatedComplaintId: complaintId,
  })));

  // First allotment = the case is admitted to a bench, so serve the notice on the opposite party.
  if (!isReallotment) {
    try {
      await require('./partyService').issueNotice(complaintId, actor);
    } catch (err) {
      logger.error(`Could not serve notice for ${complaint.complaintNumber}: ${err.message}`);
    }
  }

  return { complaint: updated, judge, cancelledHearings };
}

/** Called right after a scrutiny clerk accepts a complaint. */
async function allotAfterAcceptance(complaintId, actor) {
  const settings = await prisma.forumSettings.findFirst();
  if ((settings?.allotmentMode || 'AUTO') === 'MANUAL') {
    await notifyRegistrars({
      title: 'Complaint Awaiting Allotment',
      message: 'A verified complaint is waiting in the allotment queue.',
      type: 'MANUAL_ASSIGNMENT_NEEDED',
      complaintId,
    });
    return { pending: true };
  }
  return allotComplaint(complaintId, actor, { method: 'AUTO_LEAST_LOADED' });
}

/** A judge recuses (conflict of interest): send the case back to the Registrar. */
async function recuseJudge(complaintId, user, reason) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId }, include: { assignedJudge: true } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.assignedJudge?.userId !== user.id) throw ApiError.forbidden('Only the assigned judge can recuse from this case');
  if (complaint.status !== 'JUDGE_ASSIGNED') throw ApiError.badRequest('You can only recuse before a hearing has been scheduled; ask the Registrar to re-allot otherwise');
  if (!reason || !reason.trim()) throw ApiError.badRequest('A reason is required to recuse');

  await prisma.caseAllotment.create({
    data: { complaintId, fromBenchId: complaint.benchId, toBenchId: null, judgeId: complaint.assignedJudgeId, byUserId: user.id, method: 'RECUSAL', reason },
  });
  await prisma.complaint.update({
    where: { id: complaintId },
    data: { assignedJudgeId: null, benchId: null, status: 'NEEDS_MANUAL_ASSIGNMENT', needsManualAssignment: true },
  });
  await addTimelineEntry(complaintId, 'NEEDS_MANUAL_ASSIGNMENT', `Judge recused: ${reason}. Returned to the Registrar for re-allotment.`, user.id);
  await recordAudit({ userId: user.id, action: 'JUDGE_RECUSED', entityType: 'Complaint', entityId: complaintId, details: { reason } });
  await notifyRegistrars({
    title: 'Judge Recusal — Re-allotment Needed',
    message: `${complaint.complaintNumber}: the assigned judge recused (${reason}).`,
    type: 'MANUAL_ASSIGNMENT_NEEDED',
    complaintId,
  });
}

module.exports = {
  claimComplaint, releaseComplaint, releaseStaleClaims,
  allotComplaint, allotAfterAcceptance, escalateToRegistrar, recuseJudge,
  ALLOTTABLE_STATUSES,
};
