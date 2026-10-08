const jwt = require('jsonwebtoken');
const config = require('../config/env');

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.name },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiry }
  );
}

function generateRefreshToken(user) {
  return jwt.sign({ sub: user.id, tokenType: 'refresh' }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
