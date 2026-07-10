import JSZip from 'jszip';
import { isDeletedRecord, normalizeSlug, readPostRecord } from './_shared/cloudinary-data.js';

function errorJSON(msg, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}

function safeName(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} _-]+/gu, '')
    .replace(/[ ]+/g, '_')
    .slice(0, 80) || 'untitled';
}

function yyyymmdd(input) {
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  } catch {
    return '';
  }
}

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store',
    },
  });

  try {
    const url = new URL(request.url);
    const slug = normalizeSlug(url.searchParams.get('slug'));

    const found = await readPostRecord(slug);
    if (!found || !found.data || isDeletedRecord(found.data)) return errorJSON('not found', 404);

    const data = found.data;
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) return errorJSON('no items', 400);

    const title = safeName(data.title || '');
    const date = yyyymmdd(data.date || '');
    const base = [title, date, slug].filter(Boolean).join('-') || slug;

    const zip = new JSZip();
    zip.file('README.txt', `Title: ${data.title || ''}
Date: ${data.date || ''}
Slug: ${slug}
Count: ${items.length}
`);

    let idx = 1;
    for (const it of items) {
      const itemUrl = it.url;
      if (!itemUrl) continue;
      const resp = await fetch(itemUrl, { cache: 'no-store' });
      if (!resp.ok) continue;
      const buf = new Uint8Array(await resp.arrayBuffer());
      const m = itemUrl.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i);
      const ext = m ? m[1].toLowerCase() : 'jpg';
      const safeCaption = safeName(it.caption || '').slice(0, 40);
      const name = `${String(idx).padStart(2, '0')}${safeCaption ? '_' + safeCaption : ''}.${ext}`;
      zip.file(name, buf);
      idx++;
    }

    const content = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    const asciiFallback = base.replace(/[^ -~]+/g, '_') + '.zip';
    const utf8Encoded = encodeURIComponent(base + '.zip');

    return new Response(content, {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    return errorJSON(String((e && e.message) || e), /slug required|slug only allows/i.test(String(e && e.message || e)) ? 400 : 500);
  }
};
