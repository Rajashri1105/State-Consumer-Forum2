const crypto = require('crypto');

/**
 * Generates a random token plus its SHA-256 hash.
 * The raw token is sent to the user (e.g. via email link);
 * only the hash is stored in the database. This means a leaked
 * database dump alone cannot be used to reset a user's password.
 */
function generateSecureToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, hashedToken };
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = { generateSecureToken, hashToken };
