import crypto from 'node:crypto';
const plans={5:['Especial',13],10:['Básico',20],35:['Pro',30],50:['Plus',50],100:['Business',70],500:['Enterprise',150],1000:['Max',350]};
const durations=[1,3,6,12];
const makeKey=(email,profiles,months,expires)=>{const payload=JSON.stringify({e:email,p:profiles,m:months,x:expires});const data=Buffer.from(payload).toString('base64url');const sig=crypto.createHash('sha256').update(`MUTANT|${data}`).digest('hex').slice(0,16).toUpperCase();return `MUT-${data}-${sig}`};
export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({ok:false,error:'Método no permitido'});
 try{
  const {email,profiles,duration_months}=req.body||{}; const e=String(email||'').trim().toLowerCase(); const p=Number(profiles); const d=Number(duration_months);
  if(!/^\S+@\S+\.\S+$/.test(e)) return res.status(400).json({ok:false,error:'Correo inválido'});
  if(!plans[p]) return res.status(400).json({ok:false,error:'Plan inválido'});
  if(!durations.includes(d)) return res.status(400).json({ok:false,error:'Duración inválida'});
  const [name,monthly]=plans[p]; const start=new Date(); const expiry=new Date(start); expiry.setMonth(expiry.getMonth()+d); const expires=expiry.toISOString();
  const key=makeKey(e,p,d,expires);
  return res.status(200).json({ok:true,program:'MUTANT',client:{email:e},license:{license_key:key,starts_at:start.toISOString(),expires_at:expires,duration_months:d,status:'active'},plan:{name,max_profiles:p,monthly_price:monthly,total_price:monthly*d}});
 }catch{return res.status(500).json({ok:false,error:'Error interno'});}
}