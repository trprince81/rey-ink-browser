import { createClient } from 'redis';
export const runtime='nodejs';

let redisPromise=null;
const mem=globalThis.__reyInkDevicesV6||(globalThis.__reyInkDevicesV6={devices:new Map(),commands:new Map(),results:new Map()});
const key=(k,n)=>`reyink:v6:${k}:${n}`;
const json=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'}});
const online=d=>!!d&&Date.now()-Number(d.lastSeen||0)<30000;
const restReady=()=>!!(process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN);
async function rest(cmd,args=[]){
  if(!restReady())return null;
  const c=new AbortController();const timer=setTimeout(()=>c.abort(),4000);
  try{
    const r=await fetch(process.env.KV_REST_API_URL,{method:'POST',headers:{Authorization:`Bearer ${process.env.KV_REST_API_TOKEN}`,'content-type':'application/json'},body:JSON.stringify([cmd,...args]),cache:'no-store',signal:c.signal});
    if(!r.ok)throw new Error(`KV HTTP ${r.status}`);
    const d=await r.json();return d.result;
  }finally{clearTimeout(timer)}
}
async function redis(){
  if(!process.env.REDIS_URL||restReady())return null;
  if(!redisPromise){
    const c=createClient({url:process.env.REDIS_URL,socket:{connectTimeout:3000}});c.on('error',()=>{});
    redisPromise=c.connect().then(()=>c).catch(()=>null);
  }
  return redisPromise;
}
function storageName(){return restReady()?'vercel-kv':process.env.REDIS_URL?'redis':'memory'}
async function read(k,n){
  if(restReady()){try{const v=await rest('GET',[key(k,n)]);return v?JSON.parse(v):null}catch{}}
  const r=await redis();if(r){try{const v=await r.get(key(k,n));return v?JSON.parse(v):null}catch{}}
  return mem[k+'s']?.get(n)||null;
}
async function write(k,n,v,ttl=90){
  if(restReady()){try{await rest('SET',[key(k,n),JSON.stringify(v),'EX',ttl]);return}catch{}}
  const r=await redis();if(r){try{await r.set(key(k,n),JSON.stringify(v),{EX:ttl});return}catch{}}
  mem[k+'s']?.set(n,v);
}
async function remove(k,n){
  if(restReady()){try{await rest('DEL',[key(k,n)]);return}catch{}}
  const r=await redis();if(r){try{await r.del(key(k,n));return}catch{}}
  mem[k+'s']?.delete(n);
}
async function devices(){const a=[];for(let i=1;i<=20;i++){const d=await read('device',i);a.push({pc_slot:i,is_online:online(d),last_seen:d?.lastSeen||null,state:d?.state||null})}return a;}
function header(req,name){const h=req?.headers;if(!h)return null;if(typeof h.get==='function')return h.get(name);return h[name]??h[name.toLowerCase()]??null;}
function requestUrl(req){
  try{if(req?.url instanceof URL)return req.url;return new URL(req.url);}catch{
    const host=header(req,'x-forwarded-host')||header(req,'host');
    const proto=header(req,'x-forwarded-proto')||'https';
    return new URL(req.url||'/',`${proto}://${host||'localhost'}`);
  }
}
export default async function handler(req){
  if(req.method==='OPTIONS')return json({ok:true});
  const storage=storageName();
  if(req.method==='GET'){
    const u=requestUrl(req),a=u.searchParams.get('action');
    if(a==='health')return json({ok:true,service:'rey-ink',version:'6.0',storage,time:Date.now()});
    return json({ok:true,service:'rey-ink',version:'6.0',storage,devices:await devices()});
  }
  if(req.method!=='POST')return json({ok:false,error:'Método no permitido'},405);
  let b;try{b=await req.json()}catch{return json({ok:false,error:'JSON inválido'},400)}
  const a=String(b.action||'');
  if(a==='health')return json({ok:true,service:'rey-ink',version:'6.0',storage,time:Date.now()});
  if(a==='list_devices')return json({ok:true,devices:await devices(),storage});
  const n=Number(b.pc_slot);if(!Number.isInteger(n)||n<1||n>20)return json({ok:false,error:'PC inválida'},400);
  if(a==='register_device'||a==='heartbeat'){
    const old=await read('device',n);const token=String(b.token||old?.token||crypto.randomUUID());
    const d={pc_slot:n,token,lastSeen:Date.now(),state:b.state||old?.state||null};await write('device',n,d,90);
    return json({ok:true,pc_slot:n,token,is_online:true,storage});
  }
  const d=await read('device',n);
  if(a==='get_state')return json({ok:true,pc_slot:n,is_online:online(d),state:d?.state||null,storage});
  if(a==='command'){
    if(!online(d))return json({ok:false,error:'PC sin conexión'},409);
    if(b.token&&b.token!==d.token)return json({ok:false,error:'Token inválido'},401);
    const allowed=['get_state','reload','back','forward','new_tab','close_tab','start_bot','stop_bot','navigate','click','type','tab_next','tab_prev','switch_tab','start_recording','stop_recording','run_routine'];
    const c=String(b.command||'').toLowerCase().trim();if(!allowed.includes(c))return json({ok:false,error:'Comando no permitido'},400);
    const id=crypto.randomUUID();await write('command',n,{id,command:c,payload:b.payload||{},createdAt:Date.now()},60);return json({ok:true,command_id:id,command:c});
  }
  if(a==='poll_command'){
    if(!d||b.token!==d.token)return json({ok:false,error:'Token inválido'},401);
    d.lastSeen=Date.now();await write('device',n,d,90);const c=await read('command',n);if(!c)return json({ok:true,command:null});
    await remove('command',n);return json({ok:true,command:c});
  }
  if(a==='command_result'){
    if(!d||b.token!==d.token)return json({ok:false,error:'Token inválido'},401);
    d.lastSeen=Date.now();await write('device',n,d,90);await write('result',n,{...(b.result||{}),command_id:b.command_id,receivedAt:Date.now()},300);return json({ok:true});
  }
  if(a==='last_result')return json({ok:true,result:await read('result',n)});
  return json({ok:false,error:'Acción desconocida'},400);
}
