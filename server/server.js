const cron = require('node-cron');
const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const prisma = require('./config/db');
const { sendDailyCaseDigest } = require('./services/dailyDigestService');
const { runEscalationSweep } = require('./services/escalationService');
const { releaseStaleClaims } = require('./services/allotmentService');
const { runReplyDeadlineSweep } = require('./services/partyService');

const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info(`Server running in ${config.env} mode on port ${config.port}`);
  logger.info(`Links in e-mails will point to ${config.clientUrl}`);
  if (config.clientUrl.includes('localhost')) {
    logger.warn('CLIENT_URL contains "localhost" - links in e-mails will not be reachable from other devices on the network.');
  }
});

// --------------------------------------------------------------------------
// Daily case digest — notifies each judge of their hearing docket for the
// day, every morning at 7:00 AM server time.
// --------------------------------------------------------------------------
cron.schedule('0 7 * * *', () => {
  sendDailyCaseDigest().catch((err) => logger.error('Daily case digest job failed:', err.message));
});

// --------------------------------------------------------------------------
// Feature 5: Escalation Alert for Overdue Hearings — background sweep,
// runs hourly (also triggered on page load of the Clerk/Admin queues, and
// on-demand via POST /system/trigger-escalation-sweep).
// --------------------------------------------------------------------------
cron.schedule('0 * * * *', () => {
  runEscalationSweep().catch((err) => logger.error('Escalation sweep job failed:', err.message));
});

// --------------------------------------------------------------------------
// Intake queue hygiene — a complaint claimed by a scrutiny clerk but left
// untouched for ForumSettings.claimTimeoutHours returns to the shared pool.
// --------------------------------------------------------------------------
cron.schedule('*/15 * * * *', () => {
  releaseStaleClaims().catch((err) => logger.error('Stale-claim release job failed:', err.message));
});

// --------------------------------------------------------------------------
// Opposite-party reply clock — 7-day / 1-day reminders, then "ex parte eligible"
// once the deadline passes with no reply.
// --------------------------------------------------------------------------
cron.schedule('*/30 * * * *', () => {
  runReplyDeadlineSweep().catch((err) => logger.error('Reply deadline sweep failed:', err.message));
});

// --------------------------------------------------------------------------
// Graceful shutdown
// --------------------------------------------------------------------------
async function shutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed. Database connection released.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});
