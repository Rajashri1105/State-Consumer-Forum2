const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const judgeLeaveService = require('../services/judgeLeaveService');
const { recordAudit } = require('../services/auditService');

async function getOwnJudgeProfile(userId) {
  const profile = await prisma.judgeProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.forbidden('Judge profile not found');
  return profile;
}

function validateLeaveDates(startDate, endDate) {
  if (!startDate || !endDate) throw ApiError.badRequest('Start date and end date are required');

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest('Start date and end date must be valid dates');
  }
  if (end < start) throw ApiError.badRequest('End date cannot be before start date');
  if (start.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) {
    throw ApiError.badRequest('Start date cannot be in the past');
  }
}

// --------------------------------------------------------------------------
// GET /judge-leaves/mine  (Judge)
// --------------------------------------------------------------------------
async function listMyLeaves(req, res) {
  const profile = await getOwnJudgeProfile(req.user.id);
  const leaves = await judgeLeaveService.listLeavesForJudge(profile.id);
  return new ApiResponse(200, { leaves }).send(res);
}

// --------------------------------------------------------------------------
// POST /judge-leaves/mine  (Judge) — mark own leave
// --------------------------------------------------------------------------
async function createMyLeave(req, res) {
  const { startDate, endDate, reason } = req.body;
  if (!reason) throw ApiError.badRequest('Reason is required');
  validateLeaveDates(startDate, endDate);

  const profile = await getOwnJudgeProfile(req.user.id);
  const { leave, conflictingHearings } = await judgeLeaveService.createLeave({
    judgeId: profile.id, startDate, endDate, reason, createdById: req.user.id,
  });

  await recordAudit({ userId: req.user.id, action: 'JUDGE_LEAVE_CREATED', entityType: 'JudgeLeave', entityId: leave.id, ipAddress: req.ip });

  const message = conflictingHearings.length > 0
    ? `Leave recorded. ${conflictingHearings.length} scheduled hearing(s) fall within this period and need rescheduling.`
    : 'Leave recorded successfully.';

  return new ApiResponse(201, { leave, conflictingHearings }, message).send(res);
}

// --------------------------------------------------------------------------
// GET /judge-leaves  (Admin) — full list across all judges
// --------------------------------------------------------------------------
async function listAllLeaves(req, res) {
  const leaves = await judgeLeaveService.listAllLeaves();
  return new ApiResponse(200, { leaves }).send(res);
}

// --------------------------------------------------------------------------
// POST /judge-leaves  (Admin) — mark leave for any judge
// --------------------------------------------------------------------------
async function createLeaveForJudge(req, res) {
  const { judgeId, startDate, endDate, reason } = req.body;
  if (!judgeId || !reason) throw ApiError.badRequest('Judge and reason are required');
  validateLeaveDates(startDate, endDate);

  const judge = await prisma.judgeProfile.findUnique({ where: { id: judgeId } });
  if (!judge) throw ApiError.badRequest('Judge not found');

  const { leave, conflictingHearings } = await judgeLeaveService.createLeave({
    judgeId, startDate, endDate, reason, createdById: req.user.id,
  });

  await recordAudit({ userId: req.user.id, action: 'JUDGE_LEAVE_CREATED', entityType: 'JudgeLeave', entityId: leave.id, details: { judgeId }, ipAddress: req.ip });

  const message = conflictingHearings.length > 0
    ? `Leave recorded. ${conflictingHearings.length} scheduled hearing(s) fall within this period and need rescheduling.`
    : 'Leave recorded successfully.';

  return new ApiResponse(201, { leave, conflictingHearings }, message).send(res);
}

// --------------------------------------------------------------------------
// GET /judge-leaves/today  (Clerk, Admin, Judge) — availability panel data
// --------------------------------------------------------------------------
async function getTodaysAbsences(req, res) {
  const onLeave = await judgeLeaveService.getJudgesOnLeave(new Date());
  return new ApiResponse(200, { onLeave }).send(res);
}

// --------------------------------------------------------------------------
// DELETE /judge-leaves/:id  (Judge — own only; Admin — any)
// --------------------------------------------------------------------------
async function deleteLeave(req, res) {
  const { id } = req.params;
  const leave = await prisma.judgeLeave.findUnique({ where: { id }, include: { judge: true } });
  if (!leave) throw ApiError.notFound('Leave record not found');

  if (req.user.role === 'JUDGE') {
    const profile = await getOwnJudgeProfile(req.user.id);
    if (leave.judgeId !== profile.id) throw ApiError.forbidden('You can only remove your own leave records');
  }

  await judgeLeaveService.deleteLeave(id);
  await recordAudit({ userId: req.user.id, action: 'JUDGE_LEAVE_DELETED', entityType: 'JudgeLeave', entityId: id, ipAddress: req.ip });

  return new ApiResponse(200, null, 'Leave record removed').send(res);
}

module.exports = { listMyLeaves, createMyLeave, listAllLeaves, createLeaveForJudge, getTodaysAbsences, deleteLeave };
