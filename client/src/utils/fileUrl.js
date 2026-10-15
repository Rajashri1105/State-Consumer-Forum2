const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Relative API configuration means uploads share the frontend's origin and
// are forwarded to the backend by the development/production proxy.
const SERVER_ORIGIN = API_BASE_URL.startsWith('/')
  ? ''
  : API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export function fileUrl(relativePath) {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/\\/g, '/'); // Windows-saved paths use backslashes
  return `${SERVER_ORIGIN}/uploads/${normalized}`;
}
