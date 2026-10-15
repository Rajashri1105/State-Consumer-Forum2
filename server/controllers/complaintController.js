const path = require('path');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { computePriority } = require('../services/priorityEngine');
const { findPossibleDuplicates } = require('../services/duplicateDetectionService');
const { generateComplaintNumber } = require('../services/complaintNumberService');
const { recommendJudge } = require('../services/workloadBalancerService');
const { addTimelineEntry, getTimeline } = require('../services/timelineService');
const { fireWorkflowNotification } = require('../services/workflowNotifier');
const { notifyUser } = require('../services/notificationService');
const { recordAudit } = require('../services/auditService');
const { generateComplaintReceipt, generateSynopsisPdf } = require('../services/pdfService');
const { getComplaintTitle } = require('../utils/complaintTitle');
const { validateAndDetermineJurisdiction, determineJurisdiction } = require('../services/jurisdictionEngine');
const { computeCourtFee } = require('../services/courtFeeService');
const { generateSynopsis } = require('../services/synopsisService');
const { checkCompleteness } = require('../services/completenessChecker');
const allotment = require('../services/allotmentService');
const { complaintScope, assertComplaintAccess, isScrutiny } = require('../services/scopeService');
const { getBenchWorkload } = require('../services/workloadBalancerService');
const { runEscalationSweep } = require('../services/escalationService');

const COMPLAINT_INCLUDE = {
  category: true,
  consumer: { select: { id: true, name: true, email: true, phone: true, address: true } },
  verifiedBy: { select: { id: true, name: true } },
  assignedClerk: { select: { id: true, name: true, email: true } },
  assignedJudge: { include: { user: { select: { id: true, name: true } } } },
  evidence: true,
  hearings: { orderBy: { scheduledDate: 'desc' } },
  judgment: true,
  oppositeParties: true,
  feedback: true,
  bench: { select: { id: true, name: true, courtRoom: true } },
  allottedBy: { select: { id: true, name: true } },
  allotments: { orderBy: { createdAt: 'desc' }, take: 5 },
};

function paginationParams(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

// --------------------------------------------------------------------------
// POST /complaints  (Consumer)
// --------------------------------------------------------------------------
async function createComplaint(req, res) {
  const {
    caseType = 'NEW_COMPLAINT',
    categoryId, sellerName, oppositePartyName, oppositePartyAddress, oppositePartyEmail, oppositePartyPhone,
    product, service, purchaseDate, invoiceNumber, complaintAmount,
    description, overrideDuplicateWarning, additionalOppositeParties,
    synopsisText, synopsisManualConfirm,
    districtCaseNumber, districtCommissionName, districtOrderDate, appealGrounds,
  } = req.body;

  const category = await prisma.complaintCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw ApiError.badRequest('Invalid complaint category');

  // --- Validate Jurisdiction engine rule ---
  const jur = validateAndDetermineJurisdiction(caseType, complaintAmount);
  if (!jur.valid) {
    throw ApiError.badRequest(jur.message);
  }
  const jurisdictionLevel = jur.level;

  // --- Novelty #4: Duplicate Complaint Detection ---
  const duplicates = await findPossibleDuplicates({
    consumerId: req.user.id,
    oppositePartyName,
    description,
  });

  if (duplicates.length > 0 && overrideDuplicateWarning !== true && overrideDuplicateWarning !== 'true') {
    return new ApiResponse(200, {
      possibleDuplicateFound: true,
      duplicates: duplicates.slice(0, 5),
    }, 'Possible duplicate complaint(s) found. Review them, then resubmit with overrideDuplicateWarning=true to proceed anyway.').send(res);
  }

  // --- Novelty #2: Smart Complaint Priority Engine ---
  const priorityResult = await computePriority({ description, product, service, category });

  // --- Auto-computed statutory court fee ---
  const courtFee = computeCourtFee(caseType, complaintAmount);

  const complaintNumber = await generateComplaintNumber();

  // Additional opposite parties beyond the primary one
  const extraParties = Array.isArray(additionalOppositeParties)
    ? additionalOppositeParties.filter((p) => p && p.name && p.name.trim())
    : [];

  const effectiveSellerName = (caseType === 'APPEAL' && (!sellerName || !sellerName.trim()))
    ? oppositePartyName
    : sellerName;

  const complaint = await prisma.complaint.create({
    data: {
      complaintNumber,
      caseType,
      title: getComplaintTitle({ consumer: { name: req.user.name }, oppositePartyName }),
      consumerName: req.user.name,
      consumerId: req.user.id,
      categoryId,
      sellerName: effectiveSellerName,
      oppositePartyName,
      oppositePartyAddress,
      oppositePartyEmail: oppositePartyEmail ? oppositePartyEmail.trim().toLowerCase() : null,
      oppositePartyPhone: oppositePartyPhone || null,
      product,
      service,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      invoiceNumber,
      complaintAmount,
      courtFee,
      description,
      districtCaseNumber: caseType === 'APPEAL' ? districtCaseNumber?.trim() : null,
      districtCommissionName: caseType === 'APPEAL' ? districtCommissionName?.trim() : null,
      districtOrderDate: (caseType === 'APPEAL' && districtOrderDate) ? new Date(districtOrderDate) : null,
      appealGrounds: caseType === 'APPEAL' ? appealGrounds?.trim() : null,
      jurisdictionLevel,
      synopsisText: synopsisText?.trim() || null,
      synopsisGeneratedAt: synopsisText?.trim() ? new Date() : null,
      synopsisManualConfirm: Boolean(synopsisManualConfirm) && !synopsisText?.trim(),
      priority: priorityResult.priority,
      possibleDuplicateOfId: duplicates[0]?.complaint.id || null,
      duplicateOverridden: duplicates.length > 0,
      oppositeParties: extraParties.length > 0
        ? { create: extraParties.map((p) => ({ name: p.name.trim(), address: p.address?.trim() || null, email: p.email ? p.email.trim().toLowerCase() : null })) }
        : undefined,
    },
    include: COMPLAINT_INCLUDE,
  });

  const feeMsg = caseType === 'APPEAL' ? 'No court fee for appeals' : `Court fee: ₹${courtFee}`;
  const timelineText = [
    `Consumer: ${req.user.name} | Opposite party: ${oppositePartyName}.`,
    caseType === 'APPEAL'
      ? `Appeal against District Commission order ${districtCaseNumber || ''}. ${feeMsg}. Jurisdiction: STATE COMMISSION.`
      : `Priority auto-assigned as ${priorityResult.priority}. ${priorityResult.reason} ${feeMsg}. Jurisdiction: STATE COMMISSION.`,
  ].join(' ');

  await addTimelineEntry(complaint.id, 'SUBMITTED', timelineText, req.user.id);
  await recordAudit({ userId: req.user.id, action: 'COMPLAINT_SUBMITTED', entityType: 'Complaint', entityId: complaint.id, ipAddress: req.ip });

  // Shared intake queue: let every active scrutiny clerk know
  const scrutinyClerks = await prisma.user.findMany({
    where: { role: 'CLERK', clerkType: 'SCRUTINY', isActive: true },
    select: { id: true },
  });
  await Promise.all(scrutinyClerks.map((c) => notifyUser({
    userId: c.id,
    title: 'New Complaint in Intake Queue',
    message: `Complaint ${complaint.complaintNumber} (${priorityResult.priority} priority) is waiting for scrutiny. Claim it from the intake queue.`,
    type: 'COMPLAINT_SUBMITTED',
    relatedComplaintId: complaint.id,
  })));

  return new ApiResponse(201, { complaint, priorityReasoning: priorityResult }, 'Complaint submitted successfully').send(res);
}

// --------------------------------------------------------------------------
// POST /complaints/synopsis/generate  (Consumer) — Feature 2
// Called from the filing form, before the complaint exists. Isolated
// LLM module (server/services/synopsisService.js) does the actual call.
// --------------------------------------------------------------------------
async function generateSynopsisDraft(req, res) {
  const { categoryId, sellerName, oppositePartyName, complaintAmount, description } = req.body;
  if (!description || description.trim().length < 20) {
    throw ApiError.badRequest('Please provide a detailed description (min 20 characters) before generating a synopsis');
  }

  let categoryName;
  if (categoryId) {
    const category = await prisma.complaintCategory.findUnique({ where: { id: categoryId } });
    categoryName = category?.name;
  }

  const { text, source } = await generateSynopsis({
    category: categoryName, sellerName, oppositePartyName, claimAmount: complaintAmount, description,
  });

  return new ApiResponse(200, { synopsisText: text, source }, 'Synopsis draft generated').send(res);
}

// --------------------------------------------------------------------------
// POST /complaints/:id/synopsis/generate  (Consumer — owner) — regenerate
// or (re)store a synopsis against an already-filed complaint.
// --------------------------------------------------------------------------
async function regenerateSynopsis(req, res) {
  const { id } = req.params;
  const { synopsisText: manualText } = req.body;

  const complaint = await prisma.complaint.findUnique({ where: { id }, include: { category: true } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.consumerId !== req.user.id) throw ApiError.forbidden('You can only edit the synopsis on your own complaint');

  let synopsisText = manualText?.trim();
  let source = 'manual';
  if (!synopsisText) {
    const generated = await generateSynopsis({
      category: complaint.category?.name, sellerName: complaint.sellerName, oppositePartyName: complaint.oppositePartyName,
      claimAmount: complaint.complaintAmount, description: complaint.description,
    });
    synopsisText = generated.text;
    source = generated.source;
  }

  const updated = await prisma.complaint.update({
    where: { id }, data: { synopsisText, synopsisGeneratedAt: new Date(), synopsisManualConfirm: source === 'manual' },
  });

  return new ApiResponse(200, { complaint: updated, source }, 'Synopsis updated').send(res);
}

// --------------------------------------------------------------------------
// GET /complaints/:id/synopsis/pdf — export the synopsis as a PDF
// (reuses the existing PDF generation pipeline used for the filing
// receipt, per the implementation notes).
// --------------------------------------------------------------------------
async function downloadSynopsisPdf(req, res) {
  const { id } = req.params;
  const complaint = await prisma.complaint.findUnique({ where: { id }, include: COMPLAINT_INCLUDE });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  assertComplaintAccess(complaint, req.user);
  if (!complaint.synopsisText) throw ApiError.badRequest('No synopsis has been generated for this complaint yet');

  const pdfBytes = await generateSynopsisPdf(complaint);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${complaint.complaintNumber}-synopsis.pdf"`);
  res.send(Buffer.from(pdfBytes));
}

// --------------------------------------------------------------------------
// GET /complaints/:id/completeness  — Feature 3 checklist, re-checkable
// at any time (also enforced server-side before clerk verification).
// --------------------------------------------------------------------------
async function getCompleteness(req, res) {
  const { id } = req.params;
  const complaint = await prisma.complaint.findUnique({ where: { id }, include: { evidence: true } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  assertComplaintAccess(complaint, req.user);

  const result = checkCompleteness({
    complaintAmount: complaint.complaintAmount,
    oppositePartyName: complaint.oppositePartyName,
    evidenceCount: complaint.evidence.length,
    synopsisText: complaint.synopsisText,
    synopsisManualConfirm: complaint.synopsisManualConfirm,
  });

  return new ApiResponse(200, result).send(res);
}

// --------------------------------------------------------------------------
// POST /complaints/:id/evidence  (Consumer — owner only)
// --------------------------------------------------------------------------
async function uploadEvidence(req, res) {
  const { id } = req.params;
  const { type = 'OTHER' } = req.body;

  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.consumerId !== req.user.id) throw ApiError.forbidden('You can only upload evidence to your own complaint');
  if (['CLOSED', 'DISPOSED'].includes(complaint.status)) {
    throw ApiError.badRequest('Cannot add evidence to a closed or disposed complaint');
  }

  const files = req.files || [];
  if (files.length === 0) throw ApiError.badRequest('No files were uploaded');

  const created = await prisma.$transaction(
    files.map((file) =>
      prisma.evidence.create({
        data: {
          complaintId: id,
          type,
          fileName: file.originalname,
          filePath: path.join('evidence', file.filename),
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedById: req.user.id,
        },
      })
    )
  );

  return new ApiResponse(201, { evidence: created }, 'Evidence uploaded successfully').send(res);
}

// --------------------------------------------------------------------------
// GET /complaints/mine  (Consumer)
// --------------------------------------------------------------------------
async function getMyComplaints(req, res) {
  const { status, priority } = req.query;
  const { page, limit, skip } = paginationParams(req.query);

  const where = {
    consumerId: req.user.id,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.complaint.findMany({ where, include: COMPLAINT_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.complaint.count({ where }),
  ]);

  return new ApiResponse(200, { items, total, page, limit, totalPages: Math.ceil(total / limit) }).send(res);
}

// --------------------------------------------------------------------------
// GET /complaints  (Clerk, Judge, Admin)
// --------------------------------------------------------------------------
async function listComplaints(req, res) {
  const { status, priority, categoryId, search, myQueue, isDelayed, benchId, caseType } = req.query;
  const { page, limit, skip } = paginationParams(req.query);

  // Feature 5: Fire the escalation sweep only for admin/registrar dashboards
  // (where overdue flags are surfaced), NOT for every scrutiny clerk page load.
  // Scrutiny clerks only see SUBMITTED/UNDER_VERIFICATION complaints which
  // can never be flagged, so running a full DB sweep per request is wasted work.
  if (['ADMIN', 'REGISTRAR'].includes(req.user.role)) {
    runEscalationSweep().catch((err) => require('../config/logger').error('Escalation sweep (on page load) failed:', err.message));
  }

  const filters = {
    ...(caseType ? { caseType } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(isDelayed !== undefined ? { isDelayed: isDelayed === 'true' } : {}),
    ...(benchId && ['REGISTRAR', 'ADMIN'].includes(req.user.role) ? { benchId } : {}),
    ...(search ? {
      OR: [
        { complaintNumber: { contains: search, mode: 'insensitive' } },
        { oppositePartyName: { contains: search, mode: 'insensitive' } },
        { sellerName: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const where = {
    AND: [
      filters,
      await complaintScope(req.user),
      ...(isScrutiny(req.user) && (myQueue === 'true' || myQueue === true)
        ? [{ OR: [{ assignedClerkId: req.user.id }, { verifiedById: req.user.id }] }]
        : []),
    ],
  };

  // Role/bench scoping lives in ONE place (scopeService) — never filter by hand here.
  // Intake queue is worked oldest-first; everything else newest-first.
  const intake = status === 'SUBMITTED';
  const orderBy = intake
    ? [{ priority: 'asc' }, { createdAt: 'asc' }]
    : [{ priority: 'asc' }, { createdAt: 'desc' }];

  const [items, total] = await Promise.all([
    prisma.complaint.findMany({ where, include: COMPLAINT_INCLUDE, orderBy, skip, take: limit }),
    prisma.complaint.count({ where }),
  ]);

  return new ApiResponse(200, { items, total, page, limit, totalPages: Math.ceil(total / limit) }).send(res);
}

// --------------------------------------------------------------------------
// GET /complaints/:id
// --------------------------------------------------------------------------
async function getComplaintById(req, res) {
  const { id } = req.params;

  // Run the main complaint fetch and timeline in parallel — two independent queries.
  const [complaint, timeline] = await Promise.all([
    prisma.complaint.findUnique({ where: { id }, include: COMPLAINT_INCLUDE }),
    getTimeline(id),
  ]);
  if (!complaint) throw ApiError.notFound('Complaint not found');

  assertComplaintAccess(complaint, req.user);

  let resolvedTimeline = timeline.map((entry) => (
    entry.stage === 'Final Judgment Published' && complaint.judgment?.filePath
      ? { ...entry, documentPath: complaint.judgment.filePath }
      : entry
  ));
  const publicComplaint = ['CONSUMER', 'OPPOSITE_PARTY'].includes(req.user.role)
    && !complaint.judgment?.filePath
    ? { ...complaint, judgment: null }
    : complaint;

  // The opposite party sees the case from the day the notice was served on them —
  // not the consumer's contact details nor the forum's internal handling notes.
  if (req.user.role === 'OPPOSITE_PARTY') {
    const since = complaint.noticeIssuedAt;
    resolvedTimeline = resolvedTimeline.filter((t) => since && t.createdAt >= since).map((t) => ({ ...t, actor: t.actor ? { name: t.actor.name, role: t.actor.role } : null }));
    const { assignedClerk, verifiedBy, allottedBy, allotments, feedback, possibleDuplicateOfId, ...visible } = publicComplaint;
    return new ApiResponse(200, {
      complaint: {
        ...visible,
        consumer: { name: complaint.consumerName || complaint.consumer?.name },
        courtFee: undefined,
      },
      timeline: resolvedTimeline,
    }).send(res);
  }

  const complaintWithHistoricalConsumer = {
    ...publicComplaint,
    consumer: publicComplaint.consumer
      ? { ...publicComplaint.consumer, name: publicComplaint.consumerName || publicComplaint.consumer.name }
      : publicComplaint.consumer,
  };
  return new ApiResponse(200, { complaint: complaintWithHistoricalConsumer, timeline: resolvedTimeline }).send(res);
}

// --------------------------------------------------------------------------
// PATCH /complaints/:id/claim  (Scrutiny clerk) — take a complaint from the
// shared intake queue. Atomic: two clerks can never hold the same complaint.
// --------------------------------------------------------------------------
async function claimComplaint(req, res) {
  if (!isScrutiny(req.user)) throw ApiError.forbidden('Only scrutiny (intake) clerks can claim complaints');
  await allotment.claimComplaint(req.params.id, req.user);
  const full = await prisma.complaint.findUnique({ where: { id: req.params.id }, include: COMPLAINT_INCLUDE });
  return new ApiResponse(200, { complaint: full }, 'Complaint claimed — you are now responsible for scrutinising it').send(res);
}

// PATCH /complaints/:id/release  (Scrutiny clerk) — give a claimed complaint back
async function releaseComplaint(req, res) {
  await allotment.releaseComplaint(req.params.id, req.user);
  return new ApiResponse(200, null, 'Complaint returned to the intake queue').send(res);
}

/** Load a complaint and make sure the caller is the scrutiny clerk who claimed it. */
async function loadClaimedByMe(id, user, include) {
  if (!isScrutiny(user)) throw ApiError.forbidden('Only scrutiny clerks perform verification');
  const complaint = await prisma.complaint.findUnique({ where: { id }, include });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.status !== 'UNDER_VERIFICATION') {
    throw ApiError.badRequest(complaint.status === 'SUBMITTED'
      ? 'Claim this complaint from the intake queue before verifying it'
      : `Complaint is already in "${complaint.status}" status`);
  }
  if (complaint.assignedClerkId !== user.id) throw ApiError.forbidden('This complaint is claimed by another clerk');
  return complaint;
}

// --------------------------------------------------------------------------
// PATCH /complaints/:id/verify  (Scrutiny clerk who claimed it)
// After acceptance the complaint is allotted to a bench (auto or by Registrar).
// --------------------------------------------------------------------------
async function verifyAndAccept(req, res) {
  const { id } = req.params;
  const { remarks } = req.body;

  const complaint = await loadClaimedByMe(id, req.user, { evidence: true });

  // --- Feature 3: Document Completeness Checker (server-side enforcement) ---
  const completeness = checkCompleteness({
    caseType: complaint.caseType,
    complaintAmount: complaint.complaintAmount,
    oppositePartyName: complaint.oppositePartyName,
    evidenceCount: complaint.evidence.length,
    synopsisText: complaint.synopsisText,
    synopsisManualConfirm: complaint.synopsisManualConfirm,
    evidenceTypes: complaint.evidence.map((e) => e.type),
  });
  if (!completeness.isComplete) {
    throw ApiError.badRequest(`This complaint cannot be accepted yet — missing: ${completeness.missing.join('; ')}. You can mark it as defective so the consumer can fix it.`);
  }

  await prisma.complaint.update({
    where: { id },
    data: { status: 'PENDING_ALLOTMENT', verifiedById: req.user.id, verifiedAt: new Date(), acceptedAt: new Date(), defectRemarks: null },
  });

  await addTimelineEntry(id, 'ACCEPTED', remarks || 'Verified and accepted by scrutiny clerk. Awaiting bench allotment.', req.user.id);
  await fireWorkflowNotification('COMPLAINT_ACCEPTED', { userId: complaint.consumerId, complaintId: id, complaintNumber: complaint.complaintNumber });
  await recordAudit({ userId: req.user.id, action: 'COMPLAINT_ACCEPTED', entityType: 'Complaint', entityId: id, ipAddress: req.ip });

  // Bench allotment: automatic (least-loaded) unless the forum runs in MANUAL mode.
  await allotment.allotAfterAcceptance(id, req.user);

  const full = await prisma.complaint.findUnique({ where: { id }, include: COMPLAINT_INCLUDE });
  const msg = full.status === 'JUDGE_ASSIGNED'
    ? `Complaint verified and allotted to ${full.bench?.name || 'a bench'}`
    : 'Complaint verified; waiting in the Registrar\'s allotment queue';
  return new ApiResponse(200, { complaint: full }, msg).send(res);
}

// --------------------------------------------------------------------------
// PATCH /complaints/:id/reject  (Scrutiny clerk who claimed it)
// --------------------------------------------------------------------------
async function rejectComplaint(req, res) {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  const complaint = await loadClaimedByMe(id, req.user);

  const updated = await prisma.complaint.update({
    where: { id },
    data: { status: 'REJECTED', verifiedById: req.user.id, verifiedAt: new Date(), rejectionReason },
    include: COMPLAINT_INCLUDE,
  });

  await addTimelineEntry(id, 'REJECTED', rejectionReason, req.user.id);
  await fireWorkflowNotification('COMPLAINT_REJECTED', { userId: complaint.consumerId, complaintId: id, complaintNumber: complaint.complaintNumber, extra: rejectionReason });
  await recordAudit({ userId: req.user.id, action: 'COMPLAINT_REJECTED', entityType: 'Complaint', entityId: id, details: { rejectionReason }, ipAddress: req.ip });

  return new ApiResponse(200, { complaint: updated }, 'Complaint rejected').send(res);
}

// --------------------------------------------------------------------------
// PATCH /complaints/:id/defective  (Scrutiny clerk who claimed it)
// Send it back to the consumer to fix (missing documents, signature, etc.).
// --------------------------------------------------------------------------
async function markDefective(req, res) {
  const { id } = req.params;
  const { remarks } = req.body;
  if (!remarks || !remarks.trim()) throw ApiError.badRequest('Please say what is defective so the consumer can fix it');

  const complaint = await loadClaimedByMe(id, req.user);

  const updated = await prisma.complaint.update({
    where: { id },
    data: { status: 'DEFECTIVE', defectRemarks: remarks.trim(), verifiedById: req.user.id, verifiedAt: new Date() },
    include: COMPLAINT_INCLUDE,
  });

  await addTimelineEntry(id, 'DEFECTIVE', remarks.trim(), req.user.id);
  await notifyUser({
    userId: complaint.consumerId,
    title: 'Complaint Needs Correction',
    message: `Complaint ${complaint.complaintNumber} has defects: ${remarks.trim()} Please fix them and resubmit.`,
    type: 'COMPLAINT_DEFECTIVE',
    relatedComplaintId: id,
  });
  await recordAudit({ userId: req.user.id, action: 'COMPLAINT_MARKED_DEFECTIVE', entityType: 'Complaint', entityId: id, details: { remarks }, ipAddress: req.ip });

  return new ApiResponse(200, { complaint: updated }, 'Complaint marked defective and returned to the consumer').send(res);
}

// --------------------------------------------------------------------------
// PATCH /complaints/:id/resubmit  (Consumer) — after fixing the defects the
// complaint re-enters the shared intake queue.
// --------------------------------------------------------------------------
async function resubmitComplaint(req, res) {
  const { id } = req.params;
  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.consumerId !== req.user.id) throw ApiError.forbidden('You can only resubmit your own complaint');
  if (complaint.status !== 'DEFECTIVE') throw ApiError.badRequest('Only a complaint marked defective can be resubmitted');

  const updated = await prisma.complaint.update({
    where: { id },
    data: { status: 'SUBMITTED', assignedClerkId: null },
    include: COMPLAINT_INCLUDE,
  });
  await addTimelineEntry(id, 'SUBMITTED', 'Resubmitted by the consumer after correcting the defects.', req.user.id);
  await recordAudit({ userId: req.user.id, action: 'COMPLAINT_RESUBMITTED', entityType: 'Complaint', entityId: id, ipAddress: req.ip });

  const scrutinyClerks = await prisma.user.findMany({ where: { role: 'CLERK', clerkType: 'SCRUTINY', isActive: true }, select: { id: true } });
  await Promise.all(scrutinyClerks.map((c) => notifyUser({
    userId: c.id, title: 'Complaint Resubmitted',
    message: `Complaint ${complaint.complaintNumber} was corrected and is back in the intake queue.`,
    type: 'COMPLAINT_SUBMITTED', relatedComplaintId: id,
  })));

  return new ApiResponse(200, { complaint: updated }, 'Complaint resubmitted for scrutiny').send(res);
}

// --------------------------------------------------------------------------
// PATCH /complaints/:id/reappeal  (Consumer) — after rectifying the reason
// for rejection, the consumer can re-appeal: the complaint re-enters the
// shared intake queue for fresh scrutiny review.
// --------------------------------------------------------------------------
async function reappealComplaint(req, res) {
  const { id } = req.params;
  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.consumerId !== req.user.id) throw ApiError.forbidden('You can only re-appeal your own complaint');
  if (complaint.status !== 'REJECTED') throw ApiError.badRequest('Only a complaint that was rejected can be re-appealed');

  // Enforce max 1 re-appeal: if already re-appealed once and rejected again, the consumer must file a new complaint.
  if (complaint.reappealCount >= 1) {
    throw ApiError.conflict(
      'You have already used your one permitted re-appeal for this complaint. ' +
      'The second rejection is final — please file a new complaint if you wish to pursue the matter further.'
    );
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      status: 'SUBMITTED',
      assignedClerkId: null,
      verifiedById: null,
      verifiedAt: null,
      rejectionReason: null,
      reappealCount: { increment: 1 }, // atomically track that one re-appeal has been used
    },
    include: COMPLAINT_INCLUDE,
  });

  await addTimelineEntry(id, 'SUBMITTED', 'Re-appealed by the consumer after rectifying the rejection reason. Returned to the intake queue for fresh scrutiny (1 re-appeal used).', req.user.id);
  await recordAudit({ userId: req.user.id, action: 'COMPLAINT_REAPPEALED', entityType: 'Complaint', entityId: id, ipAddress: req.ip });

  // Notify all active scrutiny clerks
  const scrutinyClerks = await prisma.user.findMany({ where: { role: 'CLERK', clerkType: 'SCRUTINY', isActive: true }, select: { id: true } });
  await Promise.all(scrutinyClerks.map((c) => notifyUser({
    userId: c.id,
    title: 'Complaint Re-appealed (1 of 1 attempt)',
    message: `Complaint ${complaint.complaintNumber} was rejected and the consumer has used their one permitted re-appeal. It is back in the intake queue for final review.`,
    type: 'COMPLAINT_SUBMITTED',
    relatedComplaintId: id,
  })));

  return new ApiResponse(200, { complaint: updated }, 'Complaint re-appealed — it is back in the scrutiny intake queue').send(res);
}

// --------------------------------------------------------------------------
// GET /complaints/judge-recommendations  (Registrar, Admin) — Novelty #3
// --------------------------------------------------------------------------
async function getJudgeRecommendations(req, res) {
  const { recommended, ranked } = await recommendJudge();
  return new ApiResponse(200, { recommended, ranked }, 'Judge workload ranking computed').send(res);
}

// --------------------------------------------------------------------------
// GET /complaints/allotment-queue  (Registrar, Admin)
// Complaints waiting for a bench + live bench workload for the dashboard.
// --------------------------------------------------------------------------
async function getAllotmentQueue(req, res) {
  const [items, benches] = await Promise.all([
    prisma.complaint.findMany({
      where: { status: { in: ['PENDING_ALLOTMENT', 'NEEDS_MANUAL_ASSIGNMENT'] } },
      include: COMPLAINT_INCLUDE,
      orderBy: [{ priority: 'asc' }, { acceptedAt: 'asc' }],
    }),
    getBenchWorkload(),
  ]);
  return new ApiResponse(200, { items, benches }).send(res);
}

// --------------------------------------------------------------------------
// PATCH /complaints/:id/allot  (Registrar, Admin)
// Body: { judgeId? | benchId?, reason? } — neither = least-loaded bench.
// Works for first allotment AND for re-allotment between benches.
// --------------------------------------------------------------------------
async function allotComplaint(req, res) {
  const { id } = req.params;
  const { judgeId, benchId, reason } = req.body;

  // The Registrar acted, so this is always recorded as a manual allotment — even when
  // they let the system pick the least-loaded bench (no judgeId / benchId given).
  const { complaint: updated, cancelledHearings } = await allotment.allotComplaint(id, req.user, {
    judgeId, benchId, reason, method: 'MANUAL',
  });
  const full = await prisma.complaint.findUnique({ where: { id: updated.id }, include: COMPLAINT_INCLUDE });

  return new ApiResponse(200, { complaint: full, cancelledHearings }, `Complaint allotted to ${full.bench?.name || 'bench'}`).send(res);
}

// --------------------------------------------------------------------------
// POST /complaints/:id/recuse  (Judge) — conflict of interest; Registrar re-allots
// --------------------------------------------------------------------------
async function recuseComplaint(req, res) {
  await allotment.recuseJudge(req.params.id, req.user, req.body.reason);
  return new ApiResponse(200, null, 'Recusal recorded — the case has been returned to the Registrar').send(res);
}

// --------------------------------------------------------------------------
// PATCH /complaints/:id/withdraw  (Consumer — owner only)
// --------------------------------------------------------------------------
const NON_WITHDRAWABLE_STATUSES = ['HEARING_SCHEDULED', 'HEARING_COMPLETED', 'JUDGMENT_UPLOADED', 'DISPOSED', 'CLOSED', 'REJECTED', 'WITHDRAWN', 'SETTLED'];

async function withdrawComplaint(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.consumerId !== req.user.id) throw ApiError.forbidden('You can only withdraw your own complaint');

  if (NON_WITHDRAWABLE_STATUSES.includes(complaint.status)) {
    throw ApiError.badRequest(`A complaint cannot be withdrawn once it reaches "${complaint.status}" status. Once a hearing is scheduled, please contact the forum clerk directly.`);
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: { status: 'WITHDRAWN', disposedAt: new Date() },
    include: COMPLAINT_INCLUDE,
  });

  await addTimelineEntry(id, 'WITHDRAWN', reason || 'Withdrawn by consumer.', req.user.id);
  await recordAudit({ userId: req.user.id, action: 'COMPLAINT_WITHDRAWN', entityType: 'Complaint', entityId: id, ipAddress: req.ip });

  return new ApiResponse(200, { complaint: updated }, 'Complaint withdrawn successfully').send(res);
}

// --------------------------------------------------------------------------
// GET /complaints/:id/receipt  — downloadable PDF acknowledgment
// --------------------------------------------------------------------------
async function downloadReceipt(req, res) {
  const { id } = req.params;
  const complaint = await prisma.complaint.findUnique({ where: { id }, include: COMPLAINT_INCLUDE });
  if (!complaint) throw ApiError.notFound('Complaint not found');

  assertComplaintAccess(complaint, req.user);

  const pdfBytes = await generateComplaintReceipt(complaint);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${complaint.complaintNumber}-receipt.pdf"`);
  res.send(Buffer.from(pdfBytes));
}

// --------------------------------------------------------------------------
// POST /complaints/:id/feedback  (Consumer — owner only, post-judgment)
// --------------------------------------------------------------------------
const FEEDBACK_ELIGIBLE_STATUSES = ['DISPOSED', 'CLOSED'];

async function submitFeedback(req, res) {
  const { id } = req.params;
  const { rating, comments } = req.body;

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw ApiError.badRequest('Rating must be a whole number between 1 and 5');
  }

  const complaint = await prisma.complaint.findUnique({ where: { id }, include: { feedback: true, judgment: true } });
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (complaint.consumerId !== req.user.id) throw ApiError.forbidden('You can only leave feedback on your own complaint');

  if (!FEEDBACK_ELIGIBLE_STATUSES.includes(complaint.status) || !complaint.judgment?.filePath) {
    throw ApiError.badRequest('Feedback can only be submitted after the final judgment document has been published');
  }
  if (complaint.feedback) throw ApiError.conflict('Feedback has already been submitted for this complaint');

  const feedback = await prisma.feedback.create({
    data: { complaintId: id, consumerId: req.user.id, rating: ratingNum, comments: comments?.trim() || null },
  });

  await recordAudit({ userId: req.user.id, action: 'FEEDBACK_SUBMITTED', entityType: 'Complaint', entityId: id, details: { rating: ratingNum }, ipAddress: req.ip });

  return new ApiResponse(201, { feedback }, 'Thank you for your feedback').send(res);
}

module.exports = {
  createComplaint,
  uploadEvidence,
  getMyComplaints,
  listComplaints,
  getComplaintById,
  claimComplaint,
  releaseComplaint,
  verifyAndAccept,
  rejectComplaint,
  markDefective,
  resubmitComplaint,
  reappealComplaint,
  getJudgeRecommendations,
  getAllotmentQueue,
  allotComplaint,
  recuseComplaint,
  withdrawComplaint,
  downloadReceipt,
  submitFeedback,
  generateSynopsisDraft,
  regenerateSynopsis,
  downloadSynopsisPdf,
  getCompleteness,
};
