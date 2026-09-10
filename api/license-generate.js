const SB=process.env.SUPABASE_URL;
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const out=(res,x,s=200)=>{res.statusCode=s;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-methods','POST,OPTIONS');res.setHeader('access-control-allow-headers','content-type');res.end(JSON.stringify(x))};
async function db(path,opt={}){return fetch(SB+'/rest/v1/'+path,{...opt,headers:{apikey:KEY,authorization:'Bearer '+KEY,'content-type':'application/json',...(opt.headers||{})}})}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;return await new Promise((resolve,reject)=>{let r='';req.on('data',c=>r+=c);req.on('end',()=>{try{resolve(r?JSON.parse(r):{})}catch(e){reject(e)}});req.on('error',reject)})}
function makeKey(){const a=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();const b=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();const c=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();return `MUT-${a}-${b}-${c}`}
export default async function handler(req,res){
 if(req.method==='OPTIONS')return out(res,{ok:true});
 if(req.method!=='POST')return out(res,{ok:false,error:'Método no permitido'},405);
 if(!SB||!KEY)return out(res,{ok:false,error:'Servicio de licencias no configurado'},503);
 try{
  const b=await body(req),email=String(b.email||'').trim().toLowerCase(),planId=String(b.plan_id||'').trim();
  if(!/^\S+@\S+\.\S+$/.test(email)||!planId)return out(res,{ok:false,error:'Correo y plan son obligatorios'},400);
  const pr=await db('rey_ink_plans?id=eq.'+encodeURIComponent(planId)+'&status=eq.active&select=id,name,duration_days,max_profiles,max_devices,max_sessions');
  if(!pr.ok)return out(res,{ok:false,error:'No se pudo consultar el plan'},500);
  const plan=(await pr.json())[0];if(!plan)return out(res,{ok:false,error:'Plan no existe o está inactivo'},404);
  const cq=await db('rey_ink_clients?email=eq.'+encodeURIComponent(email)+'&select=id,name,email,status');
  if(!cq.ok)return out(res,{ok:false,error:'No se pudo comprobar el cliente'},500);
  const existing=(await cq.json())[0];let client=existing;
  if(!client){const nc=await db('rey_ink_clients',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({name:email,email,status:'active',product:'Mutant'})});if(!nc.ok)return out(res,{ok:false,error:'No se pudo crear el cliente'},500);client=(await nc.json())[0]}
  const starts=new Date();const expires=new Date(starts.getTime()+Number(plan.duration_days||30)*86400000);let licenseKey=makeKey();
  for(let i=0;i<5;i++){const chk=await db('rey_ink_licenses?license_key=eq.'+encodeURIComponent(licenseKey)+'&select=id');if(chk.ok&&!(await chk.json()).length)break;licenseKey=makeKey()}
  const lr=await db('rey_ink_licenses',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({license_key:licenseKey,plan_id:plan.id,client_id:client.id,client_name:client.name||email,client_email:email,status:'active',starts_at:starts.toISOString(),expires_at:expires.toISOString(),device_id:null,access_mode:'licensed',max_profiles:Number(plan.max_profiles),max_sessions:Number(plan.max_sessions),metadata:{product:'Mutant',program:'Mutant',role:'client'}})});
  if(!lr.ok)return out(res,{ok:false,error:'No se pudo guardar la licencia'},500);
  const license=(await lr.json())[0];
  return out(res,{ok:true,program:'Mutant',license:{id:license.id,key:license.license_key,email:license.client_email,plan_id:license.plan_id,plan_name:plan.name,max_profiles:license.max_profiles,max_sessions:license.max_sessions,status:license.status,starts_at:license.starts_at,expires_at:license.expires_at},client:{id:client.id,email:client.email}});
 }catch(e){return out(res,{ok:false,error:'Error interno al generar la licencia'},500)}
}
