const test = require('node:test');
const assert = require('node:assert/strict');
const dayjs = require('dayjs');

let hearingTimeSlots = ['10:30 AM'];
let holidays = [{ date: new Date('2026-10-13T00:00:00.000Z') }];
let judgeLeaves = [{
  startDate: new Date('2026-10-14T00:00:00.000Z'),
  endDate: new Date('2026-10-14T00:00:00.000Z'),
}];
const dbPath = require.resolve('../config/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    forumSettings: {
      findFirst: async () => ({ workingDays: [1, 2, 3, 4, 5], hearingTimeSlots }),
    },
    holiday: {
      findMany: async () => holidays,
    },
    judgeProfile: {
      findUnique: async () => ({ maxHearingsPerDay: 8, availability: [] }),
    },
    judgeLeave: {
      findMany: async () => judgeLeaves,
    },
    hearing: {
      findMany: async () => [],
      count: async () => 0,
    },
  },
};

const {
  getHearingDateAvailability,
  getHearingDateOptions,
  getWorkingDayWindow,
} = require('../services/schedulingEngine');

test('leave rescheduling window starts in the future and skips forum holidays', async () => {
  const window = await getWorkingDayWindow(new Date('2026-10-12T10:00:00.000Z'), 2);

  assert.equal(dayjs(window.firstDate).format('YYYY-MM-DD'), '2026-10-14');
  assert.equal(dayjs(window.deadline).format('YYYY-MM-DD'), '2026-10-15');
});

test('manual date availability rejects a date when the assigned judge is on leave', async () => {
  const availability = await getHearingDateAvailability({
    judgeId: 'judge-1',
    date: '2026-10-14',
    scheduledTime: '10:30 AM',
  });

  assert.equal(availability.available, false);
  assert.match(availability.reason, /judge is on leave/i);
});

test('manual date availability rejects dates before the system date', async () => {
  let pastWorkingDate = dayjs().subtract(1, 'day');
  while (
    ![1, 2, 3, 4, 5].includes(pastWorkingDate.day())
    || ['2026-10-13', '2026-10-14'].includes(pastWorkingDate.format('YYYY-MM-DD'))
  ) {
    pastWorkingDate = pastWorkingDate.subtract(1, 'day');
  }

  const availability = await getHearingDateAvailability({
    judgeId: 'judge-1',
    date: pastWorkingDate.format('YYYY-MM-DD'),
    scheduledTime: '10:30 AM',
  });

  assert.equal(availability.available, false);
  assert.match(availability.reason, /cannot be scheduled in the past/i);
});

test('manual date availability rejects a time slot that has already passed today', async () => {
  const pastSlot = dayjs().startOf('day').format('h:mm A');
  hearingTimeSlots = [pastSlot];
  const availability = await getHearingDateAvailability({
    judgeId: 'judge-1',
    date: dayjs().format('YYYY-MM-DD'),
    scheduledTime: pastSlot,
  });

  assert.equal(availability.available, false);
  assert.match(availability.reason, /time has already passed/i);
  hearingTimeSlots = ['10:30 AM'];
});

test('date options skip holidays, judge leave, and non-working days', async () => {
  let holidayDate = dayjs();
  while (![1, 2, 3, 4, 5].includes(holidayDate.day())) holidayDate = holidayDate.add(1, 'day');
  let leaveDate = holidayDate.add(1, 'day');
  while (![1, 2, 3, 4, 5].includes(leaveDate.day())) leaveDate = leaveDate.add(1, 'day');
  holidays = [{ date: holidayDate.startOf('day').toDate() }];
  judgeLeaves = [{
    startDate: leaveDate.startOf('day').toDate(),
    endDate: leaveDate.startOf('day').toDate(),
  }];

  const options = await getHearingDateOptions({
    judgeId: 'judge-1',
    fromDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
  });

  assert.equal(options.length, 3);
  assert.ok(options.every((option) => [1, 2, 3, 4, 5].includes(dayjs(option.date).day())));
  assert.ok(options.every((option) => !dayjs(option.date).isBefore(dayjs(), 'day')));
  assert.ok(options.every((option) => option.date !== holidayDate.format('YYYY-MM-DD')));
  assert.ok(options.every((option) => option.date !== leaveDate.format('YYYY-MM-DD')));
  assert.ok(dayjs(options[0].date).isAfter(leaveDate, 'day'));
});
