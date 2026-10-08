import api from './api';

export const complaintService = {
  create: (payload) => api.post('/complaints', payload),
  uploadEvidence: (id, formData) => api.post(`/complaints/${id}/evidence`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMine: (params) => api.get('/complaints/mine', { params }),
  list: (params) => api.get('/complaints', { params }),
  getById: (id) => api.get(`/complaints/${id}`),
  verify: (id, remarks) => api.patch(`/complaints/${id}/verify`, { remarks }),
  reject: (id, rejectionReason) => api.patch(`/complaints/${id}/reject`, { rejectionReason }),
  getJudgeRecommendations: () => api.get('/complaints/judge-recommendations'),
  withdraw: (id, reason) => api.patch(`/complaints/${id}/withdraw`, { reason }),
  downloadReceipt: (id) => api.get(`/complaints/${id}/receipt`, { responseType: 'blob' }),
  submitFeedback: (id, payload) => api.post(`/complaints/${id}/feedback`, payload),

  // Feature 2: AI-Assisted Complaint Drafting
  generateSynopsisDraft: (payload) => api.post('/complaints/synopsis/generate', payload),
  regenerateSynopsis: (id, payload) => api.post(`/complaints/${id}/synopsis/generate`, payload),
  downloadSynopsisPdf: (id) => api.get(`/complaints/${id}/synopsis/pdf`, { responseType: 'blob' }),

  // Feature 3: Document Completeness Checker
  getCompleteness: (id) => api.get(`/complaints/${id}/completeness`),

  // Scrutiny (intake) clerk: claim from the shared queue, then verify / defective / reject
  claim: (id) => api.patch(`/complaints/${id}/claim`),
  release: (id) => api.patch(`/complaints/${id}/release`),
  markDefective: (id, remarks) => api.patch(`/complaints/${id}/defective`, { remarks }),

  // Consumer: fix a defective complaint and send it back to scrutiny
  resubmit: (id) => api.patch(`/complaints/${id}/resubmit`),

  // Registrar: bench allotment / re-allotment ({ judgeId?, benchId?, reason? })
  getAllotmentQueue: () => api.get('/complaints/allotment-queue'),
  allot: (id, payload) => api.patch(`/complaints/${id}/allot`, payload),

  // Judge: recuse -> back to the Registrar
  recuse: (id, reason) => api.post(`/complaints/${id}/recuse`, { reason }),
};
