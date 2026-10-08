import api from './api';

export const hearingService = {
  getSuggestion: (complaintId) => api.get('/hearings/suggest', { params: { complaintId } }),
  schedule: (payload) => api.post('/hearings', payload),
  reschedule: (id, payload) => api.patch(`/hearings/${id}/reschedule`, payload),
  adjourn: (id, adjournReason) => api.patch(`/hearings/${id}/adjourn`, { adjournReason }),
  complete: (id, remarks) => api.patch(`/hearings/${id}/complete`, { remarks }),
  uploadNotice: (id, formData) => api.post(`/hearings/${id}/notice`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getCalendar: (params) => api.get('/hearings/calendar', { params }),

  // Feature 4: Notice Delivery Tracker
  getNoticeStatus: (id) => api.get(`/hearings/${id}/notice-status`),
  resendNotice: (id, channel) => api.post(`/hearings/${id}/notice-status/${channel}/resend`),
};
