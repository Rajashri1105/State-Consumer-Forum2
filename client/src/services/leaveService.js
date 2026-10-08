import api from './api';

export const leaveService = {
  listMine: () => api.get('/judge-leaves/mine'),
  createMine: (payload) => api.post('/judge-leaves/mine', payload),
  listAll: () => api.get('/judge-leaves'),
  createForJudge: (payload) => api.post('/judge-leaves', payload),
  getTodaysAbsences: () => api.get('/judge-leaves/today'),
  remove: (id) => api.delete(`/judge-leaves/${id}`),
};
