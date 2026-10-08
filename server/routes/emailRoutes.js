const express = require('express');
const emailController = require('../controllers/emailController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/logs', emailController.listLogs);
router.post('/test', emailController.sendTest);

module.exports = router;
