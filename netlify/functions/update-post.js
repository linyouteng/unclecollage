// /.netlify/functions/update-post.js
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

cloudinary.config({
  cloud_name: process.env.CLD_CLOUD_NAME,
  api_key: process.env.CLD_API_KEY,
  api_secret: process.env.CLD_API_SECRET,
});

const CORS_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function sendJSON(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

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
  if (!payload || payload.role !== 'admin') return null;
  return payload;
}

async function readExisting(slug) {
  try {
    const cloud = process.env.CLD_CLOUD_NAME;
    if (!cloud) return null;
    const dataUrl = `https://res.cloudinary.com/${cloud}/raw/upload/collages/${encodeURIComponent(slug)}/data.json`;
    const resp = await fetch(dataUrl);
    if (!resp.ok) return null;
    return await resp.json().catch(() => null);
  } catch {
    return null;
  }
}

export default async (request) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return sendJSON({ error: 'Method not allowed' }, 405);

  const admin = requireAdmin(request);
  if (!admin) return sendJSON({ error: 'Unauthorized' }, 401);

  let body = null;
  try {
    body = await request.json();
  } catch {
    return sendJSON({ error: 'Invalid JSON body' }, 400);
  }

  const { title, date, desc, tags, slug, items, groups, coverIndex, visible, created_at } = body || {};

  if (!slug || !String(slug).trim()) return sendJSON({ error: 'slug required' }, 400);
  if (!/^[a-zA-Z0-9_-]+$/.test(String(slug))) {
    return sendJSON({ error: 'slug only allows letters, numbers, - and _' }, 400);
  }
  if (!Array.isArray(items) || items.length === 0) return sendJSON({ error: 'items required' }, 400);

  const normalizedItems = items
    .filter((item) => item && item.url)
    .map((item) => ({
      url: String(item.url),
      caption: item.caption ? String(item.caption) : '',
      groupId: item.groupId ? String(item.groupId) : '',
      groupTitle: item.groupTitle ? String(item.groupTitle) : '',
      floor: item.floor ? String(item.floor) : '',
      place: item.place ? String(item.place) : '',
      type: item.type ? String(item.type) : '',
    }));

  const normalizedGroups = Array.isArray(groups)
    ? groups.map((group) => ({
        id: group?.id ? String(group.id) : '',
        title: group?.title ? String(group.title) : '',
        floor: group?.floor ? String(group.floor) : '',
        place: group?.place ? String(group.place) : '',
        type: group?.type ? String(group.type) : '',
        note: group?.note ? String(group.note) : '',
        items: Array.isArray(group?.items)
          ? group.items.filter((item) => item && item.url).map((item) => ({
              url: String(item.url),
              caption: item.caption ? String(item.caption) : '',
              groupId: item.groupId ? String(item.groupId) : (group?.id ? String(group.id) : ''),
              groupTitle: item.groupTitle ? String(item.groupTitle) : (group?.title ? String(group.title) : ''),
              floor: item.floor ? String(item.floor) : (group?.floor ? String(group.floor) : ''),
              place: item.place ? String(item.place) : (group?.place ? String(group.place) : ''),
              type: item.type ? String(item.type) : (group?.type ? String(group.type) : ''),
            }))
          : [],
      }))
    : [];

  if (!normalizedItems.length) return sendJSON({ error: 'items required' }, 400);

  const normalizedCoverIndex = Number.isInteger(Number(coverIndex))
    ? Math.min(Math.max(Number(coverIndex), 0), normalizedItems.length - 1)
    : 0;
  const previewUrl = normalizedItems[normalizedCoverIndex]?.url || normalizedItems[0]?.url || null;
  const existing = await readExisting(slug);

  const record = {
    slug: String(slug),
    title: title || existing?.title || '',
    date: date || existing?.date || '',
    desc: desc || '',
    tags: tags || '',
    items: normalizedItems,
    groups: normalizedGroups,
    coverIndex: normalizedCoverIndex,
    cover: previewUrl,
    preview: previewUrl,
    created_at: existing?.created_at || created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    visible: typeof visible === 'boolean' ? visible : existing?.visible !== false,
  };

  try {
    const jsonBase64 = Buffer.from(JSON.stringify(record)).toString('base64');
    await cloudinary.uploader.upload(`data:application/json;base64,${jsonBase64}`, {
      resource_type: 'raw',
      public_id: `collages/${slug}/data`,
      overwrite: true,
      format: 'json',
    });

    return sendJSON({ ok: true, slug }, 200);
  } catch (err) {
    const msg = (err && (err.message || err.error?.message)) || String(err) || 'Unknown error';
    console.error('[update-post] error:', err);
    return sendJSON({ error: msg }, 500);
  }
};
