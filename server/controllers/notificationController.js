const ApiResponse = require('../utils/ApiResponse');
const notificationService = require('../services/notificationService');

async function listNotifications(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const result = await notificationService.listForUser(req.user.id, { page, limit });
  return new ApiResponse(200, result).send(res);
}

async function unreadCount(req, res) {
  const count = await notificationService.getUnreadCount(req.user.id);
  return new ApiResponse(200, { count }).send(res);
}

async function markRead(req, res) {
  await notificationService.markAsRead(req.params.id, req.user.id);
  return new ApiResponse(200, null, 'Notification marked as read').send(res);
}

async function markAllRead(req, res) {
  await notificationService.markAllAsRead(req.user.id);
  return new ApiResponse(200, null, 'All notifications marked as read').send(res);
}

module.exports = { listNotifications, unreadCount, markRead, markAllRead };
