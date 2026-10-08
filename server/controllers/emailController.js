const prisma = require('../config/db');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { sendEmail, isSmtpConfigured, caseUpdateTemplate } = require('../utils/email');

// GET /email/logs  (Admin)
async function listLogs(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25);
  const where = {
    ...(req.query.status ? { status: req.query.status } : {}),
    ...(req.query.search ? { OR: [
      { toEmail: { contains: req.query.search, mode: 'insensitive' } },
      { subject: { contains: req.query.search, mode: 'insensitive' } },
    ] } : {}),
  };
  const [items, total, sent, failed, skipped] = await Promise.all([
    prisma.emailLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.emailLog.count({ where }),
    prisma.emailLog.count({ where: { status: 'SENT' } }),
    prisma.emailLog.count({ where: { status: 'FAILED' } }),
    prisma.emailLog.count({ where: { status: 'SKIPPED' } }),
  ]);
  return new ApiResponse(200, {
    items, total, page, limit, totalPages: Math.ceil(total / limit),
    totals: { sent, failed, skipped },
    smtp: { configured: isSmtpConfigured(), host: config.smtp.host || null, user: config.smtp.user || null, from: config.smtp.from },
  }).send(res);
}

// POST /email/test  (Admin)  { to }
async function sendTest(req, res) {
  const to = (req.body.to || req.user.email || '').trim();
  if (!to) throw ApiError.badRequest('Recipient e-mail is required');
  if (!isSmtpConfigured()) {
    throw ApiError.badRequest('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD in server/.env and restart the server.');
  }
  try {
    await sendEmail({
      to, subject: 'Test e-mail — State Consumer Forum',
      html: caseUpdateTemplate({ name: 'Administrator', complaintNumber: 'TEST', headline: 'E-mail delivery works', message: 'If you can read this, the portal can send case updates to consumers and opposite parties.' }),
    }, { event: 'TEST' });
  } catch (err) {
    throw ApiError.badRequest(`The mail server rejected the message: ${err.message}`);
  }
  return new ApiResponse(200, null, `Test e-mail sent to ${to}`).send(res);
}

module.exports = { listLogs, sendTest };
