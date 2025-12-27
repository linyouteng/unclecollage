// /.netlify/functions/create-post.js
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
function errorJSON(err,status=500){
  const msg=(err&&(err.message||err.error?.message))||String(err)||'Unknown error';
  try{console.error('[create-post] error:',err);}catch{}
  return sendJSON({error:msg},status);
}

// ---- JWT (HS256) ----
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

// ---- Index helpers (collages/index.json) ----
function normalizeTags(tags){
  if(Array.isArray(tags)) return tags.map(x=>String(x).trim()).filter(Boolean);
  if(typeof tags==='string') return tags.split(/[,，\s]+/).map(s=>s.trim()).filter(Boolean);
  return [];
}
async function loadIndex(){
  try{
    const res=await cloudinary.api.resource('collages/index',{resource_type:'raw'});
    const url=res?.secure_url||res?.url;
    if(!url) return {version:1,updated_at:null,items:[]};
    const r=await fetch(url,{headers:{accept:'application/json'}});
    if(!r.ok) return {version:1,updated_at:null,items:[]};
    const data=await r.json().catch(()=>null);
    if(!data||!Array.isArray(data.items)) return {version:1,updated_at:null,items:[]};
    return data;
  }catch(e){
    if(e?.http_code===404) return {version:1,updated_at:null,items:[]};
    const msg=String(e?.error?.message||e?.message||'');
    if(/not found/i.test(msg)) return {version:1,updated_at:null,items:[]};
    throw e;
  }
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

  let body=null;
  try{ body=await request.json(); }catch{ return sendJSON({error:'Invalid JSON body'},400); }

  const slug=String(body?.slug||'').trim();
  const items=body?.items;
  if(!slug) return sendJSON({error:'slug required'},400);
  if(!Array.isArray(items)||items.length===0) return sendJSON({error:'items required'},400);

  const indexObj=await loadIndex();
  const existing=Array.isArray(indexObj.items)? indexObj.items.find(x=>x&&x.slug===slug) : null;

  const created_at=existing?.created_at || new Date().toISOString();
  const updated_at=new Date().toISOString();

  const record={
    slug,
    title: body?.title || '',
    date: body?.date || '',
    desc: body?.desc || '',
    tags: normalizeTags(body?.tags),
    items,
    created_at,
    updated_at,
    preview: items[0]?.url || null,
    visible: typeof body?.visible==='boolean' ? body.visible : true,
  };

  try{
    // 1) 單篇 data.json
    const jsonBase64=Buffer.from(JSON.stringify(record)).toString('base64');
    await cloudinary.uploader.upload(`data:application/json;base64,${jsonBase64}`,{
      resource_type:'raw', public_id:`collages/${slug}/data`, overwrite:true, format:'json'
    });

    // 2) 更新 index.json
    const entry={
      slug, title:record.title, date:record.date, desc:record.desc, tags:record.tags,
      preview:record.preview, visible:record.visible, created_at:record.created_at, updated_at:record.updated_at
    };
    const arr=Array.isArray(indexObj.items)? indexObj.items.slice():[];
    const i=arr.findIndex(x=>x&&x.slug===slug);
    if(i>=0) arr[i]=entry; else arr.push(entry);
    arr.sort((a,b)=> new Date(b.updated_at||b.created_at||0) - new Date(a.updated_at||a.created_at||0));
    await saveIndex(arr);

    return sendJSON({ok:true,slug},200);
  }catch(err){
    return errorJSON(err,500);
  }
};
