// /.netlify/functions/admin-login.js
import jwt from 'jsonwebtoken';

const CORS_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function sendJSON(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function preflight() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export default async (request) => {
  // CORS 預檢
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') {
    return sendJSON({ error: 'Method not allowed' }, 405);
  }

  // 讀 body.password / body.remember
  let body = null;
  try {
    body = await request.json();
  } catch (_) {}

  const password = body?.password || '';
  const remember = Boolean(body?.remember);

  // 比對環境變數
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return sendJSON({ error: 'Unauthorized' }, 401);
  }

  const secret = process.env.ADMIN_JWT_SECRET || '';
  if (!secret) {
    return sendJSON({ error: 'Server not configured' }, 500);
  }

  // token 壽命：remember=30 天，否則 2 小時
  const expiresIn = remember ? '30d' : '2h';

  const token = jwt.sign(
    { role: 'admin' },
    secret,
    { expiresIn }
  );

  // 方便前端顯示/判斷的 expiresAt（毫秒）
  let expiresAt = null;
  try {
    const decoded = jwt.decode(token);
    if (decoded?.exp) expiresAt = decoded.exp * 1000;
  } catch {}

  return sendJSON({ token, expiresAt });
};
