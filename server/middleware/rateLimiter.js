const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60 * 1000,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests. Please try again later.',
  },
});

// Tighter limit on sensitive auth endpoints (login, register, forgot-password)
// to slow down brute-force / credential-stuffing attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many attempts. Please try again in a few minutes.',
  },
});

module.exports = { apiLimiter, authLimiter };
