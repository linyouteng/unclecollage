// /.netlify/functions/rebuild-index.js
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

function preflight(){ return new Response(null,{status:204,headers:CORS_HEADERS}); }
function sendJSON(obj,status=200){ return new Response(JSON.stringify(obj),{status,headers:CORS_HEADERS}); }

function decodeB64Json(str){
  const pad=str.length%4===2?'==':str.length%4===3?'=':'';
  const s=str.replace(/-/g,'+').replace(/_/g,'/')+pad;
  return JSON.parse(Buffer.from(s,'base64').toString('utf8'));
}
function verifyJWT(token, secret){
  try{
    const [h,p,s]=token.split('.');
    if(!h||!p||!s) return null;
    const data=`${h}.${p}`;
    const sig=crypto.createHmac('sha256',secret).update(data).digest('base64')
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
    if(sig!==s) return null;
    const payload=decodeB64Json(p);
    if(payload?.exp && Date.now()>=payload.exp*1000) return null;
    return payload;
  }catch{return null;}
}
function requireAdmin(request){
  const auth=request.headers.get('authorization')||'';
  const m=auth.match(/^Bearer\s+(.+)$/i);
  if(!m) return null;
  const secret=process.env.ADMIN_JWT_SECRET||'';
  if(!secret) return null;
  return verifyJWT(m[1].trim(), secret);
}

function normalizeTags(tags){
  if(Array.isArray(tags)) return tags.map(x=>String(x).trim()).filter(Boolean);
  if(typeof tags==='string') return tags.split(/[,，\s]+/).map(s=>s.trim()).filter(Boolean);
  return [];
}

async function saveIndex(items){
  const payload={version:1,updated_at:new Date().toISOString(),items:Array.isArray(items)?items:[]};
  const jsonBase64=Buffer.from(JSON.stringify(payload)).toString('base64');
  await cloudinary.uploader.upload(`data:application/json;base64,${jsonBase64}`,{
    resource_type:'raw', public_id:'collages/index', overwrite:true, format:'json'
  });
}

export default async (request)=>{
  if(request.method==='OPTIONS') return preflight();
  if(request.method!=='POST') return sendJSON({error:'Method not allowed'},405);

  const admin=requireAdmin(request);
  if(!admin) return sendJSON({error:'Unauthorized'},401);

  try{
    // 1) 搜尋所有 collages/<slug>/data(.json) raw 資源
    let cursor = null;
    const all = [];
    const expr = 'resource_type:raw AND public_id:collages/*/data*';
    let guard = 0;

    while(true){
      let q = cloudinary.search
        .expression(expr)
        .sort_by('created_at','desc')
        .max_results(500);
      if(cursor) q = q.next_cursor(cursor);

      const res = await q.execute();
      const resources = Array.isArray(res?.resources) ? res.resources : [];
      for(const r of resources){
        const pid = r.public_id || '';
        const m = pid.match(/^collages\/([^\/]+)\/data(\.json)?$/i);
        if(!m) continue;
        all.push({ slug: m[1], url: r.secure_url || r.url });
      }

      cursor = res?.next_cursor || null;
      guard++;
      if(!cursor || guard>20) break; // safety
    }

    // 2) 逐筆讀 data.json，生成 index entry
    const entries = [];
    for(const it of all){
      if(!it.url) continue;
      try{
        const resp = await fetch(it.url, { headers:{ accept:'application/json' } });
        if(!resp.ok) continue;
        const data = await resp.json().catch(()=>null);
        if(!data) continue;

        const entry = {
          slug: it.slug,
          title: data.title || '',
          date: data.date || '',
          desc: data.desc || '',
          tags: normalizeTags(data.tags),
          preview: data.preview || (Array.isArray(data.items) && data.items[0] ? data.items[0].url : null),
          visible: data.visible !== false,
          created_at: data.created_at || null,
          updated_at: data.updated_at || null,
        };
        entries.push(entry);
      }catch(_){}
    }

    // 3) 排序 + 存回 collages/index.json
    entries.sort((a,b)=> new Date(b.updated_at||b.created_at||0) - new Date(a.updated_at||a.created_at||0));
    await saveIndex(entries);

    return sendJSON({ ok:true, total: entries.length },200);
  }catch(err){
    const msg=(err&&(err.message||err.error?.message))||String(err)||'Unknown error';
    return sendJSON({ error: msg },500);
  }
};
