// --------------------------------------------------------------------------
// Access scoping — one place that answers "which complaints may this user see?"
//
//   Consumer          own complaints only
//   Judge             complaints assigned to them
//   Scrutiny clerk    the shared intake queue (SUBMITTED) + complaints they claimed
//   Court clerk       complaints allotted to their bench
//   Registrar / Admin everything
//
// `complaintScope(user)` returns a Prisma `where` fragment for list queries.
// `assertComplaintAccess(complaint, user)` is the same rule for a single record.
// --------------------------------------------------------------------------
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');

const NOTHING = { id: '__no_access__' };

function isScrutiny(user) {
  return user.role === 'CLERK' && user.clerkType !== 'COURT';
}
function isCourtClerk(user) {
  return user.role === 'CLERK' && user.clerkType === 'COURT';
}

async function getJudgeProfileId(userId) {
  const jp = await prisma.judgeProfile.findUnique({ where: { userId }, select: { id: true } });
  return jp?.id || null;
}

/** Prisma `where` fragment limiting complaints to what `user` may see. */
async function complaintScope(user) {
  switch (user.role) {
    case 'CONSUMER':
      return { consumerId: user.id };
    case 'JUDGE': {
      const judgeId = await getJudgeProfileId(user.id);
      return judgeId ? { assignedJudgeId: judgeId } : NOTHING;
    }
    case 'CLERK':
      if (isCourtClerk(user)) return user.benchId ? { benchId: user.benchId } : NOTHING;
      return { OR: [{ status: 'SUBMITTED', assignedClerkId: null }, { assignedClerkId: user.id }] };
    case 'OPPOSITE_PARTY':
      // Only cases where a notice has actually been served on them.
      return { oppositePartyUserId: user.id, noticeIssuedAt: { not: null } };
    case 'REGISTRAR':
    case 'ADMIN':
      return {};
    default:
      return NOTHING;
  }
}

/** Single-record version of the same rule. Throws 403 if not allowed. */
function assertComplaintAccess(complaint, user) {
  if (user.role === 'ADMIN' || user.role === 'REGISTRAR') return;
  if (user.role === 'CONSUMER' && complaint.consumerId === user.id) return;
  if (user.role === 'OPPOSITE_PARTY' && complaint.oppositePartyUserId === user.id && complaint.noticeIssuedAt) return;
  if (user.role === 'JUDGE' && complaint.assignedJudge?.user?.id === user.id) return;
  if (isCourtClerk(user) && user.benchId && complaint.benchId === user.benchId) return;
  if (isScrutiny(user) && (complaint.assignedClerkId === user.id || (complaint.status === 'SUBMITTED' && !complaint.assignedClerkId))) return;
  throw ApiError.forbidden('You do not have access to this complaint');
}

/** For hearing actions: only the court clerk of the complaint's bench (or Registrar/Admin). */
function assertBenchClerkOrOversight(complaint, user) {
  if (user.role === 'ADMIN' || user.role === 'REGISTRAR') return;
  if (isCourtClerk(user) && user.benchId && complaint.benchId === user.benchId) return;
  throw ApiError.forbidden('Only the court clerk of the bench handling this case can do this');
}

module.exports = { complaintScope, assertComplaintAccess, assertBenchClerkOrOversight, isScrutiny, isCourtClerk, getJudgeProfileId };
