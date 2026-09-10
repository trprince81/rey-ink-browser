const TARGET='https://rnduuuiskfuikzuepvnw.supabase.co/functions/v1/rey-ink-control-center-v2';
const CORS={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-rey-ink-key,accept,authorization,apikey,x-client-info','cache-control':'no-store'};
export default async function handler(req,res){
  if(req.method==='OPTIONS'){res.statusCode=204;Object.entries(CORS).forEach(([k,v])=>res.setHeader(k,v));return res.end();}
  try{
    const u=new URL(req.url,'https://rey-ink.local');
    const r=await fetch(TARGET+u.search,{method:req.method,headers:{'x-rey-ink-key':req.headers['x-rey-ink-key']||'','content-type':req.headers['content-type']||'application/json','accept':req.headers.accept||'application/json'},body:['GET','HEAD'].includes(req.method)?undefined:await new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>resolve(s||undefined));req.on('error',reject)})});
    const text=await r.text();res.statusCode=r.status;Object.entries(CORS).forEach(([k,v])=>res.setHeader(k,v));res.setHeader('content-type',r.headers.get('content-type')||'application/json; charset=utf-8');return res.end(text);
  }catch(e){res.statusCode=502;Object.entries(CORS).forEach(([k,v])=>res.setHeader(k,v));return res.end(JSON.stringify({ok:false,error:'No se pudo conectar con el servidor de Rey Ink: '+String(e?.message||e)}));}
}