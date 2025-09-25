import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLD_CLOUD_NAME,
  api_key: process.env.CLD_API_KEY,
  api_secret: process.env.CLD_API_SECRET,
});

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' } });
}

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, {status:204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' }});
  if (request.method === 'OPTIONS') return json({}, 204);
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'invalid json body' }, 400);
    const { title = '', date = null, tags = '', slug, items = [] } = body;
    if (!slug) return json({ error: 'slug required' }, 400);
    if (!Array.isArray(items) || items.length === 0) return json({ error: 'items required' }, 400);
    const record = { slug, title, date, tags, items, created_at: new Date().toISOString() };
    const jsonBase64 = Buffer.from(JSON.stringify(record)).toString('base64');
    await cloudinary.uploader.upload(`data:application/json;base64,${jsonBase64}`, {
      resource_type: 'raw',
      public_id: `collages/${slug}/data`,
      overwrite: true,
      format: 'json',
    });
    return json({ ok: true, slug });
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
}
