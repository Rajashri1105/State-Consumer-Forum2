const express = require('express');
const authRoutes = require('./authRoutes');
const complaintRoutes = require('./complaintRoutes');
const hearingRoutes = require('./hearingRoutes');
const judgmentRoutes = require('./judgmentRoutes');
const notificationRoutes = require('./notificationRoutes');
const categoryRoutes = require('./categoryRoutes');
const userRoutes = require('./userRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const settingsRoutes = require('./settingsRoutes');
const judgeLeaveRoutes = require('./judgeLeaveRoutes');
const reassignmentRoutes = require('./reassignmentRoutes');
const systemRoutes = require('./systemRoutes');
const benchRoutes = require('./benchRoutes');
const partyRoutes = require('./partyRoutes');
const emailRoutes = require('./emailRoutes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/complaints', complaintRoutes);
router.use('/hearings', hearingRoutes);
router.use('/judgments', judgmentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/categories', categoryRoutes);
router.use('/users', userRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/settings', settingsRoutes);
router.use('/judge-leaves', judgeLeaveRoutes);
router.use('/reassignments', reassignmentRoutes);
router.use('/system', systemRoutes);
router.use('/benches', benchRoutes);
router.use('/party', partyRoutes);
router.use('/email', emailRoutes);

module.exports = router;
