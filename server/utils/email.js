const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../config/logger');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      // NOTE: nodemailer's key is `pass` (not `password`) — the old key made every login fail.
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    });
  }
  return transporter;
}

/** Is real SMTP configured? */
function isSmtpConfigured() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.password);
}

async function logEmail({ to, subject, event, complaintId, status, error }) {
  try {
    // Required lazily: db config must not be loaded just by importing the templates.
    const prisma = require('../config/db');
    await prisma.emailLog.create({
      data: { toEmail: String(to).slice(0, 255), subject: String(subject).slice(0, 300), event: event || null, complaintId: complaintId || null, status, error: error ? String(error).slice(0, 500) : null },
    });
  } catch (err) {
    logger.warn(`Could not write email log: ${err.message}`);
  }
}

/**
 * Sends an email and records the attempt in email_logs (SENT / FAILED / SKIPPED).
 * In development, if SMTP is not configured the email is logged instead of sent
 * so local work never breaks on missing SMTP setup.
 * `meta` ({ event, complaintId }) is optional and only used for the log.
 */
async function sendEmail({ to, subject, html }, meta = {}) {
  if (!to) return { skipped: true };

  if (!isSmtpConfigured()) {
    logger.warn(`SMTP not configured — logging email instead of sending. To: ${to}, Subject: ${subject}`);
    logger.debug(html);
    await logEmail({ to, subject, ...meta, status: 'SKIPPED', error: 'SMTP not configured' });
    return { skipped: true };
  }

  try {
    const info = await getTransporter().sendMail({ from: config.smtp.from, to, subject, html });
    await logEmail({ to, subject, ...meta, status: 'SENT' });
    return info;
  } catch (err) {
    logger.error(`Failed to send email to ${to}: ${err.message}`);
    await logEmail({ to, subject, ...meta, status: 'FAILED', error: err.message });
    throw err;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function baseTemplate(title, bodyHtml) {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <div style="background-color: #0d3b66; padding: 16px; border-radius: 6px 6px 0 0;">
      <h2 style="color: #ffffff; margin: 0;">State Consumer Forum</h2>
    </div>
    <div style="padding: 24px 8px;">
      <h3>${title}</h3>
      ${bodyHtml}
    </div>
    <p style="font-size: 12px; color: #888; margin-top: 24px;">
      This is an automated message from the State Consumer Forum Complaint Portal. Please do not reply to this email.
    </p>
  </div>`;
}

function emailVerificationTemplate(name, verifyUrl) {
  return baseTemplate(
    'Verify your email address',
    `<p>Hello ${name},</p>
     <p>Thank you for registering on the State Consumer Forum Portal. Please verify your email address to activate your account.</p>
     <p><a href="${verifyUrl}" style="background:#0d3b66;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">Verify Email</a></p>
     <p>This link will expire in 24 hours.</p>`
  );
}

function passwordResetTemplate(name, resetUrl) {
  return baseTemplate(
    'Reset your password',
    `<p>Hello ${name},</p>
     <p>We received a request to reset your password. Click the button below to set a new password.</p>
     <p><a href="${resetUrl}" style="background:#0d3b66;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">Reset Password</a></p>
     <p>This link will expire in 1 hour. If you did not request this, please ignore this email.</p>`
  );
}

function complaintStatusTemplate(name, complaintNumber, statusMessage) {
  return baseTemplate(
    `Update on Complaint ${complaintNumber}`,
    `<p>Hello ${name},</p>
     <p>${statusMessage}</p>
     <p>Complaint Number: <strong>${complaintNumber}</strong></p>
     <p>You can track full details by logging into the portal.</p>`
  );
}

/**
 * Standard case-progress email sent to the consumer and the opposite party.
 * `details` is a list of [label, value] rows; `cta` is { url, label }.
 */
function caseUpdateTemplate({ name, complaintNumber, headline, message, details = [], cta }) {
  const rows = details
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap;">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(v)}</td></tr>`)
    .join('');
  return baseTemplate(
    escapeHtml(headline),
    `<p>Hello ${escapeHtml(name)},</p>
     <p style="white-space:pre-line;">${escapeHtml(message)}</p>
     <table style="border-collapse:collapse;margin:12px 0;font-size:14px;">
       <tr><td style="padding:6px 12px 6px 0;color:#666;">Case number</td><td style="padding:6px 0;font-weight:700;">${escapeHtml(complaintNumber)}</td></tr>
       ${rows}
     </table>
     ${cta ? `<p><a href="${cta.url}" style="background:#0d3b66;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;">${escapeHtml(cta.label)}</a></p>` : ''}`
  );
}

module.exports = {
  sendEmail,
  isSmtpConfigured,
  escapeHtml,
  caseUpdateTemplate,
  emailVerificationTemplate,
  passwordResetTemplate,
  complaintStatusTemplate,
};
