const prisma = require('../config/db');

/**
 * Creates an in-app notification for a user.
 * @param {{userId: string, title: string, message: string, type: string, relatedComplaintId?: string}} params
 */
async function notifyUser({ userId, title, message, type, relatedComplaintId = null }) {
  return prisma.notification.create({
    data: { userId, title, message, type, relatedComplaintId },
  });
}

async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

async function markAsRead(notificationId, userId) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

async function markAllAsRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

async function listForUser(userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

module.exports = { notifyUser, getUnreadCount, markAsRead, markAllAsRead, listForUser };
