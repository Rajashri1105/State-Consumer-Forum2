// --------------------------------------------------------------------------
// Opposite-party portal: reply, extension, settlement.
// --------------------------------------------------------------------------
const path = require('path');
const dayjs = require('dayjs');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { addTimelineEntry } = require('../services/timelineService');
const { notifyUser } = require('../services/notificationService');
const { recordAudit } = require('../services/auditService');
const { assertComplaintAccess } = require('../services/scopeService');
const { MAX_EXTENSION_DAYS, TERMINAL } = require('../services/partyService');

const ACCESS_INCLUDE = { assignedJudge: { include: { user: { select: { id: true, name: true } } } } };

async function loadCase(id, user) {
  const complaint = await prisma.complaint.findUnique({ where: { id }, include: ACCESS_INCLUDE });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  assertComplaintAccess(complaint, user);
  return complaint;
}

function assertOpen(complaint) {
  if (TERMINAL.includes(complaint.status)) throw ApiError.badRequest('This case is already closed');
}

/** Judge and the bench's court clerks hear about every party action in-app. */
async function notifyBench(complaint, { title, message, type }) {
  const ids = new Set();
  if (complaint.assignedJudge?.user?.id) ids.add(complaint.assignedJudge.user.id);
  if (complaint.benchId) {
    const clerks = await prisma.user.findMany({ where: { role: 'CLERK', clerkType: 'COURT', benchId: complaint.benchId, isActive: true }, select: { id: true } });
    clerks.forEach((c) => ids.add(c.id));
  }
  await Promise.all([...ids].map((userId) => notifyUser({ userId, title, message: `${complaint.complaintNumber}: ${message}`, type, relatedComplaintId: complaint.id })));
}

// GET /party/cases  (Opposite party) — every case where a notice was served on them
async function listMyCases(req, res) {
  const items = await prisma.complaint.findMany({
    where: { oppositePartyUserId: req.user.id, noticeIssuedAt: { not: null } },
    select: {
      id: true, complaintNumber: true, title: true, status: true, sellerName: true, complaintAmount: true,
      noticeIssuedAt: true, replyDueDate: true, replyStatus: true, replyFiledAt: true, priority: true,
      category: { select: { name: true } }, consumer: { select: { name: true } },
    },
    orderBy: { noticeIssuedAt: 'desc' },
  });
  return new ApiResponse(200, { items }).send(res);
}

// GET /party/:id/responses  (any role with access to the case)
async function getResponses(req, res) {
  const complaint = await loadCase(req.params.id, req.user);
  const [replies, extensions, offers] = await Promise.all([
    prisma.partyReply.findMany({ where: { complaintId: complaint.id }, orderBy: { createdAt: 'desc' } }),
    prisma.extensionRequest.findMany({ where: { complaintId: complaint.id }, orderBy: { createdAt: 'desc' } }),
    prisma.settlementOffer.findMany({ where: { complaintId: complaint.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  return new ApiResponse(200, {
    noticeIssuedAt: complaint.noticeIssuedAt, replyDueDate: complaint.replyDueDate, replyStatus: complaint.replyStatus,
    replyFiledAt: complaint.replyFiledAt, extensionDaysGranted: complaint.extensionDaysGranted,
    maxExtensionDays: MAX_EXTENSION_DAYS, hasPortalAccount: Boolean(complaint.oppositePartyUserId),
    caseOpen: !TERMINAL.includes(complaint.status),
    replies, extensions, offers,
  }).send(res);
}

// POST /party/:id/reply  (Opposite party; multipart: text + files)
async function fileReply(req, res) {
  const complaint = await loadCase(req.params.id, req.user);
  assertOpen(complaint);
  const text = (req.body.text || '').trim();
  if (text.length < 20) throw ApiError.badRequest('Please write your reply (at least 20 characters)');

  const documents = (req.files || []).map((f) => ({
    fileName: f.originalname, filePath: path.join('replies', f.filename), fileSize: f.size, mimeType: f.mimetype,
  }));
  const isLate = complaint.replyStatus === 'EX_PARTE_ELIGIBLE' || (complaint.replyDueDate && new Date() > complaint.replyDueDate);

  const reply = await prisma.partyReply.create({ data: { complaintId: complaint.id, userId: req.user.id, text, documents, isLate } });
  await prisma.complaint.update({
    where: { id: complaint.id },
    data: { replyStatus: 'REPLY_FILED', replyFiledAt: complaint.replyFiledAt || new Date() },
  });

  const preview = text.length > 300 ? `${text.slice(0, 300)}…` : text;
  await addTimelineEntry(complaint.id, 'REPLY_FILED', `${isLate ? 'Filed after the deadline. ' : ''}${documents.length} document(s) attached.\n\n${preview}`, req.user.id);
  await notifyBench(complaint, { title: 'Opposite Party Reply Filed', message: `${complaint.oppositePartyName} filed a ${isLate ? 'late ' : ''}reply.`, type: 'REPLY_FILED' });
  await recordAudit({ userId: req.user.id, action: 'PARTY_REPLY_FILED', entityType: 'Complaint', entityId: complaint.id, ipAddress: req.ip });

  return new ApiResponse(201, { reply }, 'Your reply has been filed').send(res);
}

// POST /party/:id/extension  (Opposite party)
async function requestExtension(req, res) {
  const complaint = await loadCase(req.params.id, req.user);
  assertOpen(complaint);
  if (complaint.replyStatus !== 'AWAITING_REPLY') throw ApiError.badRequest('You can only ask for more time while your reply is still due');
  const left = MAX_EXTENSION_DAYS - complaint.extensionDaysGranted;
  if (left <= 0) throw ApiError.badRequest(`The maximum extension of ${MAX_EXTENSION_DAYS} days has already been used`);
  const pending = await prisma.extensionRequest.count({ where: { complaintId: complaint.id, status: 'PENDING' } });
  if (pending) throw ApiError.badRequest('You already have an extension request waiting for the judge');

  const days = Math.floor(Number(req.body.daysRequested));
  const reason = (req.body.reason || '').trim();
  if (!days || days < 1 || days > left) throw ApiError.badRequest(`Ask for between 1 and ${left} day(s)`);
  if (reason.length < 10) throw ApiError.badRequest('Please explain why you need more time');

  const request = await prisma.extensionRequest.create({ data: { complaintId: complaint.id, requestedById: req.user.id, reason, daysRequested: days } });
  await addTimelineEntry(complaint.id, 'EXTENSION_REQUESTED', `${days} more day(s) requested. Reason: ${reason}`, req.user.id);
  await notifyBench(complaint, { title: 'Extension Requested', message: `${complaint.oppositePartyName} asked for ${days} more day(s) to reply.`, type: 'EXTENSION_REQUESTED' });
  return new ApiResponse(201, { request }, 'Request sent to the judge').send(res);
}

// PATCH /party/extensions/:extId  (Judge of the case, Registrar, Admin)  { approve, days?, note? }
async function decideExtension(req, res) {
  const request = await prisma.extensionRequest.findUnique({ where: { id: req.params.extId } });
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== 'PENDING') throw ApiError.badRequest(`This request was already ${request.status.toLowerCase()}`);
  const complaint = await loadCase(request.complaintId, req.user);
  if (req.user.role === 'JUDGE' && complaint.assignedJudge?.user?.id !== req.user.id) throw ApiError.forbidden('Only the judge of this case can decide');

  const note = (req.body.note || '').trim() || null;
  const approve = req.body.approve === true || req.body.approve === 'true';

  if (!approve) {
    await prisma.extensionRequest.update({ where: { id: request.id }, data: { status: 'REJECTED', decidedById: req.user.id, decisionNote: note, decidedAt: new Date() } });
    await addTimelineEntry(complaint.id, 'EXTENSION_REJECTED', note ? `Judge's note: ${note}` : null, req.user.id);
    return new ApiResponse(200, null, 'Extension refused').send(res);
  }

  const left = MAX_EXTENSION_DAYS - complaint.extensionDaysGranted;
  const days = Math.min(Math.floor(Number(req.body.days)) || request.daysRequested, request.daysRequested, left);
  if (days < 1) throw ApiError.badRequest('No extension days are left to grant');

  const newDue = dayjs(complaint.replyDueDate).add(days, 'day').endOf('day').toDate();
  await prisma.$transaction([
    prisma.extensionRequest.update({ where: { id: request.id }, data: { status: 'APPROVED', daysGranted: days, decidedById: req.user.id, decisionNote: note, decidedAt: new Date() } }),
    prisma.complaint.update({
      where: { id: complaint.id },
      data: { replyDueDate: newDue, extensionDaysGranted: { increment: days }, replyReminder1Sent: false, replyReminder7Sent: false },
    }),
  ]);
  await addTimelineEntry(complaint.id, 'EXTENSION_GRANTED', `${days} day(s) granted.${note ? ` Judge's note: ${note}` : ''}`, req.user.id);
  return new ApiResponse(200, { replyDueDate: newDue }, `Extension of ${days} day(s) granted`).send(res);
}

// POST /party/:id/settlement  (Opposite party)  { amount?, terms }
async function offerSettlement(req, res) {
  const complaint = await loadCase(req.params.id, req.user);
  assertOpen(complaint);
  const terms = (req.body.terms || '').trim();
  if (terms.length < 10) throw ApiError.badRequest('Please describe the terms of your offer');
  const amount = req.body.amount === '' || req.body.amount == null ? null : Number(req.body.amount);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw ApiError.badRequest('Offer amount must be a positive number');
  const pending = await prisma.settlementOffer.count({ where: { complaintId: complaint.id, status: 'PENDING' } });
  if (pending) throw ApiError.badRequest('Withdraw your current offer before making a new one');

  const offer = await prisma.settlementOffer.create({ data: { complaintId: complaint.id, offeredById: req.user.id, amount, terms } });
  await addTimelineEntry(complaint.id, 'SETTLEMENT_OFFERED', `${amount !== null ? `Amount offered: ₹${amount.toLocaleString('en-IN')}\n` : ''}${terms}`, req.user.id);
  await notifyUser({ userId: complaint.consumerId, title: 'Settlement Offer Received', message: `${complaint.complaintNumber}: ${complaint.oppositePartyName} offered to settle. Please review it.`, type: 'SETTLEMENT_OFFERED', relatedComplaintId: complaint.id });
  await notifyBench(complaint, { title: 'Settlement Offered', message: 'The opposite party made a settlement offer to the consumer.', type: 'SETTLEMENT_OFFERED' });
  return new ApiResponse(201, { offer }, 'Offer sent to the consumer').send(res);
}

// PATCH /party/settlements/:offerId  (Consumer)  { accept, note? }
async function respondToSettlement(req, res) {
  const offer = await prisma.settlementOffer.findUnique({ where: { id: req.params.offerId } });
  if (!offer) throw ApiError.notFound('Offer not found');
  if (offer.status !== 'PENDING') throw ApiError.badRequest(`This offer was already ${offer.status.toLowerCase()}`);
  const complaint = await loadCase(offer.complaintId, req.user);
  if (complaint.consumerId !== req.user.id) throw ApiError.forbidden('Only the consumer can respond to a settlement offer');
  assertOpen(complaint);

  const accept = req.body.accept === true || req.body.accept === 'true';
  const note = (req.body.note || '').trim() || null;

  if (!accept) {
    await prisma.settlementOffer.update({ where: { id: offer.id }, data: { status: 'REJECTED', responseNote: note, respondedAt: new Date() } });
    await addTimelineEntry(complaint.id, 'SETTLEMENT_REJECTED', note ? `Consumer's note: ${note}` : null, req.user.id);
    return new ApiResponse(200, null, 'Offer rejected — the case continues').send(res);
  }

  await prisma.$transaction([
    prisma.settlementOffer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED', responseNote: note, respondedAt: new Date() } }),
    prisma.complaint.update({ where: { id: complaint.id }, data: { status: 'SETTLED', disposedAt: new Date() } }),
    prisma.hearing.updateMany({ where: { complaintId: complaint.id, status: 'SCHEDULED' }, data: { status: 'CANCELLED', remarks: 'Case settled between the parties.' } }),
  ]);
  const amountText = offer.amount !== null ? `Settled for ₹${Number(offer.amount).toLocaleString('en-IN')}. ` : '';
  await addTimelineEntry(complaint.id, 'SETTLED', `${amountText}${offer.terms}`, req.user.id);
  await notifyBench(complaint, { title: 'Case Settled', message: 'The parties settled; scheduled hearings were cancelled.', type: 'SETTLEMENT_DECIDED' });
  await recordAudit({ userId: req.user.id, action: 'CASE_SETTLED', entityType: 'Complaint', entityId: complaint.id, ipAddress: req.ip });
  return new ApiResponse(200, null, 'Settlement accepted — the case is closed').send(res);
}

// PATCH /party/settlements/:offerId/withdraw  (Opposite party)
async function withdrawSettlement(req, res) {
  const offer = await prisma.settlementOffer.findUnique({ where: { id: req.params.offerId } });
  if (!offer) throw ApiError.notFound('Offer not found');
  const complaint = await loadCase(offer.complaintId, req.user);
  if (offer.offeredById !== req.user.id) throw ApiError.forbidden('This is not your offer');
  if (offer.status !== 'PENDING') throw ApiError.badRequest(`This offer was already ${offer.status.toLowerCase()}`);
  await prisma.settlementOffer.update({ where: { id: offer.id }, data: { status: 'WITHDRAWN', respondedAt: new Date() } });
  await addTimelineEntry(complaint.id, 'SETTLEMENT_WITHDRAWN', null, req.user.id);
  return new ApiResponse(200, null, 'Offer withdrawn').send(res);
}

// POST /party/:id/resend-invite  (Registrar, Admin, Court Clerk of the case)
async function resendInvite(req, res) {
  const complaint = await prisma.complaint.findUnique({
    where: { id: req.params.id },
    include: ACCESS_INCLUDE,
  });
  if (!complaint) throw ApiError.notFound('Complaint not found');

  const { assertBenchClerkOrOversight } = require('../services/scopeService');
  assertBenchClerkOrOversight(complaint, req.user);

  if (!complaint.oppositePartyEmail) {
    throw ApiError.badRequest('No e-mail address registered for the opposite party on this complaint');
  }

  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');
  const config = require('../config/env');
  const { generateSecureToken } = require('../utils/cryptoUtils');
  const { sendEmail, caseUpdateTemplate } = require('../utils/email');

  const lowerEmail = complaint.oppositePartyEmail.trim().toLowerCase();
  let partyUser = await prisma.user.findFirst({
    where: { email: { equals: lowerEmail, mode: 'insensitive' } },
  });

  const { rawToken, hashedToken } = generateSecureToken();
  const passwordResetExpiry = new Date(Date.now() + 14 * 24 * 3600 * 1000);

  if (partyUser) {
    if (partyUser.role !== 'OPPOSITE_PARTY') {
      throw ApiError.badRequest('The e-mail address belongs to a non-opposite party account');
    }
    await prisma.user.update({
      where: { id: partyUser.id },
      data: { passwordResetToken: hashedToken, passwordResetExpiry },
    });
  } else {
    const defaultPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    partyUser = await prisma.user.create({
      data: {
        name: complaint.oppositePartyName,
        email: lowerEmail,
        phone: complaint.oppositePartyPhone || null,
        password: defaultPassword,
        role: 'OPPOSITE_PARTY',
        isEmailVerified: true,
        passwordResetToken: hashedToken,
        passwordResetExpiry,
      },
    });
  }

  if (!complaint.oppositePartyUserId && partyUser) {
    await prisma.complaint.update({
      where: { id: complaint.id },
      data: { oppositePartyUserId: partyUser.id },
    });
  }

  const setupUrl = `${config.clientUrl}/reset-password?token=${rawToken}`;

  await sendEmail({
    to: complaint.oppositePartyEmail,
    subject: `State Consumer Forum portal account invitation — ${complaint.complaintNumber}`,
    html: caseUpdateTemplate({
      name: complaint.oppositePartyName,
      complaintNumber: complaint.complaintNumber,
      headline: 'Your portal account invitation',
      message: `You have been invited to access the State Consumer Forum portal for complaint ${complaint.complaintNumber}.\n\nSet your password with the button below (valid for 14 days). Your login is this e-mail address.`,
      cta: { url: setupUrl, label: 'Set my password' },
    }),
  }, { event: 'RESEND_PORTAL_INVITE', complaintId: complaint.id });

  await recordAudit({
    userId: req.user.id,
    action: 'RESEND_PORTAL_INVITE',
    entityType: 'Complaint',
    entityId: complaint.id,
    ipAddress: req.ip,
  });

  return new ApiResponse(200, null, 'Portal invitation email resent successfully').send(res);
}

module.exports = { listMyCases, getResponses, fileReply, requestExtension, decideExtension, offerSettlement, respondToSettlement, withdrawSettlement, resendInvite };

