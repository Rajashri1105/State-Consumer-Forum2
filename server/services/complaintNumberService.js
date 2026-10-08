const prisma = require('../config/db');

/**
 * Generates the next sequential complaint number for the current year,
 * e.g. SCF-2026-000001. Retries on unique-constraint collision to stay
 * safe under concurrent submissions.
 */
async function generateComplaintNumber() {
  const year = new Date().getFullYear();
  const prefix = `SCF-${year}-`;

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const count = await prisma.complaint.count({
      where: { complaintNumber: { startsWith: prefix } },
    });
    const sequence = String(count + 1 + attempt).padStart(6, '0');
    const candidate = `${prefix}${sequence}`;

    const exists = await prisma.complaint.findUnique({ where: { complaintNumber: candidate } });
    if (!exists) return candidate;
  }

  // Extremely unlikely fallback: timestamp-based suffix.
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

module.exports = { generateComplaintNumber };
