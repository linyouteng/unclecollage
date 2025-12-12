// /.netlify/functions/share.js
// 目的：提供「可被 LINE / iMessage 抓到的 OG 預覽」的分享頁（每個案件都有自己的標題/說明/封面）
// 連結格式：/p/<slug>?showDates=1

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function compactText(str = '') {
  return String(str).replace(/\s+/g, ' ').trim();
}

function truncate(str = '', max = 120) {
  const s = compactText(str);
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export default async (request) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(request.url);

  // slug 來源：優先吃 query (?slug=xxx)，否則從路徑 /share/<slug> 解析
  // （Netlify redirects 不支援把 :splat 注入 query string，所以要走 path 參數）
  const slugFromQuery = url.searchParams.get('slug');
  let slug = slugFromQuery ? String(slugFromQuery) : '';
  const showDates = url.searchParams.get('showDates') === '1';

  if (!slug) {
    const m = url.pathname.match(/\/\.netlify\/functions\/share\/([^\/?#]+)/);
    if (m && m[1]) slug = decodeURIComponent(m[1]);
  }

  if (!slug) {
    return new Response('slug required', { status: 400 });
  }

  // 推導網站 basePath（若你把網站放在子路徑，仍能正常組 URL）
  // 例：/sub/.netlify/functions/share -> basePath=/sub
  const fnPath = url.pathname;
  const basePath = fnPath.replace(/\/\.netlify\/functions\/share(?:\/.*)?$/, '');
  const origin = `${url.protocol}//${url.host}`;

  const cloud = process.env.CLD_CLOUD_NAME;
  const dataUrl = cloud
    ? `https://res.cloudinary.com/${cloud}/raw/upload/collages/${encodeURIComponent(slug)}/data.json`
    : '';

  let data = null;
  try {
    if (dataUrl) {
      const resp = await fetch(dataUrl);
      if (resp.ok) data = await resp.json().catch(() => null);
    }
  } catch {
    data = null;
  }

  const siteName = '案例分享';
  const pageTitle = data?.title ? `${data.title}｜${siteName}` : `成果相簿｜${siteName}`;
  const descRaw = data?.desc || data?.description || '查看成果照片與作業說明，可下載原始照片（ZIP）。';
  const pageDesc = truncate(descRaw, 130);

  const preview = data?.preview || (Array.isArray(data?.items) && data.items[0] ? data.items[0].url : '');
  const defaultImage = `${origin}${basePath}/logo.png`;
  const imageUrl = preview && /^https?:\/\//i.test(preview) ? preview : defaultImage;

  const shareUrl = `${origin}${basePath}/p/${encodeURIComponent(slug)}${showDates ? '?showDates=1' : ''}`;
  const postUrl = `${origin}${basePath}/post.html?slug=${encodeURIComponent(slug)}${showDates ? '&showDates=1' : ''}`;

  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>

  <meta name="description" content="${escapeHtml(pageDesc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(siteName)}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(pageDesc)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:url" content="${escapeHtml(shareUrl)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(pageDesc)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />

  <!-- 給真人使用者快速跳轉；預覽抓取通常只看 OG，不會等跳轉 -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(postUrl)}" />
</head>
<body style="font-family: system-ui, -apple-system, 'Noto Sans TC', 'Segoe UI', Arial, sans-serif; padding: 20px; color: #111;">
  <p style="margin:0 0 8px 0;">正在開啟相簿…</p>
  <p style="margin:0; font-size: 14px;">
    若未自動跳轉，請點這裡：
    <a href="${escapeHtml(postUrl)}" style="color:#2563eb;">開啟成果相簿</a>
  </p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // 避免各平台快取太久，方便你更新描述後能較快刷新
      'cache-control': 'public, max-age=300',
    },
  });
};
