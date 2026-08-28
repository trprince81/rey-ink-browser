import { createClient } from 'redis';

export const config = { runtime: 'nodejs' };
let redisPromise = null;
const mem = globalThis.__reyInkV3 || (globalThis.__reyInkV3 = { devices:new Map(), commands:new Map(), results:new Map() });

async function redis(){
  if(!process.env.REDIS_URL) return null;
  if(!redisPromise){
    const c=createClient({url:process.env.REDIS_URL});
    c.on('error',()=>{});
    redisPromise=c.connect().then(()=>c);
  }
  return redisPromise;
}
const key=(kind,n)=>`reyink:v3:${kind}:${n}`;
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type, authorization'}});
const online=d=>!!d&&Date.now()-Number(d.lastSeen||0)<30000;
async function read(kind,n){const r=await redis();if(r){const v=await r.get(key(kind,n));return v?JSON.parse(v):null}return mem[kind+'s']?.get(n)||null}
async function write(kind,n,v,ttl=90){const r=await redis();if(r){await r.set(key(kind,n),JSON.stringify(v),{EX:ttl});return}mem[kind+'s']?.set(n,v)}
async function remove(kind,n){const r=await redis();if(r){await r.del(key(kind,n));return}mem[kind+'s']?.delete(n)}
async function devices(){const out=[];for(let i=1;i<=20;i++){const d=await read('device',i);out.push({pc_slot:i,is_online:online(d),last_seen:d?.lastSeen||null,state:d?.state||null})}return out}
export default async function handler(req){
  if(req.method==='OPTIONS')return json({ok:true});
  const storage=process.env.REDIS_URL?'redis':'memory';
  if(req.method==='GET'){
    const u=new URL(req.url), a=u.searchParams.get('action');
    if(a==='health')return json({ok:true,service:'rey-ink',version:'3.0',storage,time:Date.now()});
    return json({ok:true,service:'rey-ink',version:'3.0',storage,devices:await devices()});
  }
  if(req.method!=='POST')return json({ok:false,error:'Método no permitido'},405);
  let b;try{b=await req.json()}catch{return json({ok:false,error:'JSON inválido'},400)}
  const a=String(b.action||'');
  if(a==='health')return json({ok:true,service:'rey-ink',version:'3.0',storage,time:Date.now()});
  if(a==='list_devices')return json({ok:true,devices:await devices(),storage});
  const n=Number(b.pc_slot);if(!Number.isInteger(n)||n<1||n>20)return json({ok:false,error:'PC inválida'},400);
  if(a==='register_device'||a==='heartbeat'){
    if(!b.token)return json({ok:false,error:'Token requerido'},401);
    const old=await read('device',n);const d={pc_slot:n,token:b.token,lastSeen:Date.now(),state:b.state||old?.state||null};await write('device',n,d,90);return json({ok:true,pc_slot:n,is_online:true,storage});
  }
  const d=await read('device',n);
  if(a==='get_state')return json({ok:true,pc_slot:n,is_online:online(d),state:d?.state||null});
  if(a==='command'){
    if(!online(d))return json({ok:false,error:'PC sin conexión'},409);
    if(b.token&&b.token!==d.token)return json({ok:false,error:'Token inválido'},401);
    const allowed=['get_state','reload','back','forward','new_tab','close_tab','start_bot','stop_bot','navigate','click','type','tab_next','tab_prev','switch_tab','start_recording','stop_recording','run_routine'];
    const command=String(b.command||'').toLowerCase().trim();if(!allowed.includes(command))return json({ok:false,error:'Comando no permitido'},400);
    const id=crypto.randomUUID();await write('command',n,{id,command,payload:b.payload||{},createdAt:Date.now()},60);return json({ok:true,command_id:id});
  }
  if(a==='poll_command'){
    if(!d||b.token!==d.token)return json({ok:false,error:'Token inválido'},401);
    d.lastSeen=Date.now();await write('device',n,d,90);const c=await read('command',n);if(!c)return json({ok:true,command:null});await remove('command',n);return json({ok:true,command:c});
  }
  if(a==='command_result'){
    if(!d||b.token!==d.token)return json({ok:false,error:'Token inválido'},401);
    d.lastSeen=Date.now();await write('device',n,d,90);await write('result',n,{...b.result,command_id:b.command_id,receivedAt:Date.now()},300);return json({ok:true});
  }
  if(a==='last_result')return json({ok:true,result:await read('result',n)});
  return json({ok:false,error:'Acción desconocida'},400);
}
