import api from './api';

export const benchService = {
  list: () => api.get('/benches'),
  workload: () => api.get('/benches/workload'),
  create: (payload) => api.post('/benches', payload),
  update: (id, payload) => api.patch(`/benches/${id}`, payload),
  remove: (id) => api.delete(`/benches/${id}`),
  addJudge: (id, judgeId) => api.post(`/benches/${id}/judges`, { judgeId }),
  removeJudge: (id, judgeId) => api.delete(`/benches/${id}/judges/${judgeId}`),
  addClerk: (id, clerkId) => api.post(`/benches/${id}/clerks`, { clerkId }),
  removeClerk: (id, clerkId) => api.delete(`/benches/${id}/clerks/${clerkId}`),
};
