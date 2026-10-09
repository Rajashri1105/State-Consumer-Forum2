// --------------------------------------------------------------------------
// Case e-mail updates — one place that tells BOTH parties about progress.
//
// Hooked into addTimelineEntry(), so every step that is recorded on the case
// timeline (filing, scrutiny, allotment, notice, reply, extension, settlement,
// hearings, verdict, ...) produces exactly one e-mail per party who should know.
//
// Who gets what:
//   consumer        every update on their case
//   opposite party  every update from the moment the notice is served
//                   (before that they don't know the case exists)
//   audience option  'CONSUMER' | 'PARTY' | 'BOTH' (default) overrides the above
// Every attempt is stored in email_logs (see Admin -> Email Log).
// --------------------------------------------------------------------------
const dayjs = require('dayjs');
const prisma = require('../config/db');
const config = require('../config/env');
const logger = require('../config/logger');
const { sendEmail, caseUpdateTemplate } = require('../utils/email');
const { notifyUser } = require('./notificationService');

// intro text per stage and audience. `c` = { number, party, due }.
const STAGES = {
  SUBMITTED: {
    consumer: ['Complaint received', () => 'We have received your complaint. A scrutiny clerk will review it shortly.'],
  },
  UNDER_VERIFICATION: {
    consumer: ['Complaint under scrutiny', () => 'A clerk has started scrutinising your complaint.'],
  },
  ACCEPTED: {
    consumer: ['Complaint accepted', () => 'Your complaint passed scrutiny and is being allotted to a bench.'],
  },
  REJECTED: {
    consumer: ['Complaint rejected', () => 'Unfortunately your complaint could not be accepted.'],
  },
  DEFECTIVE: {
    consumer: ['Correction needed', () => 'Your complaint has defects that must be fixed before it can proceed. Please log in, add the missing items, and resubmit.'],
  },
  JUDGE_ASSIGNED: {
    consumer: ['Case allotted to a bench', () => 'Your case has been allotted to a bench. The court clerk will schedule the first hearing.'],
    party: ['Case allotted to a new bench', () => 'The case against you has been allotted to a bench.'],
  },
  NOTICE_ISSUED: {
    consumer: ['Notice served on the opposite party', (c) => `A formal notice has been sent to ${c.party}. They must file a written reply by ${c.due}.`],
    party: ['Notice: a consumer complaint has been filed against you', (c) => `A consumer complaint has been filed against ${c.party}. You must file a written reply on the portal by ${c.due}. If no reply is filed by then, the bench may proceed without hearing you.`],
  },
  REPLY_FILED: {
    consumer: ['Opposite party filed a reply', () => 'The opposite party has filed a written reply. You can read it on your case page.'],
    party: ['Your reply has been recorded', () => 'Your written reply has been recorded on the case.'],
  },
  EXTENSION_REQUESTED: {
    consumer: ['Opposite party asked for more time', () => 'The opposite party has asked for more time to file their reply. The judge will decide.'],
    party: ['Extension request submitted', () => 'Your request for more time has been sent to the judge.'],
  },
  EXTENSION_GRANTED: {
    consumer: ['Reply deadline extended', (c) => `The judge extended the opposite party's reply deadline to ${c.due}.`],
    party: ['Extension granted', (c) => `The judge granted your request. Your new reply deadline is ${c.due}.`],
  },
  EXTENSION_REJECTED: {
    consumer: ['Extension refused', (c) => `The judge refused the opposite party's request. The reply deadline stays ${c.due}.`],
    party: ['Extension refused', (c) => `The judge refused your request. The reply deadline stays ${c.due}.`],
  },
  EX_PARTE_ELIGIBLE: {
    consumer: ['Reply deadline passed', () => 'The opposite party did not reply in time. The bench may now proceed without their reply.'],
    party: ['Reply deadline passed', () => 'You did not file a reply in time. The bench may now proceed without hearing your side. You can still file a reply, but it may be treated as late.'],
  },
  SETTLEMENT_OFFERED: {
    consumer: ['Settlement offer received', () => 'The opposite party has offered to settle. Please review the offer on your case page and accept or reject it.'],
    party: ['Settlement offer sent', () => 'Your settlement offer was sent to the consumer.'],
  },
  SETTLEMENT_ACCEPTED: {
    consumer: ['You accepted the settlement', () => 'You accepted the settlement offer. The case is now closed as settled.'],
    party: ['Settlement accepted', () => 'The consumer accepted your offer. The case is now closed as settled.'],
  },
  SETTLEMENT_REJECTED: {
    consumer: ['You rejected the settlement', () => 'You rejected the settlement offer. The case continues.'],
    party: ['Settlement offer rejected', () => 'The consumer rejected your offer. The case continues.'],
  },
  SETTLEMENT_WITHDRAWN: {
    consumer: ['Settlement offer withdrawn', () => 'The opposite party withdrew their settlement offer.'],
    party: ['Settlement offer withdrawn', () => 'You withdrew your settlement offer.'],
  },
  SETTLED: {
    consumer: ['Case settled', () => 'The case has been closed because both sides settled.'],
    party: ['Case settled', () => 'The case has been closed because both sides settled.'],
  },
  HEARING_SCHEDULED: {
    consumer: ['Hearing scheduled', () => 'A hearing has been scheduled for your case.'],
    party: ['Hearing scheduled', () => 'A hearing has been scheduled. Please attend on the date below.'],
  },
  HEARING_RESCHEDULED: {
    consumer: ['Hearing rescheduled', () => 'Your hearing has been moved to a new date.'],
    party: ['Hearing rescheduled', () => 'The hearing has been moved to a new date.'],
  },
  HEARING_ADJOURNED: {
    consumer: ['Hearing adjourned', () => 'Your hearing was adjourned. A new date will be fixed.'],
    party: ['Hearing adjourned', () => 'The hearing was adjourned. A new date will be fixed.'],
  },
  HEARING_COMPLETED: {
    consumer: ['Hearing completed', () => 'The hearing for your case has been completed.'],
    party: ['Hearing completed', () => 'The hearing has been completed.'],
  },
  CLOSED: {
    consumer: ['Verdict published — case closed', () => 'The judge has published the verdict. You can read and download it from your case page.'],
    party: ['Verdict published — case closed', () => 'The judge has published the verdict. You can read and download it from the portal.'],
  },
  WITHDRAWN: {
    consumer: ['Complaint withdrawn', () => 'Your complaint has been withdrawn.'],
    party: ['Complaint withdrawn', () => 'The consumer has withdrawn the complaint against you.'],
  },
};
// Stages with no entry here (e.g. "awaiting registrar allotment") are internal and send no e-mail.

const pretty = (v) => String(v || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (ch) => ch.toUpperCase());

function nextHearingLabel(h) {
  return h ? `${dayjs(h.scheduledDate).format('DD MMM YYYY')} at ${h.scheduledTime}` : null;
}

async function loadCase(complaintId) {
  return prisma.complaint.findUnique({
    where: { id: complaintId },
    include: {
      consumer: { select: { id: true, name: true, email: true } },
      bench: { select: { name: true, courtRoom: true } },
      assignedJudge: { include: { user: { select: { name: true } } } },
      oppositeParties: true,
      hearings: { where: { status: 'SCHEDULED' }, orderBy: { scheduledDate: 'asc' }, take: 1 },
    },
  });
}

/**
 * E-mail (and, for the opposite party, in-app notify) everyone who should hear
 * about `stageKey`. Never throws — failures are logged and stored in email_logs.
 */
async function notifyCaseParties(complaintId, stageKey, remarks = null, { audience = 'BOTH', setupUrl = null } = {}) {
  const stage = STAGES[stageKey];
  if (!stage) return { skipped: true };

  let complaint;
  try {
    complaint = await loadCase(complaintId);
  } catch (err) {
    logger.error(`caseMailer: could not load complaint ${complaintId}: ${err.message}`);
    return { error: err.message };
  }
  if (!complaint) return { skipped: true };

  const due = complaint.replyDueDate ? dayjs(complaint.replyDueDate).format('DD MMM YYYY') : '—';
  const ctx = { number: complaint.complaintNumber, party: complaint.oppositePartyName, due };
  const hearing = nextHearingLabel(complaint.hearings[0]);

  const details = [
    ['Status', pretty(complaint.status)],
    ['Bench', complaint.bench ? `${complaint.bench.name}${complaint.bench.courtRoom ? ` (${complaint.bench.courtRoom})` : ''}` : null],
    ['Judge', complaint.assignedJudge?.user?.name],
    ['Next hearing', hearing],
    ['Reply due', complaint.replyStatus === 'AWAITING_REPLY' || stageKey.startsWith('EXTENSION') || stageKey === 'NOTICE_ISSUED' ? due : null],
  ];

  const build = (side) => {
    const [headline, intro] = stage[side] || [];
    if (!headline) return null;
    const message = remarks ? `${intro(ctx)}\n\n${remarks}` : intro(ctx);
    return { headline, message };
  };

  const jobs = [];

  // ---- consumer ----
  if (audience !== 'PARTY' && complaint.consumer?.email) {
    const c = build('consumer');
    if (c) {
      jobs.push({
        to: complaint.consumer.email, name: complaint.consumer.name,
        subject: `${c.headline} — ${complaint.complaintNumber}`,
        html: caseUpdateTemplate({
          name: complaint.consumer.name, complaintNumber: complaint.complaintNumber, headline: c.headline, message: c.message, details,
          cta: { url: `${config.clientUrl}/consumer/complaints/${complaint.id}`, label: 'View my case' },
        }),
      });
    }
  }

  // ---- opposite party (only once the notice has been served) ----
  const partyKnows = Boolean(complaint.noticeIssuedAt);
  if (audience !== 'CONSUMER' && partyKnows) {
    const p = build('party');
    if (p) {
      const recipients = [];
      if (complaint.oppositePartyEmail) {
        recipients.push({ email: complaint.oppositePartyEmail, name: complaint.oppositePartyName, portal: Boolean(complaint.oppositePartyUserId) });
      }
      for (const extra of complaint.oppositeParties || []) {
        if (extra.email) recipients.push({ email: extra.email, name: extra.name, portal: false });
      }
      for (const r of recipients) {
        // For a brand-new account (setupUrl provided) the party hasn't set a password yet,
        // so the CTA should take them to the set-password page, not the portal case page.
        let cta;
        if (setupUrl && stageKey === 'NOTICE_ISSUED') {
          cta = { url: setupUrl, label: 'Set password & open case' };
        } else if (r.portal) {
          cta = { url: `${config.clientUrl}/party/cases/${complaint.id}`, label: 'Open case on the portal' };
        }
        jobs.push({
          to: r.email, name: r.name,
          subject: `${p.headline} — ${complaint.complaintNumber}`,
          html: caseUpdateTemplate({
            name: r.name, complaintNumber: complaint.complaintNumber, headline: p.headline, message: p.message, details,
            cta,
          }),
        });
      }
      if (complaint.oppositePartyUserId) {
        notifyUser({
          userId: complaint.oppositePartyUserId, title: p.headline,
          message: `${complaint.complaintNumber}: ${p.message.split('\n')[0]}`,
          type: 'CASE_UPDATE', relatedComplaintId: complaint.id,
        }).catch((err) => logger.warn(`caseMailer: in-app notice failed: ${err.message}`));
      }
    }
  }

  // Sequential on purpose: Gmail throttles bursts, and one bad address must not block the other party.
  let sent = 0;
  for (const job of jobs) {
    try {
      await sendEmail({ to: job.to, subject: job.subject, html: job.html }, { event: stageKey, complaintId });
      sent += 1;
    } catch (err) {
      logger.error(`caseMailer: e-mail to ${job.to} failed (${stageKey}): ${err.message}`);
    }
  }
  return { sent, attempted: jobs.length };
}

module.exports = { notifyCaseParties, STAGES };
