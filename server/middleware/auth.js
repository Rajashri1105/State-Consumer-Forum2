const { verifyAccessToken } = require('../utils/tokenUtils');
const ApiError = require('../utils/ApiError');
const prisma = require('../config/db');

/**
 * Verifies the Bearer access token, loads the user, and attaches it to
 * req.user. Rejects if the token is missing, invalid, expired, or the
 * user account has been deactivated.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication token missing');
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    clerkType: user.clerkType || null,
    benchId: user.benchId || null,
    isEmailVerified: user.isEmailVerified,
  };
  next();
}

/**
 * Restricts a route to one or more roles. Must run after `authenticate`.
 * Usage: authorize('ADMIN', 'CLERK')
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }
    next();
  };
}

module.exports = { authenticate, authorize };
