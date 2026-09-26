// Thin fetch wrapper. The session lives in an httpOnly cookie; the client never sees the token.
// API_BASE is empty when the API is served from the same origin (dev proxy / Express), or the
// API's URL when the client is hosted separately (e.g. GitHub Pages → VITE_API_URL).
export const API_BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(method, path, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  // Required by the server on every write: a header a plain HTML form can't send, which makes
  // cross-site requests go through a CORS preflight (CSRF protection).
  if (method !== 'GET') headers['X-Requested-With'] = 'hourglass';
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Nothing is lost; try again when you're connected.");
  }
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth:expired'));
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.details);
  }
  if (data === null && method === 'GET') {
    // Got HTML instead of JSON: this is a static host with no API behind it.
    throw new ApiError(-1, 'No API server is configured for this site.');
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
};
