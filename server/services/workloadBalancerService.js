const dayjs = require('dayjs');
const prisma = require('../config/db');

const ACTIVE_STATUSES = ['JUDGE_ASSIGNED', 'HEARING_SCHEDULED', 'HEARING_COMPLETED'];

/**
 * Computes workload statistics for every active judge and ranks them
 * from least to most loaded. Weighted score = pendingCases * 2 +
 * hearingsToday * 3 (today's hearings weigh more since they represent
 * immediate load) + hearingsThisWeek * 1.
 *
 * @param {{categoryId?: string}} options Optionally factor in judges who
 *   already specialize in / are handling a given category (informational only).
 */
async function getJudgeWorkloadStats() {
  const judges = await prisma.judgeProfile.findMany({
    include: {
      user: { select: { id: true, name: true, isActive: true } },
      bench: { select: { id: true, name: true, isActive: true } },
    },
  });
  const onLeaveRows = await prisma.judgeLeave.findMany({
    where: { startDate: { lte: new Date() }, endDate: { gte: new Date() } },
    select: { judgeId: true },
  });
  const onLeaveIds = new Set(onLeaveRows.map((l) => l.judgeId));

  const todayStart = dayjs().startOf('day').toDate();
  const todayEnd = dayjs().endOf('day').toDate();
  const weekStart = dayjs().startOf('week').toDate();
  const weekEnd = dayjs().endOf('week').toDate();

  const stats = [];
  for (const judge of judges) {
    if (!judge.user.isActive) continue;

    const [pendingCases, hearingsToday, hearingsThisWeek] = await Promise.all([
      prisma.complaint.count({ where: { assignedJudgeId: judge.id, status: { in: ACTIVE_STATUSES } } }),
      prisma.hearing.count({ where: { judgeId: judge.id, status: 'SCHEDULED', scheduledDate: { gte: todayStart, lte: todayEnd } } }),
      prisma.hearing.count({ where: { judgeId: judge.id, status: 'SCHEDULED', scheduledDate: { gte: weekStart, lte: weekEnd } } }),
    ]);

    const workloadScore = pendingCases * 2 + hearingsToday * 3 + hearingsThisWeek * 1;

    stats.push({
      judgeId: judge.id,
      userId: judge.user.id,
      benchId: judge.benchId,
      benchName: judge.bench?.name || null,
      benchActive: judge.bench ? judge.bench.isActive : false,
      onLeaveToday: onLeaveIds.has(judge.id),
      name: judge.user.name,
      designation: judge.designation,
      courtRoom: judge.courtRoom,
      maxHearingsPerDay: judge.maxHearingsPerDay,
      pendingCases,
      hearingsToday,
      hearingsThisWeek,
      workloadScore,
    });
  }

  return stats.sort((a, b) => a.workloadScore - b.workloadScore);
}

/**
 * Returns the recommended judge (least workload) plus the full ranked
 * list so the clerk can see the reasoning and pick another if desired.
 * `exclude` is an array of judgeIds to skip; `benchId` limits the choice to
 * one bench. Used by bench allotment (see services/allotmentService.js).
 */
async function recommendJudge({ exclude = [], benchId = null } = {}) {
  const ranked = await getJudgeWorkloadStats();
  // Eligible = sits on an active bench, is not on leave today, not excluded
  // (and, optionally, belongs to one specific bench).
  const filtered = ranked.filter((j) => !exclude.includes(j.judgeId)
    && j.benchId && j.benchActive && !j.onLeaveToday
    && (!benchId || j.benchId === benchId));
  if (filtered.length === 0) return { recommended: null, ranked: filtered };
  return { recommended: filtered[0], ranked: filtered };
}

/**
 * Per-bench rollup used by the Registrar dashboard: pending cases, today's
 * hearings, judges on leave and the court clerks attached to each bench.
 */
async function getBenchWorkload() {
  const [benches, judgeStats] = await Promise.all([
    prisma.bench.findMany({
      orderBy: { name: 'asc' },
      include: { clerks: { where: { isActive: true }, select: { id: true, name: true } } },
    }),
    getJudgeWorkloadStats(),
  ]);

  return benches.map((b) => {
    const judges = judgeStats.filter((j) => j.benchId === b.id);
    return {
      id: b.id,
      name: b.name,
      courtRoom: b.courtRoom,
      isActive: b.isActive,
      clerks: b.clerks,
      judges,
      pendingCases: judges.reduce((n, j) => n + j.pendingCases, 0),
      hearingsToday: judges.reduce((n, j) => n + j.hearingsToday, 0),
      workloadScore: judges.reduce((n, j) => n + j.workloadScore, 0),
      judgesOnLeave: judges.filter((j) => j.onLeaveToday).length,
    };
  });
}

module.exports = { getJudgeWorkloadStats, recommendJudge, getBenchWorkload };
