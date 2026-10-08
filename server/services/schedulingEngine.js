const dayjs = require('dayjs');
const prisma = require('../config/db');
const { getJudgeWorkloadStats } = require('./workloadBalancerService');

// Fallback slots if ForumSettings has none configured yet — 15-minute
// sessions, court hours 10:30 AM-4:30 PM, lunch break 1:30-2:30 PM.
const DEFAULT_TIME_SLOTS = [
  '10:30 AM', '10:45 AM', '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM',
  '12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM', '1:00 PM', '1:15 PM',
  '2:30 PM', '2:45 PM', '3:00 PM', '3:15 PM', '3:30 PM', '3:45 PM', '4:00 PM', '4:15 PM',
];

// How many days out the search window begins, based on complaint
// priority. High-priority complaints get pulled to the earliest
// possible slot; lower priority complaints are pushed out to keep the
// near-term calendar free for urgent matters.
const PRIORITY_LEAD_DAYS = { HIGH: 1, MEDIUM: 3, LOW: 7 };
const MAX_SEARCH_WINDOW_DAYS = 90;

async function getForumSettings() {
  const settings = await prisma.forumSettings.findFirst();
  return {
    workingDays: settings?.workingDays || [1, 2, 3, 4, 5],
    timeSlots: settings?.hearingTimeSlots?.length ? settings.hearingTimeSlots : DEFAULT_TIME_SLOTS,
  };
}

async function getHolidaySet(rangeStart, rangeEnd) {
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } },
  });
  return new Set(holidays.map((h) => dayjs(h.date).format('YYYY-MM-DD')));
}

async function getLeaveRanges(judgeId, rangeStart, rangeEnd) {
  const leaves = await prisma.judgeLeave.findMany({
    where: { judgeId, startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } },
  });
  return leaves.map((l) => ({ start: dayjs(l.startDate).startOf('day'), end: dayjs(l.endDate).endOf('day') }));
}

/**
 * Suggests the best available hearing date/time for a judge, considering:
 * judge availability (day-of-week + explicit unavailability), marked leave
 * (sick leave/vacation), existing hearing load that day, the forum's
 * configured working days and time slots, government holidays, and the
 * complaint's priority (higher priority searches from an earlier start
 * date). Pure rule-based algorithm — no ML.
 *
 * @param {{judgeId: string, priority?: 'HIGH'|'MEDIUM'|'LOW', preferredDate?: Date}} params
 * @returns {Promise<{suggestedDate: Date, suggestedTime: string, reasoning: string[]} | null>}
 */
async function suggestHearingDate({ judgeId, priority = 'MEDIUM', preferredDate = null }) {
  const judge = await prisma.judgeProfile.findUnique({
    where: { id: judgeId },
    include: { availability: true },
  });
  if (!judge) throw new Error('Judge not found');

  const availabilityByDay = new Map(judge.availability.map((a) => [a.dayOfWeek, a]));
  const { workingDays, timeSlots } = await getForumSettings();

  const leadDays = PRIORITY_LEAD_DAYS[priority] ?? PRIORITY_LEAD_DAYS.MEDIUM;
  const searchStart = preferredDate ? dayjs(preferredDate) : dayjs().add(leadDays, 'day');
  const searchEnd = searchStart.add(MAX_SEARCH_WINDOW_DAYS, 'day');

  const holidaySet = await getHolidaySet(searchStart.startOf('day').toDate(), searchEnd.endOf('day').toDate());
  const leaveRanges = await getLeaveRanges(judgeId, searchStart.startOf('day').toDate(), searchEnd.endOf('day').toDate());

  for (let cursor = searchStart; cursor.isBefore(searchEnd); cursor = cursor.add(1, 'day')) {
    const dayOfWeek = cursor.day();
    const dateKey = cursor.format('YYYY-MM-DD');
    const reasoning = [];

    if (!workingDays.includes(dayOfWeek)) continue; // not a forum working day
    if (holidaySet.has(dateKey)) continue; // government holiday

    const onLeave = leaveRanges.some((r) => cursor.isAfter(r.start.subtract(1, 'second')) && cursor.isBefore(r.end.add(1, 'second')));
    if (onLeave) continue; // judge is on marked leave this day

    const availability = availabilityByDay.get(dayOfWeek);
    if (availability && !availability.isAvailable) continue; // judge marked unavailable this weekday

    const maxHearingsForDay = Math.min(
      availability?.maxHearingsPerDay || judge.maxHearingsPerDay,
      timeSlots.length
    );

    const existingCount = await prisma.hearing.count({
      where: {
        judgeId,
        status: 'SCHEDULED',
        scheduledDate: { gte: cursor.startOf('day').toDate(), lte: cursor.endOf('day').toDate() },
      },
    });

    if (existingCount < maxHearingsForDay) {
      reasoning.push(`${dateKey} is a working day for the forum and not a holiday.`);
      reasoning.push(`Judge has ${existingCount}/${maxHearingsForDay} hearing slots filled that day.`);
      reasoning.push(`Search prioritized based on ${priority} complaint priority (lead time: ${leadDays} day(s)).`);

      return {
        suggestedDate: cursor.startOf('day').toDate(),
        suggestedTime: timeSlots[existingCount],
        reasoning,
      };
    }
  }

  return null; // No slot found within the search window
}

/**
 * Recommends a replacement judge + slot when the originally assigned judge
 * becomes unavailable (marked leave) for a hearing that's already scheduled.
 * Tries the least-loaded judges first (workload balancer ranking), aiming
 * to keep the hearing on the same day if at all possible, then the next
 * few working days.
 *
 * @param {{excludeJudgeId: string, preferredDate: Date, priority?: 'HIGH'|'MEDIUM'|'LOW'}} params
 * @returns {Promise<{judgeId: string, judgeName: string, suggestedDate: Date, suggestedTime: string, reasoning: string[]} | null>}
 */
async function suggestReplacementJudge({ excludeJudgeId, preferredDate, priority = 'MEDIUM', preferBenchId = null }) {
  const ranked = await getJudgeWorkloadStats();
  // Same-bench colleagues are tried first (the bench's court clerk already
  // has the file); otherwise fall back to the least-loaded judge anywhere.
  const candidates = ranked
    .filter((j) => j.judgeId !== excludeJudgeId && j.benchId && j.benchActive)
    .sort((a, b) => (preferBenchId ? Number(b.benchId === preferBenchId) - Number(a.benchId === preferBenchId) : 0));

  for (const candidate of candidates) {
    // Same day first; suggestHearingDate's own search window will carry
    // forward to subsequent days automatically if same-day is full.
    const suggestion = await suggestHearingDate({
      judgeId: candidate.judgeId,
      priority,
      preferredDate,
    });
    if (suggestion) {
      return {
        judgeId: candidate.judgeId,
        judgeName: candidate.name,
        suggestedDate: suggestion.suggestedDate,
        suggestedTime: suggestion.suggestedTime,
        reasoning: [
          `${candidate.name} was selected as the least-loaded available judge (${candidate.pendingCases} pending cases, ${candidate.hearingsToday} hearings today).`,
          ...suggestion.reasoning,
        ],
      };
    }
  }

  return null; // No replacement judge had an available slot within the search window
}

module.exports = { suggestHearingDate, suggestReplacementJudge, PRIORITY_LEAD_DAYS, getForumSettings };
