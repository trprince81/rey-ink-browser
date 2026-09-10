const SB='https://rnduuuiskfuikzuepvnw.supabase.co/functions/v1/mutant-license-api/plans';
const out=(res,x,s=200)=>res.status(s).json(x);
export default async function handler(req,res){res.setHeader('cache-control','no-store');res.setHeader('access-control-allow-origin','*');if(req.method!=='GET')return out(res,{ok:false,error:'Método no permitido'},405);try{const r=await fetch(SB,{cache:'no-store'}),j=await r.json();return out(res,j,r.status)}catch(e){return out(res,{ok:false,error:'Error al cargar planes'},500)}}
