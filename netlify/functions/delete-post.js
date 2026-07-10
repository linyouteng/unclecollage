// /.netlify/functions/delete-post.js
import jwt from 'jsonwebtoken';
import {
  cloudinary,
  isDeletedRecord,
  normalizeSlug,
  readPostRecord,
  uploadPostRecord,
} from './_shared/cloudinary-data.js';

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

function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const decoded = jwt.verify(m[1], process.env.ADMIN_JWT_SECRET);
    if (decoded && decoded.role === 'admin') return decoded;
  } catch (_) {}
  return null;
}

async function deleteImageResources(slug) {
  const folderPrefix = `collages/${slug}/`;
  await cloudinary.api.delete_resources_by_prefix(folderPrefix, {
    resource_type: 'image',
    type: 'upload',
    invalidate: true,
  });
}

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

  let slug;
  try {
    slug = normalizeSlug(body?.slug);
  } catch (err) {
    return sendJSON({ error: err.message }, 400);
  }

  try {
    const found = await readPostRecord(slug);
    if (!found || !found.data) {
      return sendJSON({ error: 'not found' }, 404);
    }

    // 圖片可以刪除，但 raw data 不再刪除。
    // 保留一筆 deleted tombstone，讓 next-slug 永遠不會重用同一個分享網址。
    await deleteImageResources(slug);

    const now = new Date().toISOString();
    const deletedRecord = {
      ...found.data,
      slug,
      visible: false,
      deleted: true,
      status: 'deleted',
      deleted_at: found.data.deleted_at || now,
      updated_at: now,
      // 清掉公開頁/ZIP 會用到的圖片資料，避免刪除後仍殘留舊圖資訊。
      items: [],
      groups: [],
      cover: null,
      preview: null,
      deletion_note: 'soft-deleted tombstone; keep this raw record to prevent slug reuse and stale share-page cache collisions',
    };

    if (!isDeletedRecord(found.data)) {
      await uploadPostRecord(slug, deletedRecord);
    } else {
      // 已刪除的舊 tombstone 也重新上傳一次，確保欄位格式是最新版。
      await uploadPostRecord(slug, deletedRecord);
    }

    return sendJSON({ ok: true, slug, deleted: true });
  } catch (err) {
    return sendJSON(
      {
        error:
          (err && (err.message || err.error?.message)) ||
          String(err) ||
          'Unknown error',
      },
      500
    );
  }
};
