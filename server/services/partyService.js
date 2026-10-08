// --------------------------------------------------------------------------
// Opposite-party portal: serving the notice, the reply clock, and reminders.
//
//  allotment (first time) ──> issueNotice():
//        creates / reuses the party's portal account, e-mails a set-password link,
//        starts the 30-day reply clock, records "Notice Served" on the timeline
//        (which e-mails both parties).
//  cron ──> runReplyDeadlineSweep():
//        7-day and 1-day reminders to the party, and after the deadline the case
//        becomes EX_PARTE_ELIGIBLE (the bench may proceed without their reply).
// --------------------------------------------------------------------------
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dayjs = require('dayjs');
const prisma = require('../config/db');
const config = require('../config/env');
const logger = require('../config/logger');
const { generateSecureToken } = require('../utils/cryptoUtils');
const { sendEmail, caseUpdateTemplate } = require('../utils/email');
const { addTimelineEntry } = require('./timelineService');
const { notifyUser } = require('./notificationService');

const REPLY_WINDOW_DAYS = 30;
const MAX_EXTENSION_DAYS = 15; // total, across all extensions (Consumer Protection Act, 2019)
const TERMINAL = ['REJECTED', 'DISPOSED', 'CLOSED', 'WITHDRAWN', 'SETTLED'];

function endOfDay(date) {
  return dayjs(date).endOf('day').toDate();
}

/** Find or create the opposite party's portal account for this e-mail address. */
async function ensurePartyAccount({ name, email, phone }) {
  const lower = email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email: { equals: lower, mode: 'insensitive' } } });

  if (existing) {
    if (existing.role !== 'OPPOSITE_PARTY') {
      // The address belongs to a consumer or staff account: never convert or hijack it.
      return { user: null, setupUrl: null, created: false };
    }
    return { user: existing, setupUrl: null, created: false };
  }

  // Random throw-away password; the party sets their own through the e-mailed link.
  const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  const { rawToken, hashedToken } = generateSecureToken();
  const user = await prisma.user.create({
    data: {
      name, email: lower, phone: phone || null, password, role: 'OPPOSITE_PARTY', isEmailVerified: true,
      passwordResetToken: hashedToken,
      passwordResetExpiry: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    },
  });
  return { user, setupUrl: `${config.clientUrl}/reset-password?token=${rawToken}`, created: true };
}

/**
 * Serve the notice: called once, right after the first bench allotment.
 * If the consumer gave no opposite-party e-mail there is nobody to serve
 * electronically, so the case simply carries on (the clerk can follow up).
 */
async function issueNotice(complaintId, actor) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint || complaint.noticeIssuedAt) return { skipped: true };

  if (!complaint.oppositePartyEmail) {
    await addTimelineEntry(complaintId, 'NOTICE_NOT_SERVED',
      'No e-mail address was given for the opposite party, so the notice could not be served electronically. The court clerk should serve it by post.',
      actor?.id || null, { email: false });
    return { skipped: true, reason: 'NO_EMAIL' };
  }

  const { user, setupUrl, created } = await ensurePartyAccount({
    name: complaint.oppositePartyName, email: complaint.oppositePartyEmail, phone: complaint.oppositePartyPhone,
  });

  const now = new Date();
  const dueDate = endOfDay(dayjs(now).add(REPLY_WINDOW_DAYS, 'day'));
  await prisma.complaint.update({
    where: { id: complaintId },
    data: {
      noticeIssuedAt: now, replyDueDate: dueDate, replyStatus: 'AWAITING_REPLY',
      oppositePartyUserId: user?.id || null, replyReminder7Sent: false, replyReminder1Sent: false,
    },
  });

  // 1) Account e-mail (only the first time this address appears).
  if (created && setupUrl) {
    try {
      await sendEmail({
        to: complaint.oppositePartyEmail,
        subject: 'Your State Consumer Forum portal account',
        html: caseUpdateTemplate({
          name: complaint.oppositePartyName, complaintNumber: complaint.complaintNumber,
          headline: 'Your portal account is ready',
          message: `A consumer complaint has been filed against ${complaint.oppositePartyName}. We created a portal account for this e-mail address so you can read the complaint, file your reply, ask for more time, and make a settlement offer.\n\nSet your password with the button below (valid for 14 days). Your login is this e-mail address.`,
          cta: { url: setupUrl, label: 'Set my password' },
        }),
      }, { event: 'PARTY_ACCOUNT', complaintId });
    } catch (err) {
      logger.error(`Could not send portal account e-mail: ${err.message}`);
    }
  }

  // 2) The notice itself — the timeline entry e-mails the party and tells the consumer.
  const note = user
    ? `Reply due by ${dayjs(dueDate).format('DD MMM YYYY')} (30 days).`
    : `Reply due by ${dayjs(dueDate).format('DD MMM YYYY')}. This e-mail address already belongs to another account, so no portal login was created for the opposite party.`;
  await addTimelineEntry(complaintId, 'NOTICE_ISSUED', note, actor?.id || null);

  return { issued: true, dueDate, accountCreated: created };
}

/** Cron: reminders, then flag cases whose reply deadline has passed. */
async function runReplyDeadlineSweep() {
  const now = new Date();
  const awaiting = await prisma.complaint.findMany({
    where: { replyStatus: 'AWAITING_REPLY', status: { notIn: TERMINAL }, replyDueDate: { not: null } },
    select: {
      id: true, complaintNumber: true, replyDueDate: true, replyReminder7Sent: true, replyReminder1Sent: true,
      oppositePartyName: true, oppositePartyEmail: true, oppositePartyUserId: true, assignedJudge: { select: { userId: true } },
    },
  });

  let flagged = 0;
  let reminded = 0;
  for (const c of awaiting) {
    const daysLeft = dayjs(c.replyDueDate).diff(now, 'day', true);

    if (daysLeft <= 0) {
      const r = await prisma.complaint.updateMany({
        where: { id: c.id, replyStatus: 'AWAITING_REPLY' },
        data: { replyStatus: 'EX_PARTE_ELIGIBLE' },
      });
      if (r.count) {
        flagged += 1;
        await addTimelineEntry(c.id, 'EX_PARTE_ELIGIBLE', `No reply was filed by ${dayjs(c.replyDueDate).format('DD MMM YYYY')}. The bench may proceed ex parte.`, null);
        if (c.assignedJudge?.userId) {
          await notifyUser({
            userId: c.assignedJudge.userId, title: 'Reply Deadline Missed',
            message: `${c.complaintNumber}: ${c.oppositePartyName} did not reply in time — the case is eligible to proceed ex parte.`,
            type: 'EX_PARTE_ELIGIBLE', relatedComplaintId: c.id,
          });
        }
      }
      continue;
    }

    const reminder = daysLeft <= 1 && !c.replyReminder1Sent ? '1' : daysLeft <= 7 && !c.replyReminder7Sent ? '7' : null;
    if (reminder && c.oppositePartyEmail) {
      const when = reminder === '1' ? 'tomorrow' : `in ${Math.ceil(daysLeft)} days`;
      try {
        await sendEmail({
          to: c.oppositePartyEmail,
          subject: `Reminder: reply due ${when} — ${c.complaintNumber}`,
          html: caseUpdateTemplate({
            name: c.oppositePartyName, complaintNumber: c.complaintNumber, headline: 'Your reply deadline is near',
            message: `Your written reply is due ${when} (${dayjs(c.replyDueDate).format('DD MMM YYYY')}). If you need more time, ask for an extension on the portal before the deadline.`,
            cta: c.oppositePartyUserId ? { url: `${config.clientUrl}/party/cases/${c.id}`, label: 'Open case' } : undefined,
          }),
        }, { event: 'REPLY_REMINDER', complaintId: c.id });
        await prisma.complaint.update({
          where: { id: c.id },
          data: reminder === '1' ? { replyReminder1Sent: true, replyReminder7Sent: true } : { replyReminder7Sent: true },
        });
        reminded += 1;
      } catch (err) {
        logger.error(`Reply reminder failed for ${c.complaintNumber}: ${err.message}`);
      }
    }
  }
  return { flagged, reminded };
}

module.exports = { issueNotice, ensurePartyAccount, runReplyDeadlineSweep, REPLY_WINDOW_DAYS, MAX_EXTENSION_DAYS, TERMINAL };
