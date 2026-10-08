const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { recordAudit } = require('../services/auditService');
const { getBenchWorkload } = require('../services/workloadBalancerService');

const ACTIVE_CASE_STATUSES = ['JUDGE_ASSIGNED', 'HEARING_SCHEDULED', 'HEARING_COMPLETED'];

const BENCH_INCLUDE = {
  judges: { include: { user: { select: { id: true, name: true, email: true, isActive: true } } } },
  clerks: { select: { id: true, name: true, email: true, isActive: true } },
  _count: { select: { complaints: true } },
};

// GET /benches  (Admin, Registrar) — benches with members + whoever is not seated yet
async function listBenches(req, res) {
  const [benches, unseatedJudges, scrutinyClerks] = await Promise.all([
    prisma.bench.findMany({ include: BENCH_INCLUDE, orderBy: { name: 'asc' } }),
    prisma.judgeProfile.findMany({
      where: { benchId: null, user: { isActive: true } },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { role: 'CLERK', isActive: true, OR: [{ clerkType: 'SCRUTINY' }, { clerkType: null }] },
      select: { id: true, name: true, email: true },
    }),
  ]);
  return new ApiResponse(200, { benches, unseatedJudges, scrutinyClerks }).send(res);
}

// GET /benches/workload  (Admin, Registrar)
async function getWorkload(req, res) {
  return new ApiResponse(200, { benches: await getBenchWorkload() }).send(res);
}

// POST /benches  (Admin)
async function createBench(req, res) {
  const { name, courtRoom } = req.body;
  if (!name || !name.trim()) throw ApiError.badRequest('Bench name is required');
  const dup = await prisma.bench.findUnique({ where: { name: name.trim() } });
  if (dup) throw ApiError.conflict('A bench with this name already exists');

  const bench = await prisma.bench.create({ data: { name: name.trim(), courtRoom: courtRoom?.trim() || null }, include: BENCH_INCLUDE });
  await recordAudit({ userId: req.user.id, action: 'BENCH_CREATED', entityType: 'Bench', entityId: bench.id, ipAddress: req.ip });
  return new ApiResponse(201, { bench }, 'Bench created').send(res);
}

// PATCH /benches/:id  (Admin)
async function updateBench(req, res) {
  const { id } = req.params;
  const { name, courtRoom, isActive } = req.body;
  const existing = await prisma.bench.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Bench not found');

  if (name && name.trim() !== existing.name) {
    const dup = await prisma.bench.findUnique({ where: { name: name.trim() } });
    if (dup) throw ApiError.conflict('A bench with this name already exists');
  }
  const bench = await prisma.bench.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(courtRoom !== undefined ? { courtRoom: courtRoom?.trim() || null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
    include: BENCH_INCLUDE,
  });
  await recordAudit({ userId: req.user.id, action: 'BENCH_UPDATED', entityType: 'Bench', entityId: id, ipAddress: req.ip });
  return new ApiResponse(200, { bench }, 'Bench updated').send(res);
}

// DELETE /benches/:id  (Admin) — only if it never handled a case
async function deleteBench(req, res) {
  const { id } = req.params;
  const bench = await prisma.bench.findUnique({ where: { id }, include: { _count: { select: { complaints: true } } } });
  if (!bench) throw ApiError.notFound('Bench not found');
  if (bench._count.complaints > 0) {
    throw ApiError.badRequest('This bench has handled cases and cannot be deleted. Deactivate it instead.');
  }
  await prisma.$transaction([
    prisma.judgeProfile.updateMany({ where: { benchId: id }, data: { benchId: null } }),
    prisma.user.updateMany({ where: { benchId: id }, data: { benchId: null, clerkType: 'SCRUTINY' } }),
    prisma.bench.delete({ where: { id } }),
  ]);
  await recordAudit({ userId: req.user.id, action: 'BENCH_DELETED', entityType: 'Bench', entityId: id, ipAddress: req.ip });
  return new ApiResponse(200, null, 'Bench deleted').send(res);
}

// POST /benches/:id/judges  { judgeId }  (Admin) — seat a judge on this bench
async function addJudge(req, res) {
  const { id } = req.params;
  const { judgeId } = req.body;
  const [bench, judge] = await Promise.all([
    prisma.bench.findUnique({ where: { id } }),
    prisma.judgeProfile.findUnique({ where: { id: judgeId } }),
  ]);
  if (!bench) throw ApiError.notFound('Bench not found');
  if (!judge) throw ApiError.badRequest('Judge does not exist');

  // Cases the judge is already carrying move with them so scoping stays correct.
  await prisma.$transaction([
    prisma.judgeProfile.update({ where: { id: judgeId }, data: { benchId: id } }),
    prisma.complaint.updateMany({ where: { assignedJudgeId: judgeId, status: { in: ACTIVE_CASE_STATUSES } }, data: { benchId: id } }),
  ]);
  await recordAudit({ userId: req.user.id, action: 'BENCH_JUDGE_SEATED', entityType: 'Bench', entityId: id, details: { judgeId }, ipAddress: req.ip });
  return listOne(res, id, 'Judge seated on bench');
}

// DELETE /benches/:id/judges/:judgeId  (Admin)
async function removeJudge(req, res) {
  const { id, judgeId } = req.params;
  const active = await prisma.complaint.count({ where: { assignedJudgeId: judgeId, status: { in: ACTIVE_CASE_STATUSES } } });
  if (active > 0) {
    throw ApiError.badRequest(`This judge still has ${active} active case(s). Ask the Registrar to re-allot them first.`);
  }
  await prisma.judgeProfile.updateMany({ where: { id: judgeId, benchId: id }, data: { benchId: null } });
  await recordAudit({ userId: req.user.id, action: 'BENCH_JUDGE_REMOVED', entityType: 'Bench', entityId: id, details: { judgeId }, ipAddress: req.ip });
  return listOne(res, id, 'Judge removed from bench');
}

// POST /benches/:id/clerks  { clerkId }  (Admin) — make a clerk this bench's court clerk
async function addClerk(req, res) {
  const { id } = req.params;
  const { clerkId } = req.body;
  const [bench, clerk] = await Promise.all([
    prisma.bench.findUnique({ where: { id } }),
    prisma.user.findUnique({ where: { id: clerkId } }),
  ]);
  if (!bench) throw ApiError.notFound('Bench not found');
  if (!clerk || clerk.role !== 'CLERK') throw ApiError.badRequest('Clerk does not exist');

  // A clerk who currently has a claimed, unfinished intake complaint must finish or release it first.
  const open = await prisma.complaint.count({ where: { assignedClerkId: clerkId, status: 'UNDER_VERIFICATION' } });
  if (open > 0) throw ApiError.badRequest('This clerk still has claimed complaints under verification. Ask them to finish or release them first.');

  await prisma.user.update({ where: { id: clerkId }, data: { benchId: id, clerkType: 'COURT' } });
  await recordAudit({ userId: req.user.id, action: 'BENCH_CLERK_ASSIGNED', entityType: 'Bench', entityId: id, details: { clerkId }, ipAddress: req.ip });
  return listOne(res, id, 'Court clerk assigned to bench');
}

// DELETE /benches/:id/clerks/:clerkId  (Admin) — clerk goes back to the intake pool
async function removeClerk(req, res) {
  const { id, clerkId } = req.params;
  await prisma.user.updateMany({ where: { id: clerkId, benchId: id, role: 'CLERK' }, data: { benchId: null, clerkType: 'SCRUTINY' } });
  await recordAudit({ userId: req.user.id, action: 'BENCH_CLERK_REMOVED', entityType: 'Bench', entityId: id, details: { clerkId }, ipAddress: req.ip });
  return listOne(res, id, 'Clerk moved back to the intake pool');
}

async function listOne(res, id, message) {
  const bench = await prisma.bench.findUnique({ where: { id }, include: BENCH_INCLUDE });
  return new ApiResponse(200, { bench }, message).send(res);
}

module.exports = { listBenches, getWorkload, createBench, updateBench, deleteBench, addJudge, removeJudge, addClerk, removeClerk };
