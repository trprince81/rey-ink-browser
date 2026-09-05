const SB=process.env.SUPABASE_URL;
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const out=(res,x,s=200)=>{res.statusCode=s;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-methods','POST,OPTIONS');res.setHeader('access-control-allow-headers','content-type');res.end(JSON.stringify(x))};
async function db(path,opt={}){return fetch(SB+'/rest/v1/'+path,{...opt,headers:{apikey:KEY,authorization:'Bearer '+KEY,'content-type':'application/json',...(opt.headers||{})}})}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;return await new Promise((resolve,reject)=>{let r='';req.on('data',c=>r+=c);req.on('end',()=>{try{resolve(r?JSON.parse(r):{})}catch(e){reject(e)}});req.on('error',reject)})}
export default async function handler(req,res){
 if(req.method==='OPTIONS')return out(res,{ok:true});
 if(req.method!=='POST')return out(res,{ok:false,error:'Método no permitido'},405);
 if(!SB||!KEY)return out(res,{ok:false,error:'Servicio no configurado'},503);
 try{
  const b=await body(req),email=String(b.email||'').trim().toLowerCase(),licenseKey=String(b.key||'').trim().toUpperCase();
  if(!/^\S+@\S+\.\S+$/.test(email)||!licenseKey)return out(res,{ok:false,error:'Correo y key son obligatorios'},400);
  const q=await db('rey_ink_licenses?client_email=eq.'+encodeURIComponent(email)+'&license_key=eq.'+encodeURIComponent(licenseKey)+'&select=id,license_key,client_name,client_email,status,starts_at,expires_at,plan_id,device_id');
  if(!q.ok)return out(res,{ok:false,error:'No se pudo validar la licencia'},500);
  const rows=await q.json();if(!rows.length)return out(res,{ok:false,error:'Correo o key incorrectos'},401);
  const lic=rows[0],now=new Date();
  if(lic.status==='revoked'||lic.status==='paused')return out(res,{ok:false,error:'La licencia está '+lic.status},403);
  if(!lic.expires_at||new Date(lic.expires_at)<=now){if(lic.status!=='expired')await db('rey_ink_licenses?id=eq.'+encodeURIComponent(lic.id),{method:'PATCH',body:JSON.stringify({status:'expired',updated_at:now.toISOString()})});return out(res,{ok:false,error:'La licencia está vencida',expires_at:lic.expires_at},403)}
  return out(res,{ok:true,authenticated:true,license:{id:lic.id,client_name:lic.client_name,client_email:lic.client_email,expires_at:lic.expires_at,plan_id:lic.plan_id,device_id:lic.device_id}});
 }catch(e){return out(res,{ok:false,error:'Error de validación'},500)}
}
