import api from './api';

export const judgmentService = {
  finalizeVerdict: (complaintId, formData) => api.post(`/judgments/${complaintId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  get: (complaintId) => api.get(`/judgments/${complaintId}`),
};

export const notificationService = {
  list: (params) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/mark-all-read'),
};

export const categoryService = {
  list: () => api.get('/categories'),
  create: (payload) => api.post('/categories', payload),
  update: (id, payload) => api.patch(`/categories/${id}`, payload),
  remove: (id) => api.delete(`/categories/${id}`),
  listPriorityRules: () => api.get('/categories/priority-rules/all'),
  createPriorityRule: (payload) => api.post('/categories/priority-rules', payload),
  updatePriorityRule: (id, payload) => api.patch(`/categories/priority-rules/${id}`, payload),
  removePriorityRule: (id) => api.delete(`/categories/priority-rules/${id}`),
};
