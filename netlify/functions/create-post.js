// /.netlify/functions/create-post.js
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin } from './_auth.js';

// Cloudinary 後端認證
cloudinary.config({
  cloud_name: process.env.CLD_CLOUD_NAME,
  api_key: process.env.CLD_API_KEY,
  api_secret: process.env.CLD_API_SECRET,
});

// ---- CORS ----
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

function errorJSON(err, status = 500) {
  const msg =
    (err && (err.message || err.error?.message)) ||
    String(err) ||
    'Unknown error';
  try {
    console.error('[create-post] error:', err);
  } catch {}
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: CORS_HEADERS,
  });
}

export default async (request) => {
  // CORS 預檢
  if (request.method === 'OPTIONS') return preflight();

  if (request.method !== 'POST') {
    return sendJSON({ error: 'Method not allowed' }, 405);
  }

  // 確認你是管理員
  const admin = requireAdmin(request);
  if (!admin) {
    return sendJSON({ error: 'Unauthorized' }, 401);
  }

  // 解析 body
  let body = null;
  try {
    body = await request.json();
  } catch (_) {
    return sendJSON({ error: 'Invalid JSON body' }, 400);
  }

  const { title, date, desc, tags, slug, items, visible } = body || {};

  // 基本驗證
  if (!slug || !String(slug).trim()) {
    return sendJSON({ error: 'slug required' }, 400);
  }
  if (!Array.isArray(items) || items.length === 0) {
    return sendJSON({ error: 'items required' }, 400);
  }

  // 第一張圖當預覽縮圖
  const previewUrl = items[0]?.url || null;

  // 我們要儲存的資料格式
  const record = {
    slug,
    title,
    date,
    desc: desc || '',
    tags,
    items, // [{ url, caption }, ...]
    created_at: new Date().toISOString(),
    preview: previewUrl,
    visible: typeof visible === 'boolean' ? visible : true, // 預設上架，除非前端指定隱藏
  };

  try {
    // 上傳成 raw JSON 到 Cloudinary
    const jsonBase64 = Buffer.from(JSON.stringify(record)).toString(
      'base64'
    );

    await cloudinary.uploader.upload(
      `data:application/json;base64,${jsonBase64}`,
      {
        resource_type: 'raw',
        public_id: `collages/${slug}/data`,
        overwrite: true,
        format: 'json',
      }
    );

    return sendJSON({ ok: true, slug }, 200);
  } catch (err) {
    return errorJSON(err, 500);
  }
};
