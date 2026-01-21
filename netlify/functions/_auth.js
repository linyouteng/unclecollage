// /.netlify/functions/_auth.js
import jwt from 'jsonwebtoken';

export function sendJSON(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
      ...extraHeaders,
    },
  });
}

export function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const secret = process.env.ADMIN_JWT_SECRET || '';
  if (!secret) return null;

  try {
    const payload = jwt.verify(m[1], secret);
    if (!payload || payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}
