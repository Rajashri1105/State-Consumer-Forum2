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

async function getWorkingDayWindow(fromDate, workingDayCount = 2) {
  const { workingDays } = await getForumSettings();
  const start = dayjs(fromDate).startOf('day');
  const searchEnd = start.add(30, 'day').endOf('day');
  const holidaySet = await getHolidaySet(start.add(1, 'day').toDate(), searchEnd.toDate());
  let firstDate = null;
  let deadline = null;
  let found = 0;

  for (let cursor = start.add(1, 'day'); cursor.isBefore(searchEnd) && found < workingDayCount; cursor = cursor.add(1, 'day')) {
    if (!workingDays.includes(cursor.day()) || holidaySet.has(cursor.format('YYYY-MM-DD'))) continue;
    if (!firstDate) firstDate = cursor.startOf('day').toDate();
    deadline = cursor.endOf('day').toDate();
    found += 1;
  }

  if (found < workingDayCount) throw new Error(`Could not find ${workingDayCount} working days in the next 30 days`);
  return { firstDate, deadline };
}

async function loadAvailabilityContext(judgeId, rangeStart, rangeEnd, excludeHearingId) {
  const judge = await prisma.judgeProfile.findUnique({
    where: { id: judgeId },
    include: { availability: true },
  });
  if (!judge) throw new Error('Judge not found');

  const [{ workingDays, timeSlots }, holidaySet, leaveRanges, hearings] = await Promise.all([
    getForumSettings(),
    getHolidaySet(rangeStart, rangeEnd),
    getLeaveRanges(judgeId, rangeStart, rangeEnd),
    prisma.hearing.findMany({
      where: {
        judgeId,
        status: 'SCHEDULED',
        scheduledDate: { gte: rangeStart, lte: rangeEnd },
        ...(excludeHearingId ? { id: { not: excludeHearingId } } : {}),
      },
      select: { scheduledDate: true, scheduledTime: true },
    }),
  ]);

  const hearingsByDate = new Map();
  hearings.forEach((hearing) => {
    const key = dayjs(hearing.scheduledDate).format('YYYY-MM-DD');
    const dayHearings = hearingsByDate.get(key) || [];
    dayHearings.push(hearing.scheduledTime);
    hearingsByDate.set(key, dayHearings);
  });

  return {
    judge,
    availabilityByDay: new Map(judge.availability.map((a) => [a.dayOfWeek, a])),
    workingDays,
    timeSlots,
    holidaySet,
    leaveRanges,
    hearingsByDate,
  };
}

function checkDateAgainstContext(date, context, scheduledTime) {
  const cursor = dayjs(date).startOf('day');
  const dateKey = cursor.format('YYYY-MM-DD');
  const availability = context.availabilityByDay.get(cursor.day());
  const today = dayjs().startOf('day');
  const isToday = cursor.isSame(today, 'day');

  const getSlotDateTime = (time) => {
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(time.trim());
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3]?.toUpperCase();
    if (minute > 59 || (meridiem && (hour < 1 || hour > 12)) || (!meridiem && hour > 23)) return null;

    const hour24 = meridiem ? (hour % 12) + (meridiem === 'PM' ? 12 : 0) : hour;
    return cursor.hour(hour24).minute(minute).second(0).millisecond(0);
  };

  let reason = null;
  if (isToday && scheduledTime && getSlotDateTime(scheduledTime)?.isAfter(dayjs()) !== true) {
    reason = 'The selected hearing time has already passed.';
  } else if (!context.workingDays.includes(cursor.day())) reason = 'This is not a forum working day.';
  else if (context.holidaySet.has(dateKey)) reason = 'The forum is closed for a holiday on this date.';
  else if (context.leaveRanges.some((range) => !cursor.isBefore(range.start) && !cursor.isAfter(range.end))) {
    reason = 'The assigned judge is on leave on this date.';
  } else if (availability && !availability.isAvailable) reason = 'The assigned judge is unavailable on this weekday.';
  else if (cursor.isBefore(today)) reason = 'A hearing cannot be scheduled in the past.';
  else if (scheduledTime && !context.timeSlots.includes(scheduledTime)) reason = 'Select a configured hearing time slot.';
  else {
    const bookedTimes = context.hearingsByDate.get(dateKey) || [];
    if (scheduledTime && bookedTimes.includes(scheduledTime)) reason = 'This time slot is already booked for the assigned judge.';
    else {
      const maxHearingsForDay = Math.min(
        availability?.maxHearingsPerDay || context.judge.maxHearingsPerDay,
        context.timeSlots.length
      );
      if (bookedTimes.length >= maxHearingsForDay) reason = 'The assigned judge has no hearing slots left on this date.';
    }
  }

  if (reason) return { available: false, reason };

  const bookedTimes = context.hearingsByDate.get(dateKey) || [];
  const suggestedTime = context.timeSlots.find((slot) => {
    if (bookedTimes.includes(slot)) return false;
    return !isToday || getSlotDateTime(slot)?.isAfter(dayjs()) === true;
  });
  const unavailableReason = isToday
    ? 'No future hearing time slots are available on this date.'
    : 'No hearing time slots are available on this date.';
  return { available: Boolean(suggestedTime), reason: suggestedTime ? null : unavailableReason, suggestedTime };
}

async function getHearingDateAvailability({ judgeId, date, scheduledTime, excludeHearingId }) {
  const selectedDate = dayjs(date).startOf('day');
  const context = await loadAvailabilityContext(
    judgeId,
    selectedDate.startOf('day').toDate(),
    selectedDate.endOf('day').toDate(),
    excludeHearingId
  );
  return checkDateAgainstContext(selectedDate, context, scheduledTime);
}

async function getHearingDateOptions({ judgeId, fromDate, limit = 3, excludeHearingId }) {
  const searchStart = dayjs(fromDate).startOf('day').add(1, 'day');
  const searchEnd = searchStart.add(MAX_SEARCH_WINDOW_DAYS, 'day').endOf('day');
  const context = await loadAvailabilityContext(judgeId, searchStart.toDate(), searchEnd.toDate(), excludeHearingId);
  const options = [];

  for (let cursor = searchStart; cursor.isBefore(searchEnd) && options.length < limit; cursor = cursor.add(1, 'day')) {
    const availability = checkDateAgainstContext(cursor, context);
    if (availability.available) {
      options.push({
        date: cursor.format('YYYY-MM-DD'),
        time: availability.suggestedTime,
      });
    }
  }

  return options;
}

/**
 * Suggests the best available hearing date/time for a judge, considering:
 * judge availability (day-of-week + explicit unavailability), marked leave
 * (sick leave/vacation), existing hearing load that day, the forum's
 * configured working days and time slots, government holidays, and the
 * complaint's priority (higher priority searches from an earlier start
 * date). Pure rule-based algorithm — no ML.
 *
 * @param {{judgeId: string, priority?: 'HIGH'|'MEDIUM'|'LOW', preferredDate?: Date, latestDate?: Date}} params
 * @returns {Promise<{suggestedDate: Date, suggestedTime: string, reasoning: string[]} | null>}
 */
async function suggestHearingDate({ judgeId, priority = 'MEDIUM', preferredDate = null, latestDate = null }) {
  const judge = await prisma.judgeProfile.findUnique({
    where: { id: judgeId },
    include: { availability: true },
  });
  if (!judge) throw new Error('Judge not found');

  const availabilityByDay = new Map(judge.availability.map((a) => [a.dayOfWeek, a]));
  const { workingDays, timeSlots } = await getForumSettings();

  const leadDays = PRIORITY_LEAD_DAYS[priority] ?? PRIORITY_LEAD_DAYS.MEDIUM;
  const searchStart = preferredDate ? dayjs(preferredDate) : dayjs().add(leadDays, 'day');
  const defaultSearchEnd = searchStart.add(MAX_SEARCH_WINDOW_DAYS, 'day');
  const latestSearchEnd = latestDate ? dayjs(latestDate).endOf('day').add(1, 'millisecond') : defaultSearchEnd;
  const searchEnd = latestSearchEnd.isBefore(defaultSearchEnd) ? latestSearchEnd : defaultSearchEnd;

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
 * Tries the least-loaded judges first (workload balancer ranking), and only
 * recommends a future slot within the next two forum working days.
 *
 * @param {{excludeJudgeId: string, preferredDate: Date, priority?: 'HIGH'|'MEDIUM'|'LOW'}} params
 * @returns {Promise<{judgeId: string, judgeName: string, suggestedDate: Date, suggestedTime: string, reasoning: string[]} | null>}
 */
async function suggestReplacementJudge({ excludeJudgeId, preferredDate, priority = 'MEDIUM', preferBenchId = null, leaveCreatedAt = new Date() }) {
  const ranked = await getJudgeWorkloadStats();
  const { firstDate, deadline } = await getWorkingDayWindow(leaveCreatedAt, 2);
  // Same-bench colleagues are tried first (the bench's court clerk already
  // has the file); otherwise fall back to the least-loaded judge anywhere.
  const candidates = ranked
    .filter((j) => j.judgeId !== excludeJudgeId && j.benchId && j.benchActive)
    .sort((a, b) => (preferBenchId ? Number(b.benchId === preferBenchId) - Number(a.benchId === preferBenchId) : 0));

  for (const candidate of candidates) {
    const suggestion = await suggestHearingDate({
      judgeId: candidate.judgeId,
      priority,
      preferredDate: firstDate || preferredDate,
      latestDate: deadline,
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

module.exports = {
  suggestHearingDate,
  suggestReplacementJudge,
  getHearingDateAvailability,
  getHearingDateOptions,
  getWorkingDayWindow,
  PRIORITY_LEAD_DAYS,
  getForumSettings,
};
