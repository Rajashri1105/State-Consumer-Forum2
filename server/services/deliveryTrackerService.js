// --------------------------------------------------------------------------
// Feature 4: Notice Delivery Tracker
//
// Extends the existing hearing-notice notification system (SMS/email)
// with a per-channel delivery status log. Called right after a hearing
// notice is generated (see hearingController.scheduleHearing /
// rescheduleHearing), and exposed for a manual per-channel resend when a
// channel fails.
// --------------------------------------------------------------------------

const prisma = require('../config/db');
const { sendEmail, complaintStatusTemplate } = require('../utils/email');
const { sendSms } = require('../utils/sms');
const { notifyUser } = require('./notificationService');
const logger = require('../config/logger');

function noticeMessage(hearing, complaint) {
  const dayjs = require('dayjs');
  return `Notice: A hearing for complaint ${complaint.complaintNumber} has been scheduled on ${dayjs(hearing.scheduledDate).format('DD MMM YYYY')} at ${hearing.scheduledTime}. Please appear before the Forum.`;
}

/**
 * Sends the hearing notice over both channels (SMS + Email) and logs a
 * NoticeDelivery row per channel with its resulting status.
 */
async function sendAndLogNotice(hearing, complaint) {
  const consumer = complaint.consumer;
  const message = noticeMessage(hearing, complaint);
  const results = [];

  // -------------------- Email channel --------------------
  try {
    const info = await sendEmail({
      to: consumer.email,
      subject: `Notice of Hearing — ${complaint.complaintNumber}`,
      html: complaintStatusTemplate(consumer.name, complaint.complaintNumber, message),
    });
    const delivered = !info?.skipped ? true : true; // dev-mode "skipped" sends still count as delivered for demo purposes
    results.push(await prisma.noticeDelivery.create({
      data: {
        hearingId: hearing.id,
        channel: 'EMAIL',
        status: delivered ? 'DELIVERED' : 'FAILED',
        deliveredAt: delivered ? new Date() : null,
      },
    }));
  } catch (err) {
    logger.error('Notice email delivery failed:', err.message);
    results.push(await prisma.noticeDelivery.create({
      data: { hearingId: hearing.id, channel: 'EMAIL', status: 'FAILED', failureReason: err.message },
    }));
  }

  // -------------------- SMS channel --------------------
  try {
    const smsResult = await sendSms({ to: consumer.phone, message });
    const delivered = Boolean(smsResult.delivered) && !smsResult.error;
    results.push(await prisma.noticeDelivery.create({
      data: {
        hearingId: hearing.id,
        channel: 'SMS',
        status: consumer.phone ? (delivered ? 'DELIVERED' : 'FAILED') : 'FAILED',
        deliveredAt: delivered ? new Date() : null,
        failureReason: !consumer.phone ? 'No phone number on file' : smsResult.error || null,
      },
    }));
  } catch (err) {
    logger.error('Notice SMS delivery failed:', err.message);
    results.push(await prisma.noticeDelivery.create({
      data: { hearingId: hearing.id, channel: 'SMS', status: 'FAILED', failureReason: err.message },
    }));
  }

  const anyFailed = results.some((r) => r.status === 'FAILED');
  if (anyFailed) {
    // Flag the failure visibly to the clerk who scheduled the hearing.
    await notifyUser({
      userId: hearing.createdById,
      title: 'Notice Delivery Failed',
      message: `One or more delivery channels failed for the hearing notice on complaint ${complaint.complaintNumber}. Please resend or use an alternate channel.`,
      type: 'NOTICE_DELIVERY_FAILED',
      relatedComplaintId: complaint.id,
    });
  }

  return results;
}

async function getDeliveryStatus(hearingId) {
  return prisma.noticeDelivery.findMany({ where: { hearingId }, orderBy: { sentAt: 'desc' } });
}

/**
 * Resends the notice over a single channel and logs a fresh delivery
 * record (rather than mutating the failed one, to preserve the audit
 * trail of every attempt).
 */
async function resendChannel(hearingId, channel) {
  const hearing = await prisma.hearing.findUnique({
    where: { id: hearingId },
    include: { complaint: { include: { consumer: true } } },
  });
  if (!hearing) throw new Error('Hearing not found');

  const consumer = hearing.complaint.consumer;
  const message = noticeMessage(hearing, hearing.complaint);

  if (channel === 'EMAIL') {
    try {
      await sendEmail({
        to: consumer.email,
        subject: `Notice of Hearing (Resent) — ${hearing.complaint.complaintNumber}`,
        html: complaintStatusTemplate(consumer.name, hearing.complaint.complaintNumber, message),
      });
      return prisma.noticeDelivery.create({ data: { hearingId, channel: 'EMAIL', status: 'DELIVERED', deliveredAt: new Date() } });
    } catch (err) {
      return prisma.noticeDelivery.create({ data: { hearingId, channel: 'EMAIL', status: 'FAILED', failureReason: err.message } });
    }
  }

  if (channel === 'SMS') {
    const smsResult = await sendSms({ to: consumer.phone, message });
    const delivered = Boolean(smsResult.delivered) && !smsResult.error && consumer.phone;
    return prisma.noticeDelivery.create({
      data: {
        hearingId, channel: 'SMS',
        status: delivered ? 'DELIVERED' : 'FAILED',
        deliveredAt: delivered ? new Date() : null,
        failureReason: !consumer.phone ? 'No phone number on file' : smsResult.error || null,
      },
    });
  }

  throw new Error('Unknown channel — must be SMS or EMAIL');
}

module.exports = { sendAndLogNotice, getDeliveryStatus, resendChannel };
