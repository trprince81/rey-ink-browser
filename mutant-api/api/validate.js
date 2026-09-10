import crypto from 'node:crypto';
const plans={5:'Especial',10:'Básico',35:'Pro',50:'Plus',100:'Business',500:'Enterprise',1000:'Max'};
function check(email,profiles,months,expires,key){
 const payload=`${email}|${profiles}|${months}|${expires}`;
 const sig=crypto.createHash('sha256').update(`MUTANT|${payload}`).digest('hex').slice(0,24).toUpperCase();
 const id=crypto.createHash('sha256').update(payload).digest('hex').slice(0,8).toUpperCase();
 return key===`MUT-${id}-${sig.slice(0,8)}-${sig.slice(8,16)}-${sig.slice(16,24)}`;
}
export default function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({ok:false,error:'Método no permitido'});
 try{
  const {email,license_key}=req.body||{}; const e=String(email||'').trim().toLowerCase(); const key=String(license_key||'').trim().toUpperCase();
  const m=key.match(/^MUT-([0-9A-F]{8})-([0-9A-F]{8})-([0-9A-F]{8})-([0-9A-F]{8})$/);
  if(!/^\S+@\S+\.\S+$/.test(e)||!m) return res.status(400).json({ok:false,valid:false,error:'Correo o licencia inválidos'});
  return res.status(200).json({ok:true,valid:false,error:'Esta licencia debe validarse contra el registro del generador.'});
 }catch{return res.status(500).json({ok:false,valid:false,error:'Error interno'});}
}