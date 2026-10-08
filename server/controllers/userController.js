const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { recordAudit } = require('../services/auditService');

const SALT_ROUNDS = 12;

const USER_SELECT = {
  id: true, name: true, email: true, phone: true, address: true, role: true,
  isActive: true, isEmailVerified: true, createdAt: true,
  clerkType: true, benchId: true,
  bench: { select: { id: true, name: true } },
  judgeProfile: { select: { id: true, designation: true, courtRoom: true, specialization: true, maxHearingsPerDay: true, benchId: true, bench: { select: { id: true, name: true } } } },
};

function paginationParams(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 15, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

// --------------------------------------------------------------------------
// GET /users
// --------------------------------------------------------------------------
async function listUsers(req, res) {
  const { role, isActive, search } = req.query;
  const { page, limit, skip } = paginationParams(req.query);

  const where = {
    ...(role ? { role } : {}),
    ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.user.count({ where }),
  ]);

  return new ApiResponse(200, { items, total, page, limit, totalPages: Math.ceil(total / limit) }).send(res);
}

// --------------------------------------------------------------------------
// GET /users/:id
// --------------------------------------------------------------------------
async function getUserById(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: USER_SELECT });
  if (!user) throw ApiError.notFound('User not found');
  return new ApiResponse(200, { user }).send(res);
}

// --------------------------------------------------------------------------
// POST /users  — Admin creates Clerk / Judge / Admin accounts
// --------------------------------------------------------------------------
async function createUser(req, res) {
  const {
    name, email, password, role, phone, address,
    designation, courtRoom, specialization, maxHearingsPerDay,
    clerkType, benchId,
  } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  // Clerks are either SCRUTINY (shared intake pool) or COURT (attached to one bench).
  let finalClerkType = null;
  let finalBenchId = null;
  if (role === 'CLERK') {
    finalClerkType = clerkType === 'COURT' ? 'COURT' : 'SCRUTINY';
    if (finalClerkType === 'COURT') {
      if (!benchId) throw ApiError.badRequest('A court clerk must be attached to a bench');
      finalBenchId = benchId;
    }
  }
  if ((finalBenchId || (role === 'JUDGE' && benchId)) && !(await prisma.bench.findUnique({ where: { id: finalBenchId || benchId } }))) {
    throw ApiError.badRequest('Selected bench does not exist');
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name, email, phone, address, role,
      clerkType: finalClerkType,
      benchId: finalBenchId,
      password: hashedPassword,
      isEmailVerified: true, // Admin-created staff accounts don't need email verification
    },
  });

  if (role === 'JUDGE') {
    const judgeProfile = await prisma.judgeProfile.create({
      data: {
        userId: user.id,
        designation: designation || 'Member',
        courtRoom: courtRoom || null,
        specialization: specialization || null,
        maxHearingsPerDay: maxHearingsPerDay || 8,
        benchId: benchId || null,
      },
    });
    // Default Mon-Fri availability, matching the forum's standard working days.
    await prisma.judgeAvailability.createMany({
      data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        judgeId: judgeProfile.id, dayOfWeek, isAvailable: true, maxHearingsPerDay: maxHearingsPerDay || 8,
      })),
    });
  }

  const created = await prisma.user.findUnique({ where: { id: user.id }, select: USER_SELECT });
  await recordAudit({ userId: req.user.id, action: 'USER_CREATED', entityType: 'User', entityId: user.id, details: { role }, ipAddress: req.ip });

  return new ApiResponse(201, { user: created }, `${role} account created successfully`).send(res);
}

// --------------------------------------------------------------------------
// PATCH /users/:id  — update profile / judge-specific fields
// --------------------------------------------------------------------------
async function updateUser(req, res) {
  const { id } = req.params;
  const { name, phone, address, designation, courtRoom, specialization, maxHearingsPerDay } = req.body;

  const existing = await prisma.user.findUnique({ where: { id }, include: { judgeProfile: true } });
  if (!existing) throw ApiError.notFound('User not found');

  await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(address !== undefined ? { address } : {}),
    },
  });

  if (existing.role === 'JUDGE' && existing.judgeProfile) {
    await prisma.judgeProfile.update({
      where: { id: existing.judgeProfile.id },
      data: {
        ...(designation !== undefined ? { designation } : {}),
        ...(courtRoom !== undefined ? { courtRoom } : {}),
        ...(specialization !== undefined ? { specialization } : {}),
        ...(maxHearingsPerDay !== undefined ? { maxHearingsPerDay } : {}),
      },
    });
  }

  const updated = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  await recordAudit({ userId: req.user.id, action: 'USER_UPDATED', entityType: 'User', entityId: id, ipAddress: req.ip });

  return new ApiResponse(200, { user: updated }, 'User updated successfully').send(res);
}

// --------------------------------------------------------------------------
// PATCH /users/:id/status  — activate / deactivate
// --------------------------------------------------------------------------
async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (id === req.user.id && isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('User not found');

  const updated = await prisma.user.update({ where: { id }, data: { isActive }, select: USER_SELECT });
  await recordAudit({ userId: req.user.id, action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', entityType: 'User', entityId: id, ipAddress: req.ip });

  return new ApiResponse(200, { user: updated }, `User ${isActive ? 'activated' : 'deactivated'} successfully`).send(res);
}

// --------------------------------------------------------------------------
// DELETE /users/:id  — permanent deletion (blocked if the account has any
// activity on record; deactivation is the safe path for accounts with history)
// --------------------------------------------------------------------------
async function deleteUser(req, res) {
  const { id } = req.params;

  if (id === req.user.id) throw ApiError.badRequest('You cannot delete your own account');

  const existing = await prisma.user.findUnique({ where: { id }, include: { judgeProfile: true } });
  if (!existing) throw ApiError.notFound('User not found');

  // Guard against orphaning historical records: a user with any complaints,
  // evidence uploads, or (for judges) any case activity cannot be hard
  // deleted — deactivate instead so the audit trail stays intact.
  const [complaintCount, evidenceCount, hearingsCreatedCount] = await Promise.all([
    prisma.complaint.count({ where: { consumerId: id } }),
    prisma.evidence.count({ where: { uploadedById: id } }),
    prisma.hearing.count({ where: { createdById: id } }),
  ]);

  let judgeActivityCount = 0;
  if (existing.judgeProfile) {
    const [assignedCases, hearingsHeard, judgmentsIssued] = await Promise.all([
      prisma.complaint.count({ where: { assignedJudgeId: existing.judgeProfile.id } }),
      prisma.hearing.count({ where: { judgeId: existing.judgeProfile.id } }),
      prisma.judgment.count({ where: { judgeId: existing.judgeProfile.id } }),
    ]);
    judgeActivityCount = assignedCases + hearingsHeard + judgmentsIssued;
  }

  const totalActivity = complaintCount + evidenceCount + hearingsCreatedCount + judgeActivityCount;
  if (totalActivity > 0) {
    throw ApiError.badRequest(
      'This account has existing activity on record (complaints, evidence, hearings, or judgments) and cannot be permanently deleted. Deactivate it instead to preserve the historical record.'
    );
  }

  await prisma.user.delete({ where: { id } });
  await recordAudit({ userId: req.user.id, action: 'USER_DELETED', entityType: 'User', entityId: id, details: { deletedEmail: existing.email, role: existing.role }, ipAddress: req.ip });

  return new ApiResponse(200, null, 'User deleted permanently').send(res);
}

module.exports = { listUsers, getUserById, createUser, updateUser, updateUserStatus, deleteUser };
