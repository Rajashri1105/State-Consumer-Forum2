const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// The API base includes /api/v1; uploaded files are served from the
// server's origin directly under /uploads, so strip the API suffix.
const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export function fileUrl(relativePath) {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/\\/g, '/'); // Windows-saved paths use backslashes
  return `${SERVER_ORIGIN}/uploads/${normalized}`;
}
