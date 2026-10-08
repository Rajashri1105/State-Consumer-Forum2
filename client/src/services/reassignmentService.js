import api from './api';

export const reassignmentService = {
  list: (status) => api.get('/reassignments', { params: { status } }),
  approve: (id, payload) => api.patch(`/reassignments/${id}/approve`, payload || {}),
  reject: (id) => api.patch(`/reassignments/${id}/reject`),
};
