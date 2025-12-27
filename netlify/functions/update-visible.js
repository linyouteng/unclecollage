// /.netlify/functions/update-visible.js
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
  const newVisible=(typeof body?.visible==='boolean') ? body.visible : null;
  if(!slug) return sendJSON({error:'slug required'},400);
  if(newVisible===null) return sendJSON({error:'visible required (boolean)'},400);

  try{
    // 讀 canonical data
    const folderPrefix=`collages/${slug}/`;
    const search=await cloudinary.search.expression(`resource_type:raw AND public_id:${folderPrefix}*`)
      .sort_by('created_at','desc').max_results(50).execute();
    const raws=Array.isArray(search?.resources)? search.resources: [];
    const chosen=raws.find(r=>/\/data(\.json)?$/i.test(r.public_id)) || raws[0];
    if(!chosen) return sendJSON({error:'data.json not found'},404);

    const canonicalPid=chosen.public_id.replace(/\.json$/i,'');
    const getUrl=chosen.secure_url||chosen.url;
    if(!getUrl) return sendJSON({error:'no url for data.json'},500);

    const resp=await fetch(getUrl);
    if(!resp.ok) return sendJSON({error:'cannot fetch current data.json'},500);
    const data=await resp.json().catch(()=>null);
    if(!data) return sendJSON({error:'bad data.json format'},500);

    data.visible=newVisible;
    data.updated_at=new Date().toISOString();

    const jsonBase64=Buffer.from(JSON.stringify(data)).toString('base64');
    await cloudinary.uploader.upload(`data:application/json;base64,${jsonBase64}`,{
      resource_type:'raw', public_id:canonicalPid, overwrite:true, format:'json'
    });

    // 同步 index
    const indexObj=await loadIndex();
    const arr=Array.isArray(indexObj.items)? indexObj.items.slice():[];
    const i=arr.findIndex(x=>x&&x.slug===slug);
    if(i>=0){
      arr[i]={...arr[i], visible:newVisible, updated_at:data.updated_at};
      arr.sort((a,b)=> new Date(b.updated_at||b.created_at||0) - new Date(a.updated_at||a.created_at||0));
      await saveIndex(arr);
    }

    return sendJSON({ok:true,slug,visible:newVisible},200);
  }catch(err){
    const msg=(err&&(err.message||err.error?.message))||String(err)||'Unknown error';
    return sendJSON({error:msg},500);
  }
};
