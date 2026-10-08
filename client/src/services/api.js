import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send the httpOnly refresh-token cookie
  headers: { 'Content-Type': 'application/json' },
});

// In-memory access token (never persisted to localStorage — refresh
// token lives in an httpOnly cookie set by the server; the access
// token only needs to survive the current tab session).
let accessToken = null;
let onLogout = () => {};

export function setAccessToken(token) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function registerLogoutHandler(fn) {
  onLogout = fn;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = api.post('/auth/refresh').finally(() => {
            refreshPromise = null;
          });
        }
        const { data } = await refreshPromise;
        setAccessToken(data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        onLogout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
