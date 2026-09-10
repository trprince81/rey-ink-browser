import crypto from 'node:crypto';
const plans={5:'Especial',10:'Básico',35:'Pro',50:'Plus',100:'Business',500:'Enterprise',1000:'Max'};
export default function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({ok:false,error:'Método no permitido'});
 try{
  const {email,license_key}=req.body||{}; const e=String(email||'').trim().toLowerCase(); const key=String(license_key||'').trim();
  const parts=key.match(/^MUT-([A-Za-z0-9_-]+)-([0-9A-F]{16})$/);
  if(!/^\S+@\S+\.\S+$/.test(e)||!parts) return res.status(400).json({ok:true,valid:false,error:'Correo o licencia inválidos'});
  const data=parts[1],sig=parts[2]; const expected=crypto.createHash('sha256').update(`MUTANT|${data}`).digest('hex').slice(0,16).toUpperCase();
  if(sig!==expected) return res.status(200).json({ok:true,valid:false,error:'Licencia inválida'});
  const payload=JSON.parse(Buffer.from(data,'base64url').toString('utf8')); const expires=new Date(payload.x);
  if(payload.e!==e||!plans[Number(payload.p)]||![1,3,6,12].includes(Number(payload.m))||Number.isNaN(expires.getTime())) return res.status(200).json({ok:true,valid:false,error:'Licencia inválida'});
  if(expires.getTime()<=Date.now()) return res.status(200).json({ok:true,valid:false,error:'Licencia vencida',expires_at:payload.x});
  return res.status(200).json({ok:true,valid:true,program:'MUTANT',client:{email:e},license:{license_key:key,status:'active',expires_at:payload.x,duration_months:Number(payload.m)},plan:{name:plans[Number(payload.p)],max_profiles:Number(payload.p)}});
 }catch{return res.status(200).json({ok:true,valid:false,error:'Licencia inválida'});}
}