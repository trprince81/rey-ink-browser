const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN = process.env.REY_INK_ADMIN_KEY;
const headers = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-admin-key'};
const out=(res,x,s=200)=>{res.statusCode=s;for(const[k,v]of Object.entries(headers))res.setHeader(k,v);res.end(JSON.stringify(x))};
async function db(path,opt={}){return fetch(SB+'/rest/v1/'+path,{...opt,headers:{apikey:KEY,authorization:'Bearer '+KEY,'content-type':'application/json',...(opt.headers||{})}})}
function key(){return 'MUT-'+crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()+'-'+crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()+'-'+crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;return await new Promise((resolve,reject)=>{let r='';req.on('data',c=>r+=c);req.on('end',()=>{try{resolve(r?JSON.parse(r):{})}catch(e){reject(e)}});req.on('error',reject)})}
export default async function handler(req,res){
 if(req.method==='OPTIONS')return out(res,{ok:true});
 if(!SB||!KEY||!ADMIN)return out(res,{ok:false,error:'Faltan variables de entorno de licencia'},503);
 if(req.headers['x-admin-key']!==ADMIN)return out(res,{ok:false,error:'No autorizado'},401);
 try{
  if(req.method==='GET'){
   const q=new URL(req.url,'https://mutant.local').searchParams,limit=Math.min(Math.max(Number(q.get('limit')||100),1),100);
   const r=await db('rey_ink_licenses?select=id,license_key,client_name,client_email,status,starts_at,expires_at,device_id,plan_id,access_mode,metadata,max_profiles,max_sessions,created_at,updated_at&order=created_at.desc&limit='+limit);
   const p=await db('rey_ink_plans?select=id,name,duration_days,max_devices,max_profiles,max_sessions,status&order=duration_days.asc');
   if(!r.ok||!p.ok)return out(res,{ok:false,error:'No se pudo cargar el panel'},500);
   return out(res,{ok:true,licenses:await r.json(),plans:await p.json()});
  }
  if(req.method!=='POST')return out(res,{ok:false,error:'Método no permitido'},405);
  const b=await body(req),action=String(b.action||'');
  if(action==='create'){
   const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||email).trim(),planId=String(b.plan_id||'').trim();
   if(!/^\S+@\S+\.\S+$/.test(email)||!planId)return out(res,{ok:false,error:'Correo y plan son obligatorios'},400);
   const exists=await db('rey_ink_licenses?client_email=eq.'+encodeURIComponent(email)+'&select=id,license_key');if(!exists.ok)return out(res,{ok:false,error:'No se pudo comprobar el correo'},500);if((await exists.json()).length)return out(res,{ok:false,error:'Ese correo ya tiene una licencia'},409);
   const pr=await db('rey_ink_plans?id=eq.'+encodeURIComponent(planId)+'&select=*');if(!pr.ok)return out(res,{ok:false,error:'No se pudo consultar el plan'},500);const plan=(await pr.json())[0];if(!plan)return out(res,{ok:false,error:'Plan no existe'},404);
   const starts=new Date(),expires=new Date(starts.getTime()+Number(plan.duration_days)*86400000),license_key=key();
   const r=await db('rey_ink_licenses',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({license_key,plan_id:planId,client_name:name,client_email:email,status:'active',starts_at:starts.toISOString(),expires_at:expires.toISOString(),access_mode:'licensed',max_profiles:Number(plan.max_profiles),max_sessions:Number(plan.max_sessions),metadata:{product:'Mutant',role:'client'}})});if(!r.ok)return out(res,{ok:false,error:await r.text()},500);return out(res,{ok:true,license:(await r.json())[0]});
  }
  if(action==='renew'){
   const id=String(b.id||''),days=Math.max(1,Math.min(Number(b.days||30),3650));if(!id)return out(res,{ok:false,error:'Licencia obligatoria'},400);const q=await db('rey_ink_licenses?id=eq.'+encodeURIComponent(id)+'&select=*');if(!q.ok)return out(res,{ok:false,error:'No se pudo consultar la licencia'},500);const lic=(await q.json())[0];if(!lic)return out(res,{ok:false,error:'Licencia no encontrada'},404);const now=new Date(),base=lic.expires_at&&new Date(lic.expires_at)>now?new Date(lic.expires_at):now,expires=new Date(base.getTime()+days*86400000);const r=await db('rey_ink_licenses?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'active',expires_at:expires.toISOString(),updated_at:now.toISOString()})});if(!r.ok)return out(res,{ok:false,error:await r.text()},500);return out(res,{ok:true,license:(await r.json())[0]});
  }
  if(action==='set_limits'){
   const id=String(b.id||''),profiles=Math.max(1,Math.min(Number(b.max_profiles||1),1000000)),sessions=Math.max(1,Math.min(Number(b.max_sessions||1),100000));if(!id)return out(res,{ok:false,error:'Licencia obligatoria'},400);const r=await db('rey_ink_licenses?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({max_profiles:profiles,max_sessions:sessions,updated_at:new Date().toISOString()})});if(!r.ok)return out(res,{ok:false,error:await r.text()},500);return out(res,{ok:true,license:(await r.json())[0]});
  }
  if(action==='status'){
   const id=String(b.id||''),status=String(b.status||'');if(!id||!['active','paused','revoked'].includes(status))return out(res,{ok:false,error:'Datos inválidos'},400);const r=await db('rey_ink_licenses?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status,updated_at:new Date().toISOString()})});if(!r.ok)return out(res,{ok:false,error:await r.text()},500);return out(res,{ok:true,license:(await r.json())[0]});
  }
  return out(res,{ok:false,error:'Acción desconocida'},400);
 }catch(e){return out(res,{ok:false,error:String(e?.message||e)},500)}
}
