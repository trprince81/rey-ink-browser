const SB=process.env.SUPABASE_URL;
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN=process.env.REY_INK_ADMIN_KEY;
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-admin-key'};
const out=(res,x,s=200)=>{res.statusCode=s;for(const[k,v]of Object.entries(headers))res.setHeader(k,v);res.end(JSON.stringify(x))};
async function db(path,opt={}){return fetch(SB+'/rest/v1/'+path,{...opt,headers:{apikey:KEY,authorization:'Bearer '+KEY,'content-type':'application/json',...(opt.headers||{})}})}
async function sha(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function token(){return crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')}
export default async function handler(req,res){
 if(req.method==='OPTIONS')return out(res,{ok:true});
 if(!ADMIN)return out(res,{ok:false,error:'Falta configurar REY_INK_ADMIN_KEY en Vercel'},503);
 if(req.headers['x-admin-key']!==ADMIN)return out(res,{ok:false,error:'No autorizado'},401);
 try{
  if(req.method==='GET'){
   const a=new URL(req.url,'https://rey-ink.local').searchParams.get('action')||'overview';
   if(a==='overview'){
    const [d,l,p]=await Promise.all([
      db('rey_ink_control_devices?select=*&order=device_code.asc'),
      db('rey_ink_licenses?select=id,license_key,client_name,status,starts_at,expires_at,device_id,plan_id,created_at&order=created_at.desc'),
      db('rey_ink_plans?select=*&order=duration_days.asc')
    ]);
    return out(res,{ok:true,devices:d.ok?await d.json():[],licenses:l.ok?await l.json():[],plans:p.ok?await p.json():[]});
   }
   return out(res,{ok:false,error:'Acción desconocida'},400);
  }
  if(req.method!=='POST')return out(res,{ok:false,error:'Método no permitido'},405);
  const b=req.body&&typeof req.body==='object'?req.body:await new Promise((resolve,reject)=>{let r='';req.on('data',c=>r+=c);req.on('end',()=>{try{resolve(r?JSON.parse(r):{})}catch(e){reject(e)}});req.on('error',reject)});
  const a=String(b.action||'');
  if(a==='create_license'){
   const client_name=String(b.client_name||'').trim(),plan_id=String(b.plan_id||'').trim();if(!client_name||!plan_id)return out(res,{ok:false,error:'Cliente y plan son obligatorios'},400);
   const pr=await db('rey_ink_plans?id=eq.'+encodeURIComponent(plan_id)+'&select=*'),plan=pr.ok?(await pr.json())[0]:null;if(!plan)return out(res,{ok:false,error:'Plan no existe'},404);
   const key='RI-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase(),starts=new Date(),expires=new Date(starts.getTime()+Number(plan.duration_days)*86400000);
   const r=await db('rey_ink_licenses',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({license_key:key,plan_id,client_name,status:'active',starts_at:starts.toISOString(),expires_at:expires.toISOString()})});if(!r.ok)return out(res,{ok:false,error:await r.text()},500);return out(res,{ok:true,license:(await r.json())[0]});
  }
  if(a==='assign_device'){
   const license_id=String(b.license_id||''),device_id=String(b.device_id||'');if(!license_id||!device_id)return out(res,{ok:false,error:'Licencia y PC son obligatorias'},400);
   const r=await db('rey_ink_licenses?id=eq.'+encodeURIComponent(license_id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({device_id,updated_at:new Date().toISOString()})});if(!r.ok)return out(res,{ok:false,error:await r.text()},500);return out(res,{ok:true,license:(await r.json())[0]});
  }
  if(a==='create_link'){
   const device_id=String(b.device_id||''),label=String(b.label||'Cliente');if(!device_id)return out(res,{ok:false,error:'PC obligatoria'},400);
   const raw=token(),hash=await sha(raw),r=await db('rey_ink_control_links',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({device_id,token_hash:hash,label})});if(!r.ok)return out(res,{ok:false,error:await r.text()},500);
   const base=String(b.base_url||'').replace(/\/$/,'');return out(res,{ok:true,link:base+'/device.html?d='+encodeURIComponent(device_id)+'&token='+encodeURIComponent(raw)});
  }
  if(a==='set_license_status'){
   const id=String(b.id||''),status=String(b.status||'');if(!id||!['active','paused','expired','revoked'].includes(status))return out(res,{ok:false,error:'Datos inválidos'},400);const r=await db('rey_ink_licenses?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status,updated_at:new Date().toISOString()})});return out(res,{ok:r.ok,license:r.ok?(await r.json())[0]:null});
  }
  return out(res,{ok:false,error:'Acción desconocida'},400);
 }catch(e){return out(res,{ok:false,error:String(e?.message||e)},500)}
}
