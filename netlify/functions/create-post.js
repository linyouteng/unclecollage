// /.netlify/functions/create-post.js
import crypto from 'crypto';
import {
  findDataResource,
  isDeletedRecord,
  normalizeSlug,
  readPostRecord,
  unversionedPostExists,
  uploadPostRecord,
} from './_shared/cloudinary-data.js';

// ---- CORS ----
const CORS_HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
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

function errorJSON(err, status = 500) {
  const msg =
    (err && (err.message || err.error?.message)) ||
    String(err) ||
    'Unknown error';
  try {
    console.error('[create-post] error:', err);
  } catch {}
  return sendJSON({ error: msg }, status);
}

// ---- JWT 驗證 (HS256) ----
function b64urlJson(str) {
  const pad = str.length % 4 === 2 ? '==' : str.length % 4 === 3 ? '=' : '';
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
}

function verifyJWT(token, secret) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const header = b64urlJson(h);
    if (header.alg !== 'HS256') return null;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${h}.${p}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (expected !== s) return null;

    const payload = b64urlJson(p);
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

function normalizeItems(items) {
  return items
    .filter((item) => item && item.url)
    .map((item) => ({
      url: String(item.url),
      caption: item.caption ? String(item.caption) : '',
      groupId: item.groupId ? String(item.groupId) : '',
      groupTitle: item.groupTitle ? String(item.groupTitle) : '',
      floor: item.floor ? String(item.floor) : '',
      place: item.place ? String(item.place) : '',
      type: item.type ? String(item.type) : '',
      brand: item.brand ? String(item.brand) : '',
      model: item.model ? String(item.model) : '',
      deviceNote: item.deviceNote ? String(item.deviceNote) : '',
    }));
}

function normalizeGroups(groups) {
  return Array.isArray(groups)
    ? groups.map((group) => ({
        id: group?.id ? String(group.id) : '',
        title: group?.title ? String(group.title) : '',
        floor: group?.floor ? String(group.floor) : '',
        place: group?.place ? String(group.place) : '',
        type: group?.type ? String(group.type) : '',
        brand: group?.brand ? String(group.brand) : '',
        model: group?.model ? String(group.model) : '',
        deviceNote: group?.deviceNote ? String(group.deviceNote) : (group?.note ? String(group.note) : ''),
        note: group?.deviceNote ? String(group.deviceNote) : (group?.note ? String(group.note) : ''),
        items: Array.isArray(group?.items) ? normalizeItems(group.items) : [],
      }))
    : [];
}

// ---- Handler ----
export default async (request) => {
  if (request.method === 'OPTIONS') return preflight();

  if (request.method !== 'POST') {
    return sendJSON({ error: 'Method not allowed' }, 405);
  }

  const admin = requireAdmin(request);
  if (!admin) {
    return sendJSON({ error: 'Unauthorized' }, 401);
  }

  let body = null;
  try {
    body = await request.json();
  } catch (_) {
    return sendJSON({ error: 'Invalid JSON body' }, 400);
  }

  const { title, date, desc, tags, items, groups, coverIndex, visible } = body || {};

  let slug;
  try {
    slug = normalizeSlug(body?.slug);
  } catch (err) {
    return sendJSON({ error: err.message }, err.message === 'slug required' ? 400 : 400);
  }

  if (!Array.isArray(items) || items.length === 0) {
    return sendJSON({ error: 'items required' }, 400);
  }

  const normalizedItems = normalizeItems(items);
  if (!normalizedItems.length) {
    return sendJSON({ error: 'items required' }, 400);
  }

  const normalizedGroups = normalizeGroups(groups);

  try {
    // 新增時不允許覆蓋既有 slug，包含已刪除 tombstone。
    // 這可避免刪除後重用同一個分享網址時，撞到 Cloudinary / PWA / 社群預覽快取。
    const existingResource = await findDataResource(slug);
    const stalePublicUrlExists = !existingResource && await unversionedPostExists(slug);
    if (existingResource || stalePublicUrlExists) {
      const existing = existingResource ? await readPostRecord(slug) : null;
      const deletedText = stalePublicUrlExists || (existing && isDeletedRecord(existing.data)) ? '（此代碼曾經被刪除或仍有舊快取，為避免舊頁面混淆不再重用）' : '';
      return sendJSON({ error: `slug already exists ${deletedText}`.trim() }, 409);
    }

    const normalizedCoverIndex = Number.isInteger(Number(coverIndex))
      ? Math.min(Math.max(Number(coverIndex), 0), normalizedItems.length - 1)
      : 0;
    const previewUrl = normalizedItems[normalizedCoverIndex]?.url || normalizedItems[0]?.url || null;

    const now = new Date().toISOString();
    const record = {
      slug,
      title,
      date,
      desc: desc || '',
      tags,
      items: normalizedItems,
      groups: normalizedGroups,
      coverIndex: normalizedCoverIndex,
      cover: previewUrl,
      created_at: now,
      updated_at: now,
      preview: previewUrl,
      visible: typeof visible === 'boolean' ? visible : true,
      deleted: false,
    };

    await uploadPostRecord(slug, record);

    return sendJSON({ ok: true, slug }, 200);
  } catch (err) {
    return errorJSON(err, 500);
  }
};
