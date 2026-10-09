const dayjs = require('dayjs');
const prisma = require('../config/db');
const { notifyUser } = require('./notificationService');
const logger = require('../config/logger');
const { getComplaintTitle } = require('../utils/complaintTitle');

/**
 * Sends every judge with at least one hearing today a single in-app
 * notification summarizing their docket (case titles + times), so they
 * see it waiting in their notification feed each morning without having
 * to open the calendar first.
 */
async function sendDailyCaseDigest() {
  const todayStart = dayjs().startOf('day').toDate();
  const todayEnd = dayjs().endOf('day').toDate();

  const hearingsToday = await prisma.hearing.findMany({
    where: { status: 'SCHEDULED', scheduledDate: { gte: todayStart, lte: todayEnd } },
    include: {
      judge: { include: { user: { select: { id: true, name: true } } } },
      complaint: {
        select: {
          complaintNumber: true,
          oppositePartyName: true,
          consumer: { select: { name: true } },
        },
      },
    },
    orderBy: { scheduledTime: 'asc' },
  });

  const byJudge = new Map();
  for (const h of hearingsToday) {
    const key = h.judge.user.id;
    if (!byJudge.has(key)) byJudge.set(key, { name: h.judge.user.name, hearings: [] });
    byJudge.get(key).hearings.push(h);
  }

  let sentCount = 0;
  for (const [judgeUserId, { hearings }] of byJudge) {
    const summary = hearings
      .map((h) => `${h.scheduledTime} — ${getComplaintTitle(h.complaint)}`)
      .join('; ');

    try {
      await notifyUser({
        userId: judgeUserId,
        title: `Today's Docket — ${hearings.length} Hearing${hearings.length > 1 ? 's' : ''}`,
        message: summary,
        type: 'DAILY_CASE_DIGEST',
      });
      sentCount += 1;
    } catch (err) {
      logger.error(`Failed to send daily digest to judge ${judgeUserId}:`, err.message);
    }
  }

  logger.info(`Daily case digest sent to ${sentCount} judge(s) covering ${hearingsToday.length} hearing(s) today.`);
  return { judgesNotified: sentCount, hearingsToday: hearingsToday.length };
}

module.exports = { sendDailyCaseDigest };
