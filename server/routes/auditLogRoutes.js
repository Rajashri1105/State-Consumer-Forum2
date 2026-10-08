const express = require('express');
const auditLogController = require('../controllers/auditLogController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/', auditLogController.listAuditLogs);

module.exports = router;
