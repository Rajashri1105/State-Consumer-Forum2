const dayjs = require('dayjs');
const prisma = require('../config/db');
const ApiResponse = require('../utils/ApiResponse');
const { getJudgeWorkloadStats, getBenchWorkload } = require('../services/workloadBalancerService');

const PENDING_STATUSES = ['SUBMITTED', 'UNDER_VERIFICATION', 'DEFECTIVE', 'ACCEPTED', 'PENDING_ALLOTMENT', 'NEEDS_MANUAL_ASSIGNMENT', 'JUDGE_ASSIGNED', 'HEARING_SCHEDULED', 'HEARING_COMPLETED', 'JUDGMENT_UPLOADED'];
const RESOLVED_STATUSES = ['DISPOSED', 'CLOSED', 'SETTLED'];
const MONTHS_BACK = 6;

function monthBuckets(count) {
  return Array.from({ length: count }, (_, i) => dayjs().subtract(count - 1 - i, 'month').format('YYYY-MM'));
}

// --------------------------------------------------------------------------
// GET /analytics/dashboard  (Admin)
// --------------------------------------------------------------------------
async function getDashboardAnalytics(req, res) {
  const rangeStart = dayjs().subtract(MONTHS_BACK - 1, 'month').startOf('month').toDate();

  const [
    totalComplaints, pendingCount, acceptedCount, rejectedCount, disposedCount,
    totalConsumers, totalJudges, totalClerks,
    complaintsInRange, categories, resolvedComplaints, consumersInRange,
    jurisdictionGroups, delayedComplaints, manualAssignmentComplaints,
  ] = await Promise.all([
    prisma.complaint.count(),
    prisma.complaint.count({ where: { status: { in: PENDING_STATUSES } } }),
    prisma.complaint.count({ where: { status: 'ACCEPTED' } }),
    prisma.complaint.count({ where: { status: 'REJECTED' } }),
    prisma.complaint.count({ where: { status: { in: RESOLVED_STATUSES } } }),
    prisma.user.count({ where: { role: 'CONSUMER' } }),
    prisma.user.count({ where: { role: 'JUDGE' } }),
    prisma.user.count({ where: { role: 'CLERK' } }),
    prisma.complaint.findMany({ where: { submittedAt: { gte: rangeStart } }, select: { submittedAt: true } }),
    prisma.complaintCategory.findMany({
      select: { name: true, _count: { select: { complaints: true } } },
    }),
    prisma.complaint.findMany({
      where: { status: { in: RESOLVED_STATUSES }, disposedAt: { not: null } },
      select: { submittedAt: true, disposedAt: true },
    }),
    prisma.user.findMany({ where: { role: 'CONSUMER', createdAt: { gte: rangeStart } }, select: { createdAt: true } }),
    prisma.complaint.groupBy({ by: ['jurisdictionLevel'], _count: { _all: true } }),
    prisma.complaint.findMany({
      where: { isDelayed: true },
      select: { id: true, complaintNumber: true, title: true, status: true, delayReason: true, delayFlaggedAt: true },
      orderBy: { delayFlaggedAt: 'desc' },
    }),
    prisma.complaint.count({ where: { needsManualAssignment: true, status: 'NEEDS_MANUAL_ASSIGNMENT' } }),
  ]);

  // -------------------- Monthly complaint volume --------------------
  const months = monthBuckets(MONTHS_BACK);
  const monthlyComplaints = months.map((m) => ({
    month: m,
    count: complaintsInRange.filter((c) => dayjs(c.submittedAt).format('YYYY-MM') === m).length,
  }));

  // -------------------- Consumer registration growth --------------------
  const registrationGrowth = months.map((m) => ({
    month: m,
    count: consumersInRange.filter((u) => dayjs(u.createdAt).format('YYYY-MM') === m).length,
  }));

  // -------------------- Category distribution --------------------
  const categoryDistribution = categories
    .map((c) => ({ category: c.name, count: c._count.complaints }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  // -------------------- Average resolution time (days) --------------------
  const resolutionDurations = resolvedComplaints.map((c) => dayjs(c.disposedAt).diff(dayjs(c.submittedAt), 'day', true));
  const avgResolutionDays = resolutionDurations.length
    ? Math.round((resolutionDurations.reduce((a, b) => a + b, 0) / resolutionDurations.length) * 10) / 10
    : 0;

  // -------------------- Feature 1: Complaints by Jurisdiction --------------------
  const JURISDICTION_LABELS = {
    DISTRICT_COMMISSION: 'District Commission',
    STATE_COMMISSION: 'State Commission',
    NATIONAL_COMMISSION: 'National Commission',
  };
  const jurisdictionDistribution = jurisdictionGroups
    .filter((g) => g.jurisdictionLevel)
    .map((g) => ({ jurisdiction: JURISDICTION_LABELS[g.jurisdictionLevel] || g.jurisdictionLevel, count: g._count._all }));

  // -------------------- Judge workload / performance --------------------
  const judgeWorkload = await getJudgeWorkloadStats();
  const benchWorkload = await getBenchWorkload();
  const pendingAllotmentCount = await prisma.complaint.count({ where: { status: { in: ['PENDING_ALLOTMENT', 'NEEDS_MANUAL_ASSIGNMENT'] } } });

  return new ApiResponse(200, {
    overview: {
      totalComplaints, pending: pendingCount, accepted: acceptedCount, rejected: rejectedCount, disposed: disposedCount,
      totalConsumers, totalJudges, totalClerks,
    },
    monthlyComplaints,
    registrationGrowth,
    categoryDistribution,
    avgResolutionDays,
    judgeWorkload,
    benchWorkload,
    pendingAllotmentCount,
    jurisdictionDistribution,
    escalation: {
      delayedCount: delayedComplaints.length,
      delayedComplaints,
      needsManualAssignmentCount: manualAssignmentComplaints,
    },
  }).send(res);
}

module.exports = { getDashboardAnalytics };
