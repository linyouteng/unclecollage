// /.netlify/functions/next-slug.js
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

// ---- Cloudinary 設定 ----
cloudinary.config({
  cloud_name: process.env.CLD_CLOUD_NAME,
  api_key: process.env.CLD_API_KEY,
  api_secret: process.env.CLD_API_SECRET,
});

// ---- CORS + 回傳工具 ----
const CORS_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
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

function errorJSON(err, status = 500) {
  const msg =
    (err && (err.message || err.error?.message)) ||
    String(err) ||
    'Unknown error';
  try { console.error('[next-slug] error:', err); } catch {}
  return sendJSON({ error: msg }, status);
}

// ---- JWT 驗證，跟其他管理 API 同一套 HS256 ----
function decodeB64Json(str) {
  const pad = str.length % 4 === 2 ? '==' :
              str.length % 4 === 3 ? '='  : '';
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
}

function verifyJWT(token, secret) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;

    const header = decodeB64Json(h);
    if (header.alg !== 'HS256') return null;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${h}.${p}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (expected !== s) return null;

    const payload = decodeB64Json(p);
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;

    return payload;
  } catch {
    return null;
  }
}

function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const secret = process.env.ADMIN_JWT_SECRET || '';
  if (!secret) return null;

  const payload = verifyJWT(m[1], secret);
  if (!payload) return null;
  if (payload.role !== 'admin') return null;

  return payload;
}

function dateSlugPrefix(dateValue) {
  const now = new Date();
  const fallback = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');

  const compact = String(dateValue || '').replace(/[^0-9]/g, '');
  return /^\d{8}$/.test(compact) ? compact : fallback;
}

// ---- Handler ----
export default async (request) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'GET') {
    return sendJSON({ error: 'Method not allowed' }, 405);
  }

  const admin = requireAdmin(request);
  if (!admin) {
    return sendJSON({ error: 'Unauthorized' }, 401);
  }

  try {
    const cloud = process.env.CLD_CLOUD_NAME;
    if (!cloud || !process.env.CLD_API_KEY || !process.env.CLD_API_SECRET) {
      return errorJSON('Missing Cloudinary env vars', 500);
    }

    const url = new URL(request.url);
    const prefix = dateSlugPrefix(url.searchParams.get('date'));
    const targetPrefix = `collages/${prefix}-`;
    const pattern = new RegExp(`^collages/${prefix}-(\\d+)/data(?:\\.json)?$`, 'i');

    let maxSeq = 0;
    let nextCursor;

    // 只查今天日期開頭的 raw data，不再抓全部案例，也不 fetch 每筆 data.json 內容。
    do {
      const res = await cloudinary.api.resources({
        resource_type: 'raw',
        type: 'upload',
        prefix: targetPrefix,
        max_results: 100,
        next_cursor: nextCursor,
      });

      for (const resource of res.resources || []) {
        const publicId = resource.public_id || '';
        const match = publicId.match(pattern);
        if (match) maxSeq = Math.max(maxSeq, Number(match[1]) || 0);
      }

      nextCursor = res.next_cursor || undefined;
    } while (nextCursor);

    const nextSeq = maxSeq + 1;
    const slug = `${prefix}-${String(nextSeq).padStart(3, '0')}`;

    return sendJSON({ ok: true, slug, prefix, nextSeq }, 200);
  } catch (err) {
    return errorJSON(err, 500);
  }
};
