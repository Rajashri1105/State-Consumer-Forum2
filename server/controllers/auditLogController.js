const prisma = require('../config/db');
const ApiResponse = require('../utils/ApiResponse');

function paginationParams(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 25, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

// --------------------------------------------------------------------------
// GET /audit-logs  (Admin)
// --------------------------------------------------------------------------
async function listAuditLogs(req, res) {
  const { action, entityType } = req.query;
  const { page, limit, skip } = paginationParams(req.query);

  const where = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return new ApiResponse(200, { items, total, page, limit, totalPages: Math.ceil(total / limit) }).send(res);
}

module.exports = { listAuditLogs };
