const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', notificationController.listNotifications);
router.get('/unread-count', notificationController.unreadCount);
router.patch('/:id/read', notificationController.markRead);
router.patch('/mark-all-read', notificationController.markAllRead);

module.exports = router;
