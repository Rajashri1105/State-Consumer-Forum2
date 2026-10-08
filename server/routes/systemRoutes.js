const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const ApiResponse = require('../utils/ApiResponse');
const { sendDailyCaseDigest } = require('../services/dailyDigestService');
const { runEscalationSweep } = require('../services/escalationService');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

// POST /system/trigger-daily-digest — manually fire the judges' daily case
// digest instead of waiting for the 7 AM cron job. Handy for testing/demo.
router.post('/trigger-daily-digest', async (req, res) => {
  const result = await sendDailyCaseDigest();
  return new ApiResponse(200, result, 'Daily case digest sent').send(res);
});

// POST /system/trigger-escalation-sweep — Feature 5: manually run the
// overdue-hearing escalation check instead of waiting for the hourly
// cron job (see server.js). Handy for testing/demo.
router.post('/trigger-escalation-sweep', async (req, res) => {
  const result = await runEscalationSweep();
  return new ApiResponse(200, result, 'Escalation sweep complete').send(res);
});

module.exports = router;
