// /.netlify/functions/get-post.js
import { isDeletedRecord, normalizeSlug, readPostRecord } from './_shared/cloudinary-data.js';

const CORS_HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
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

export default async (request) => {
  if (request.method === 'OPTIONS') return preflight();

  if (request.method !== 'GET') {
    return sendJSON({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(request.url);
    const slug = normalizeSlug(url.searchParams.get('slug'));

    const found = await readPostRecord(slug);
    if (!found || !found.data || isDeletedRecord(found.data)) {
      return sendJSON({ error: 'not found' }, 404);
    }

    return sendJSON(found.data, 200);
  } catch (err) {
    const message =
      (err && (err.message || err.error?.message)) ||
      String(err) ||
      'Unknown error';
    const status = /slug required|slug only allows/i.test(message) ? 400 : 500;
    return sendJSON({ error: message }, status);
  }
};
