// /.netlify/functions/share.js
// Dynamic Open Graph preview page for sharing /p/<slug>
// - Works for link preview crawlers (LINE/iMessage) because OG tags exist in raw HTML
// - Redirects human visitors to post.html?slug=...

function pickHeader(headers, name) {
  if (!headers) return '';
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : '';
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function extractSlugFromPath(pathname) {
  if (!pathname) return '';
  // Normalize: remove query/hash if present
  const clean = pathname.split('?')[0].split('#')[0];

  // Accept both:
  // - /p/<slug>
  // - /.netlify/functions/share/<slug>
  const m1 = clean.match(/\/p\/([^\/]+)/i);
  if (m1 && m1[1]) return safeDecode(m1[1]);

  const m2 = clean.match(/\/share\/([^\/]+)/i);
  if (m2 && m2[1]) return safeDecode(m2[1]);

  // Fallback: last segment (e.g., when rewrite uses :splat but path keeps original)
  const parts = clean.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0].toLowerCase() === 'p') return safeDecode(parts[1]);
  return '';
}

function getSlug(event) {
  const qs = event.queryStringParameters || {};
  if (qs.slug) return safeDecode(String(qs.slug)).trim();

  // Different Netlify routing modes may expose different path fields.
  const candidates = [
    event.path,
    event.rawUrl,
    pickHeader(event.headers, 'x-original-uri'),
    pickHeader(event.headers, 'x-forwarded-uri'),
    pickHeader(event.headers, 'x-nf-original-path'),
    pickHeader(event.headers, 'referer'),
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      // If it's a full URL, parse it; else treat as a path.
      const u = c.startsWith('http://') || c.startsWith('https://')
        ? new URL(c)
        : new URL('https://example.invalid' + c);
      const slug = extractSlugFromPath(u.pathname);
      if (slug) return slug;
    } catch {
      // ignore
      const slug = extractSlugFromPath(String(c));
      if (slug) return slug;
    }
  }
  return '';
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const handler = async (event) => {
  const slug = getSlug(event);
  if (!slug) {
    return {
      statusCode: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'slug required',
    };
  }

  const qs = event.queryStringParameters || {};
  const showDates = qs.showDates != null ? String(qs.showDates) : '';

  const proto = pickHeader(event.headers, 'x-forwarded-proto') || 'https';
  const host = pickHeader(event.headers, 'host') || '';
  const origin = host ? `${proto}://${host}` : '';

  const shareUrl = origin ? `${origin}/p/${encodeURIComponent(slug)}${showDates ? `?showDates=${encodeURIComponent(showDates)}` : ''}` : '';
  const targetUrl = origin
    ? `${origin}/post.html?slug=${encodeURIComponent(slug)}${showDates ? `&showDates=${encodeURIComponent(showDates)}` : ''}`
    : `/post.html?slug=${encodeURIComponent(slug)}${showDates ? `&showDates=${encodeURIComponent(showDates)}` : ''}`;

  // Fetch record JSON (public raw file on Cloudinary)
  let record = null;
  const cloud = process.env.CLD_CLOUD_NAME || '';
  if (cloud) {
    try {
      const dataUrl = `https://res.cloudinary.com/${cloud}/raw/upload/collages/${encodeURIComponent(slug)}/data.json`;
      const resp = await fetch(dataUrl);
      if (resp.ok) record = await resp.json().catch(() => null);
    } catch {
      record = null;
    }
  }

  const title = (record && record.title) ? String(record.title) : '施工成果相簿';
  const descRaw = (record && (record.desc || record.description)) ? String(record.desc || record.description) : '點開查看施工前後對比照片、作業說明，並可下載原始照片（ZIP）。';
  const desc = descRaw.length > 160 ? descRaw.slice(0, 157) + '…' : descRaw;

  // Prefer record.preview (cover), fallback to site logo
  let image = (record && record.preview) ? String(record.preview) : '';
  if (!image && origin) image = `${origin}/logo.png`;
  if (!image) image = '/logo.png';

  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>

  <meta name="description" content="${escapeHtml(desc)}">

  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${escapeHtml(shareUrl || targetUrl)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  <meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}">
</head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; padding:24px; line-height:1.5;">
  <div>正在開啟相簿… 如果沒有自動跳轉，請點此連結：</div>
  <p><a href="${escapeHtml(targetUrl)}">${escapeHtml(targetUrl)}</a></p>
  <script>location.replace(${JSON.stringify(targetUrl)});</script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: html,
  };
};
