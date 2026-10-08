const prisma = require('../config/db');
const { notifyUser } = require('./notificationService');
const { sendEmail, complaintStatusTemplate } = require('../utils/email');
const logger = require('../config/logger');

const EVENT_MESSAGES = {
  COMPLAINT_ACCEPTED: (num) => `Your complaint ${num} has been accepted and is being processed.`,
  COMPLAINT_REJECTED: (num, extra) => `Your complaint ${num} has been rejected. Reason: ${extra || 'Not specified'}.`,
  JUDGE_ASSIGNED: (num) => `A judge has been assigned to your complaint ${num}.`,
  HEARING_SCHEDULED: (num, extra) => `A hearing for complaint ${num} has been scheduled on ${extra}.`,
  HEARING_RESCHEDULED: (num, extra) => `The hearing for complaint ${num} has been rescheduled to ${extra}.`,
  HEARING_ADJOURNED: (num, extra) => `The hearing for complaint ${num} has been adjourned. ${extra || ''}`,
  JUDGMENT_UPLOADED: (num) => `The judgment for complaint ${num} has been uploaded and is available to download.`,
  CASE_CLOSED: (num) => `Complaint ${num} has been closed.`,
  REASSIGNMENT_APPROVED: (num, extra) => `Due to a judge's unavailability, complaint ${num} has been reassigned to a new judge. New hearing: ${extra || 'to be confirmed'}.`,
};

const EVENT_TITLES = {
  COMPLAINT_ACCEPTED: 'Complaint Accepted',
  COMPLAINT_REJECTED: 'Complaint Rejected',
  JUDGE_ASSIGNED: 'Judge Assigned',
  HEARING_SCHEDULED: 'Hearing Scheduled',
  HEARING_RESCHEDULED: 'Hearing Rescheduled',
  HEARING_ADJOURNED: 'Hearing Adjourned',
  JUDGMENT_UPLOADED: 'Judgment Uploaded',
  CASE_CLOSED: 'Case Closed',
  REASSIGNMENT_APPROVED: 'Hearing Reassigned',
};

/**
 * Fires both an in-app notification and an email for a workflow event.
 * Used by complaint/hearing/judgment controllers whenever a status
 * transition happens that the consumer (or relevant staff) should know about.
 *
 * @param {'COMPLAINT_ACCEPTED'|'COMPLAINT_REJECTED'|'JUDGE_ASSIGNED'|'HEARING_SCHEDULED'|'HEARING_RESCHEDULED'|'HEARING_ADJOURNED'|'JUDGMENT_UPLOADED'|'CASE_CLOSED'} eventType
 * @param {{userId: string, complaintId: string, complaintNumber: string, extra?: string}} params
 */
async function fireWorkflowNotification(eventType, { userId, complaintId, complaintNumber, extra }) {
  const messageBuilder = EVENT_MESSAGES[eventType];
  if (!messageBuilder) {
    logger.warn(`Unknown workflow notification event type: ${eventType}`);
    return;
  }

  const message = messageBuilder(complaintNumber, extra);
  const title = EVENT_TITLES[eventType];

  await notifyUser({ userId, title, message, type: eventType, relatedComplaintId: complaintId });

  // E-mail is NOT sent here any more: services/caseMailer.js e-mails BOTH parties from
  // every timeline entry, so one case event produces exactly one e-mail per party.
}

module.exports = { fireWorkflowNotification };
