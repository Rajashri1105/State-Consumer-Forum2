import api from './api';

export const adminUserService = {
  list: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (payload) => api.post('/users', payload),
  update: (id, payload) => api.patch(`/users/${id}`, payload),
  setStatus: (id, isActive) => api.patch(`/users/${id}/status`, { isActive }),
  remove: (id) => api.delete(`/users/${id}`),
};

export const analyticsService = {
  getDashboard: () => api.get('/analytics/dashboard'),
};

export const auditLogService = {
  list: (params) => api.get('/audit-logs', { params }),
};

export const settingsService = {
  getForumSettings: () => api.get('/settings/forum'),
  updateForumSettings: (payload) => api.patch('/settings/forum', payload),
  listHolidays: () => api.get('/settings/holidays'),
  createHoliday: (payload) => api.post('/settings/holidays', payload),
  deleteHoliday: (id) => api.delete(`/settings/holidays/${id}`),
};
