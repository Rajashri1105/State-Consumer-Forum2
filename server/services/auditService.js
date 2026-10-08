const prisma = require('../config/db');
const logger = require('../config/logger');

/**
 * Writes an audit trail entry. Never throws — audit logging must not
 * break the primary request flow, so failures are only logged locally.
 */
async function recordAudit({ userId = null, action, entityType, entityId = null, details = null, ipAddress = null }) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entityType, entityId, details, ipAddress },
    });
  } catch (err) {
    logger.error('Failed to write audit log:', err.message);
  }
}

module.exports = { recordAudit };
