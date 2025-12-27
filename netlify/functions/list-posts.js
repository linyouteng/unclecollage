// /.netlify/functions/list-posts.js
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
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function preflight(){ return new Response(null,{status:204,headers:CORS_HEADERS}); }
function sendJSON(obj,status=200){ return new Response(JSON.stringify(obj),{status,headers:CORS_HEADERS}); }
function errorJSON(err,status=500){
  const msg=(err&&(err.message||err.error?.message))||String(err)||'Unknown error';
  try{console.error('[list-posts] error:',err);}catch{}
  return sendJSON({error:msg},status);
}

// JWT
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
function isAdmin(request){
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
async function loadIndex(){
  try{
    const res=await cloudinary.api.resource('collages/index',{resource_type:'raw'});
    const url=res?.secure_url||res?.url;
    if(!url) return {items:[]};
    const r=await fetch(url,{headers:{accept:'application/json'}});
    if(!r.ok) return {items:[]};
    const data=await r.json().catch(()=>null);
    if(!data||!Array.isArray(data.items)) return {items:[]};
    return data;
  }catch(e){
    if(e?.http_code===404) return {items:[]};
    const msg=String(e?.error?.message||e?.message||'');
    if(/not found/i.test(msg)) return {items:[]};
    throw e;
  }
}
function toDateMs(x){
  const ms=new Date(x||0).getTime();
  return Number.isFinite(ms)? ms:0;
}

export default async (request)=>{
  if(request.method==='OPTIONS') return preflight();
  if(request.method!=='GET') return sendJSON({error:'Method not allowed'},405);

  try{
    const u=new URL(request.url);
    const page=Math.max(1, parseInt(u.searchParams.get('page')||'1',10)||1);
    const pageSizeRaw=parseInt(u.searchParams.get('pageSize')||'6',10)||6;
    const pageSize=Math.min(50, Math.max(1, pageSizeRaw));
    const q=(u.searchParams.get('q')||'').trim().toLowerCase();
    const sort=(u.searchParams.get('sort')||'date_desc').trim();
    const showHidden=(u.searchParams.get('showHidden')||'')==='1';
    const allowShowHidden=!!(showHidden && isAdmin(request));

    const indexObj=await loadIndex();
    let items=Array.isArray(indexObj.items)? indexObj.items.slice():[];

    items=items.map(it=>{
      if(!it||!it.slug) return null;
      const tags=normalizeTags(it.tags);
      return {
        slug:String(it.slug),
        title:it.title||'',
        date:it.date||'',
        desc:it.desc||'',
        tags,
        preview:it.preview||null,
        visible: it.visible !== false,
        created_at: it.created_at||null,
        updated_at: it.updated_at||null,
      };
    }).filter(Boolean);

    if(!allowShowHidden) items=items.filter(it=>it.visible);

    if(q){
      items=items.filter(it=>{
        const hay=[it.title,it.slug,it.desc,(it.tags||[]).join(' ')].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    items.sort((a,b)=>{
      if(sort==='date_asc') return toDateMs(a.date||a.created_at)-toDateMs(b.date||b.created_at);
      if(sort==='title_asc') return String(a.title||'').localeCompare(String(b.title||''));
      if(sort==='title_desc') return String(b.title||'').localeCompare(String(a.title||''));
      return toDateMs(b.date||b.created_at)-toDateMs(a.date||a.created_at); // date_desc
    });

    const total=items.length;
    const totalPages=Math.max(1, Math.ceil(total/pageSize));
    const safePage=Math.min(page,totalPages);
    const start=(safePage-1)*pageSize;
    const pageItems=items.slice(start,start+pageSize);

    return sendJSON({items:pageItems,total,page:safePage,pageSize,totalPages},200);
  }catch(e){
    return errorJSON(e,500);
  }
};
