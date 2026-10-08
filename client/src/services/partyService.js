import api from './api';

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

export const partyService = {
  // Opposite party
  myCases: () => api.get('/party/cases'),
  fileReply: (id, text, files = []) => {
    const form = new FormData();
    form.append('text', text);
    files.forEach((f) => form.append('files', f));
    return api.post(`/party/${id}/reply`, form, multipart);
  },
  requestExtension: (id, payload) => api.post(`/party/${id}/extension`, payload),
  offerSettlement: (id, payload) => api.post(`/party/${id}/settlement`, payload),
  withdrawSettlement: (offerId) => api.patch(`/party/settlements/${offerId}/withdraw`),

  // Judge / Registrar / Admin
  decideExtension: (extId, payload) => api.patch(`/party/extensions/${extId}`, payload),

  // Consumer
  respondToSettlement: (offerId, payload) => api.patch(`/party/settlements/${offerId}`, payload),

  // Everyone with access to the case
  responses: (id) => api.get(`/party/${id}/responses`),

  // Registrar / Admin / Court Clerk
  resendInvite: (id) => api.post(`/party/${id}/resend-invite`),
};

export const emailService = {
  logs: (params) => api.get('/email/logs', { params }),
  sendTest: (to) => api.post('/email/test', { to }),
};
