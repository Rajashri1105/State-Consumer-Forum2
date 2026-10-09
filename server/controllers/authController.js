const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/db');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/tokenUtils');
const { generateSecureToken, hashToken } = require('../utils/cryptoUtils');
const { sendEmail, emailVerificationTemplate, passwordResetTemplate } = require('../utils/email');
const { recordAudit } = require('../services/auditService');
const logger = require('../config/logger');

const SALT_ROUNDS = 12;
const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';
const ACCOUNT_DELETION_ROLES = ['CONSUMER', 'OPPOSITE_PARTY'];
const COMPLETED_CASE_STATUSES = ['REJECTED', 'DISPOSED', 'CLOSED', 'WITHDRAWN', 'SETTLED'];

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: config.jwt.refreshExpiryMs,
    path: REFRESH_COOKIE_PATH,
  };
}

function sanitizeUser(user) {
  const { password, emailVerificationToken, passwordResetToken, ...safe } = user;
  return safe;
}

async function issueTokenPair(user, res) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + config.jwt.refreshExpiryMs),
    },
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  return accessToken;
}

// --------------------------------------------------------------------------
// POST /auth/register
// --------------------------------------------------------------------------
async function register(req, res) {
  const { name, email, password, phone, address } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const { rawToken, hashedToken } = generateSecureToken();

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      role: 'CONSUMER', // public registration is always as a Consumer
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const verifyUrl = `${config.clientUrl}/verify-email?token=${rawToken}`;
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify your email — State Consumer Forum Portal',
      html: emailVerificationTemplate(user.name, verifyUrl),
    });
  } catch (err) {
    // The account already exists at this point — a broken/misconfigured SMTP
    // server must not turn a successful registration into a failed request.
    logger.error('Failed to send verification email during registration:', err.message);
  }

  await recordAudit({ userId: user.id, action: 'REGISTER', entityType: 'User', entityId: user.id, ipAddress: req.ip });

  return new ApiResponse(201, { user: sanitizeUser(user) }, 'Registration successful. Please check your email to verify your account.').send(res);
}

// --------------------------------------------------------------------------
// POST /auth/verify-email
// --------------------------------------------------------------------------
async function verifyEmail(req, res) {
  const { token } = req.body;
  const hashedToken = hashToken(token);

  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: hashedToken, emailVerificationExpiry: { gt: new Date() } },
  });
  if (!user) throw ApiError.badRequest('Verification link is invalid or has expired');

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerificationToken: null, emailVerificationExpiry: null },
  });

  await recordAudit({ userId: user.id, action: 'EMAIL_VERIFIED', entityType: 'User', entityId: user.id, ipAddress: req.ip });

  return new ApiResponse(200, null, 'Email verified successfully. You can now log in.').send(res);
}

// --------------------------------------------------------------------------
// POST /auth/resend-verification
// --------------------------------------------------------------------------
async function resendVerification(req, res) {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond the same way to avoid leaking which emails are registered.
  const genericResponse = new ApiResponse(200, null, 'If an account exists and is unverified, a new verification email has been sent.');

  if (!user || !user.isActive || user.isEmailVerified) return genericResponse.send(res);

  const { rawToken, hashedToken } = generateSecureToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: hashedToken, emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const verifyUrl = `${config.clientUrl}/verify-email?token=${rawToken}`;
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify your email — State Consumer Forum Portal',
      html: emailVerificationTemplate(user.name, verifyUrl),
    });
  } catch (err) {
    logger.error('Failed to resend verification email:', err.message);
  }

  return genericResponse.send(res);
}

// --------------------------------------------------------------------------
// POST /auth/login
// --------------------------------------------------------------------------
async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact the administrator.');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw ApiError.unauthorized('Invalid email or password');
  if (ACCOUNT_DELETION_ROLES.includes(user.role) && !user.isEmailVerified) {
    throw ApiError.forbidden('Please verify your email before logging in. Check your inbox for the verification link.');
  }

  const accessToken = await issueTokenPair(user, res);

  await recordAudit({ userId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, ipAddress: req.ip });

  return new ApiResponse(200, { user: sanitizeUser(user), accessToken }, 'Login successful').send(res);
}

// --------------------------------------------------------------------------
// POST /auth/refresh
// --------------------------------------------------------------------------
async function refresh(req, res) {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!incomingToken) throw ApiError.unauthorized('Refresh token missing');

  let payload;
  try {
    payload = verifyRefreshToken(incomingToken);
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    throw ApiError.unauthorized('Refresh token invalid or expired. Please log in again.');
  }

  const storedToken = await prisma.refreshToken.findUnique({ where: { token: incomingToken } });
  if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    throw ApiError.unauthorized('Refresh token invalid or expired. Please log in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account no longer available');
  }

  // Rotate: revoke the used refresh token and issue a brand new pair.
  await prisma.refreshToken.update({ where: { id: storedToken.id }, data: { revoked: true } });
  const accessToken = await issueTokenPair(user, res);

  return new ApiResponse(200, { user: sanitizeUser(user), accessToken }, 'Token refreshed').send(res);
}

// --------------------------------------------------------------------------
// POST /auth/logout
// --------------------------------------------------------------------------
async function logout(req, res) {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (incomingToken) {
    await prisma.refreshToken.updateMany({ where: { token: incomingToken }, data: { revoked: true } });
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  return new ApiResponse(200, null, 'Logged out successfully').send(res);
}

// --------------------------------------------------------------------------
// POST /auth/forgot-password
// --------------------------------------------------------------------------
async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  const genericResponse = new ApiResponse(200, null, 'If an account with that email exists, a password reset link has been sent.');
  if (!user || !user.isActive) return genericResponse.send(res);

  const { rawToken, hashedToken } = generateSecureToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: hashedToken, passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const resetUrl = `${config.clientUrl}/reset-password?token=${rawToken}`;
  try {
    await sendEmail({
      to: user.email,
      subject: 'Reset your password — State Consumer Forum Portal',
      html: passwordResetTemplate(user.name, resetUrl),
    });
  } catch (err) {
    logger.error('Failed to send password reset email:', err.message);
  }

  await recordAudit({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', entityType: 'User', entityId: user.id, ipAddress: req.ip });

  return genericResponse.send(res);
}

// --------------------------------------------------------------------------
// POST /auth/reset-password
// --------------------------------------------------------------------------
async function resetPassword(req, res) {
  const { token, password } = req.body;
  const hashedToken = hashToken(token);

  const user = await prisma.user.findFirst({
    where: { passwordResetToken: hashedToken, passwordResetExpiry: { gt: new Date() } },
  });
  if (!user) throw ApiError.badRequest('Password reset link is invalid or has expired');

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  });

  // Revoke all existing sessions for this user as a security precaution.
  await prisma.refreshToken.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } });

  await recordAudit({ userId: user.id, action: 'PASSWORD_RESET_COMPLETED', entityType: 'User', entityId: user.id, ipAddress: req.ip });

  return new ApiResponse(200, null, 'Password reset successfully. Please log in with your new password.').send(res);
}

// --------------------------------------------------------------------------
// POST /auth/change-password  (authenticated)
// --------------------------------------------------------------------------
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw ApiError.badRequest('Current password is incorrect');

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });

  // Revoke all other sessions; keep the user logged in on this device only
  // by issuing a fresh pair below.
  await prisma.refreshToken.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } });
  const accessToken = await issueTokenPair(user, res);

  await recordAudit({ userId: user.id, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user.id, ipAddress: req.ip });

  return new ApiResponse(200, { accessToken }, 'Password changed successfully').send(res);
}

// --------------------------------------------------------------------------
// GET /auth/me  (authenticated)
// --------------------------------------------------------------------------
async function getMe(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw ApiError.notFound('User not found');

  let judgeProfile = null;
  if (user.role === 'JUDGE') {
    judgeProfile = await prisma.judgeProfile.findUnique({ where: { userId: user.id } });
  }

  return new ApiResponse(200, { user: sanitizeUser(user), judgeProfile }, 'Current user fetched').send(res);
}

// --------------------------------------------------------------------------
// PATCH /auth/profile  (authenticated) — self-service profile edit
// --------------------------------------------------------------------------
async function updateProfile(req, res) {
  const { name, phone, address } = req.body;

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(address !== undefined ? { address } : {}),
    },
  });

  await recordAudit({ userId: req.user.id, action: 'PROFILE_UPDATED', entityType: 'User', entityId: req.user.id, ipAddress: req.ip });

  return new ApiResponse(200, { user: sanitizeUser(updated) }, 'Profile updated successfully').send(res);
}

function assertAccountDeletionRole(role) {
  if (!ACCOUNT_DELETION_ROLES.includes(role)) {
    throw ApiError.forbidden('Only consumer and opposite-party accounts can be deleted here');
  }
}

function getAccountCasesWhere(user) {
  return user.role === 'CONSUMER'
    ? { consumerId: user.id }
    : { oppositePartyUserId: user.id };
}

async function buildAccountDeletionStatus(db, user) {
  const cases = await db.complaint.findMany({
    where: getAccountCasesWhere(user),
    select: { complaintNumber: true, status: true },
  });
  const incompleteCases = cases
    .filter((complaint) => !COMPLETED_CASE_STATUSES.includes(complaint.status))
    .map(({ complaintNumber, status }) => ({ complaintNumber, status }));

  return {
    eligible: incompleteCases.length === 0,
    totalCases: cases.length,
    incompleteCases,
  };
}

// --------------------------------------------------------------------------
// GET /auth/account-deletion-status  (authenticated consumer / opposite party)
// --------------------------------------------------------------------------
async function getAccountDeletionStatus(req, res) {
  assertAccountDeletionRole(req.user.role);
  const status = await buildAccountDeletionStatus(prisma, req.user);
  return new ApiResponse(200, status, 'Account deletion eligibility fetched').send(res);
}

// --------------------------------------------------------------------------
// DELETE /auth/account  (authenticated consumer / opposite party)
// --------------------------------------------------------------------------
async function deleteAccount(req, res) {
  assertAccountDeletionRole(req.user.role);
  const { currentPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw ApiError.notFound('Account not found');

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw ApiError.badRequest('Current password is incorrect');

  const anonymizedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
  const result = await prisma.$transaction(async (tx) => {
    const status = await buildAccountDeletionStatus(tx, user);
    if (!status.eligible) {
      throw ApiError.badRequest('Your account cannot be deleted until every complaint case is completed.');
    }

    const linkedCases = await tx.complaint.findMany({
      where: getAccountCasesWhere(user),
      select: { id: true },
    });
    const complaintIds = linkedCases.map(({ id }) => id);

    if (complaintIds.length > 0) {
      await tx.emailLog.updateMany({
        where: {
          complaintId: { in: complaintIds },
          toEmail: { equals: user.email, mode: 'insensitive' },
        },
        data: { toEmail: 'deleted@deleted.invalid' },
      });
    }

    if (user.role === 'OPPOSITE_PARTY' && complaintIds.length > 0) {
      await tx.complaint.updateMany({
        where: { id: { in: complaintIds } },
        data: {
          oppositePartyName: 'Deleted account',
          oppositePartyAddress: null,
          oppositePartyEmail: null,
          oppositePartyPhone: null,
        },
      });
      await tx.oppositeParty.updateMany({
        where: {
          complaintId: { in: complaintIds },
          email: { equals: user.email, mode: 'insensitive' },
        },
        data: { name: 'Deleted account', address: null, email: null },
      });
    }

    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    });
    await tx.user.update({
      where: { id: user.id },
      data: {
        name: user.role === 'CONSUMER' ? 'Deleted consumer' : 'Deleted opposite party',
        email: `deleted-${user.id}@deleted.invalid`,
        password: anonymizedPassword,
        phone: null,
        address: null,
        profileImage: null,
        isActive: false,
        isEmailVerified: false,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    return { totalCases: status.totalCases };
  });

  await recordAudit({
    userId: user.id,
    action: 'ACCOUNT_DELETED',
    entityType: 'User',
    entityId: user.id,
    details: { role: user.role, retainedCaseCount: result.totalCases },
    ipAddress: req.ip,
  });

  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  return new ApiResponse(200, null, 'Your account has been deleted. Completed case records have been retained in anonymized form.').send(res);
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateProfile,
  getAccountDeletionStatus,
  deleteAccount,
};
