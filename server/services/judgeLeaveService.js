const prisma = require('../config/db');
const logger = require('../config/logger');

/**
 * Checks whether a judge is on marked leave for a given date.
 * Used by the scheduling engine to skip those dates when suggesting hearings.
 */
async function isJudgeOnLeave(judgeId, date) {
  const count = await prisma.judgeLeave.count({
    where: { judgeId, startDate: { lte: date }, endDate: { gte: date } },
  });
  return count > 0;
}

/**
 * Returns leave records covering a given date (used by the availability
 * panel so clerks can see at a glance which judges are out).
 */
async function getJudgesOnLeave(date = new Date()) {
  return prisma.judgeLeave.findMany({
    where: { startDate: { lte: date }, endDate: { gte: date } },
    include: { judge: { include: { user: { select: { id: true, name: true } } } } },
  });
}

/**
 * Creates a leave record and — critically — checks whether any hearings are
 * already SCHEDULED for that judge within the leave window. For each one,
 * it immediately computes a recommended replacement judge/slot (same day if
 * possible) and stores it as a pending ReassignmentRequest for the clerk to
 * review and approve, and notifies the relevant clerk(s) of the absence
 * right away.
 */
async function createLeave({ judgeId, startDate, endDate, reason, createdById }) {
  // Required lazily to sidestep a require-cycle at module load time
  // (schedulingEngine -> workloadBalancerService; neither touches this
  // file, but keeping this require local is a cheap extra safety net).
  const { suggestReplacementJudge } = require('./schedulingEngine');
  const { notifyUser } = require('./notificationService');

  const leave = await prisma.judgeLeave.create({
    data: { judgeId, startDate: new Date(startDate), endDate: new Date(endDate), reason, createdById },
  });

  const conflictingHearings = await prisma.hearing.findMany({
    where: {
      judgeId,
      status: 'SCHEDULED',
      scheduledDate: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    include: {
      complaint: { select: { id: true, complaintNumber: true, oppositePartyName: true, priority: true, benchId: true } },
    },
  });

  const judgeProfile = await prisma.judgeProfile.findUnique({ where: { id: judgeId }, include: { user: true } });
  const reassignmentRequests = [];

  for (const hearing of conflictingHearings) {
    let recommendation = null;
    try {
      recommendation = await suggestReplacementJudge({
        excludeJudgeId: judgeId,
        preferredDate: hearing.scheduledDate,
        priority: hearing.complaint.priority,
        preferBenchId: hearing.complaint.benchId || judgeProfile?.benchId || null,
      });
    } catch (err) {
      logger.error('Failed to compute replacement judge recommendation:', err.message);
    }

    const request = await prisma.reassignmentRequest.create({
      data: {
        hearingId: hearing.id,
        complaintId: hearing.complaintId,
        originalJudgeId: judgeId,
        recommendedJudgeId: recommendation?.judgeId || null,
        recommendedDate: recommendation?.suggestedDate || null,
        recommendedTime: recommendation?.suggestedTime || null,
        reason: `${judgeProfile?.user?.name || 'The assigned judge'} is on leave (${reason}) during the scheduled hearing date.`,
      },
    });
    reassignmentRequests.push(request);

    // Notify the court clerk(s) of the judge's bench, plus the Registrar(s) who
    // handle any cross-bench move, so the absence shows up in their feed at once.
    const staff = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: 'CLERK', clerkType: 'COURT', benchId: hearing.complaint.benchId || judgeProfile?.benchId || '__none__' },
          { role: 'REGISTRAR' },
        ],
      },
      select: { id: true },
    });
    const clerkIds = staff.map((u) => u.id);

    for (const clerkId of clerkIds) {
      await notifyUser({
        userId: clerkId,
        title: 'Judge Absence — Hearing Needs Reassignment',
        message: `${judgeProfile?.user?.name || 'A judge'} is on leave and has a scheduled hearing for complaint ${hearing.complaint.complaintNumber}. ${recommendation ? `Recommended: ${recommendation.judgeName} on the same/next available date.` : 'No automatic replacement slot was found — please reassign manually.'}`,
        type: 'JUDGE_ABSENCE_ALERT',
        relatedComplaintId: hearing.complaintId,
      });
    }
  }

  return { leave, conflictingHearings, reassignmentRequests };
}

async function listLeavesForJudge(judgeId) {
  return prisma.judgeLeave.findMany({ where: { judgeId }, orderBy: { startDate: 'desc' } });
}

async function listAllLeaves() {
  return prisma.judgeLeave.findMany({
    include: { judge: { include: { user: { select: { id: true, name: true } } } } },
    orderBy: { startDate: 'desc' },
  });
}

async function deleteLeave(id) {
  return prisma.judgeLeave.delete({ where: { id } });
}

module.exports = { isJudgeOnLeave, getJudgesOnLeave, createLeave, listLeavesForJudge, listAllLeaves, deleteLeave };
