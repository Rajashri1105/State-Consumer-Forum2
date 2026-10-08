const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('ADMIN', 'REGISTRAR'));

router.get('/dashboard', analyticsController.getDashboardAnalytics);

module.exports = router;
