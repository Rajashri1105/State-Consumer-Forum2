const logger = require('../config/logger');

const SMS_PROVIDER_URL = process.env.SMS_PROVIDER_URL; // e.g. an MSG91/Twilio-compatible endpoint
const SMS_API_KEY = process.env.SMS_API_KEY;
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || 'SCFRUM';

/**
 * Sends an SMS. Mirrors utils/email.js: if no SMS gateway is configured,
 * the message is logged instead of sent so local development and demos
 * never break on missing provider credentials. Real integration only
 * requires filling in SMS_PROVIDER_URL / SMS_API_KEY.
 */
async function sendSms({ to, message }) {
  if (!SMS_PROVIDER_URL || !SMS_API_KEY) {
    logger.warn(`SMS gateway not configured — logging SMS instead of sending. To: ${to}`);
    logger.debug(message);
    return { skipped: true, delivered: true }; // treat as delivered in demo/dev mode
  }

  try {
    const res = await fetch(SMS_PROVIDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SMS_API_KEY}` },
      body: JSON.stringify({ to, message, senderId: SMS_SENDER_ID }),
    });
    if (!res.ok) throw new Error(`SMS gateway responded ${res.status}`);
    return { skipped: false, delivered: true };
  } catch (err) {
    logger.error('Failed to send SMS:', err.message);
    return { skipped: false, delivered: false, error: err.message };
  }
}

module.exports = { sendSms };
