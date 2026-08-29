const RELAY='https://rnduuuiskfuikzuepvnw.supabase.co/functions/v1/rey-ink-webrtc';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type, authorization, apikey'};
function send(res,body,status=200){res.statusCode=status;for(const[k,v]of Object.entries(headers))res.setHeader(k,v);res.end(JSON.stringify(body))}
export default async function handler(req,res){
  if(req.method==='OPTIONS')return send(res,{ok:true});
  try{
    if(req.method==='GET'){
      const u=new URL(req.url,'https://rey-ink-browser.vercel.app');
      const r=await fetch(RELAY+u.search,{cache:'no-store'});
      const text=await r.text();
      res.statusCode=r.status;for(const[k,v]of Object.entries(headers))res.setHeader(k,v);return res.end(text);
    }
    const body=req.body&&typeof req.body==='object'?req.body:await new Promise((resolve,reject)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch(e){reject(e)}});req.on('error',reject)});
    const r=await fetch(RELAY,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
    const text=await r.text();res.statusCode=r.status;for(const[k,v]of Object.entries(headers))res.setHeader(k,v);return res.end(text);
  }catch(e){return send(res,{ok:false,error:String(e?.message||e)},500)}
}
