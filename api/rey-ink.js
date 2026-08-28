import { createClient } from 'redis';

export const runtime = 'nodejs';
let redisPromise = null;
const mem = globalThis.__reyInkDevicesV3 || (globalThis.__reyInkDevicesV3 = { devices:new Map(), commands:new Map(), results:new Map() });

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
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type, authorization'}});
const online=d=>!!d&&Date.now()-Number(d.lastSeen||0)<30000;
async function read(kind,n){const r=await redis();if(r){const v=await r.get(key(kind,n));return v?JSON.parse(v):null}return mem[kind+'s']?.get(n)||null}
async function write(kind,n,v,ttl=90){const r=await redis();if(r){await r.set(key(kind,n),JSON.stringify(v),{EX:ttl});return}mem[kind+'s']?.set(n,v)}
async function remove(kind,n){const r=await redis();if(r){await r.del(key(kind,n));return}mem[kind+'s']?.delete(n)}
async function list(){const out=[];for(let i=1;i<=20;i++){const d=await read('device',i);out.push({pc_slot:i,is_online:online(d),last_seen:d?.lastSeen||null,state:d?.state||null})}return out}

export default async function handler(req){
  if(req.method==='OPTIONS')return json({ok:true});
  const storage=process.env.REDIS_URL?'redis':'memory';
  if(req.method==='GET'){
    const url=new URL(req.url),a=url.searchParams.get('action');
    if(a==='health')return json({ok:true,service:'rey-ink',version:'3.1',storage,time:Date.now()});
    return json({ok:true,service:'rey-ink',version:'3.1',storage,devices:await list()});
  }
  if(req.method!=='POST')return json({ok:false,error:'Método no permitido'},405);
  let body;try{body=await req.json()}catch{return json({ok:false,error:'JSON inválido'},400)}
  const action=String(body.action||'');
  if(action==='health')return json({ok:true,service:'rey-ink',version:'3.1',storage,time:Date.now()});
  if(action==='list_devices')return json({ok:true,devices:await list(),storage});
  const pc_slot=Number(body.pc_slot);if(!Number.isInteger(pc_slot)||pc_slot<1||pc_slot>20)return json({ok:false,error:'PC inválida'},400);
  if(action==='register_device'||action==='heartbeat'){
    if(!body.token)return json({ok:false,error:'Token requerido'},401);
    const old=await read('device',pc_slot);const d={pc_slot,token:body.token,lastSeen:Date.now(),state:body.state||old?.state||null};await write('device',pc_slot,d,90);return json({ok:true,pc_slot,is_online:true,storage});
  }
  const device=await read('device',pc_slot);
  if(action==='get_state')return json({ok:true,pc_slot,is_online:online(device),state:device?.state||null});
  if(action==='command'){
    if(!online(device))return json({ok:false,error:'PC sin conexión'},409);
    if(body.token&&body.token!==device.token)return json({ok:false,error:'Token inválido'},401);
    const allowed=['get_state','reload','back','forward','new_tab','close_tab','start_bot','stop_bot','navigate','click','type','tab_next','tab_prev','switch_tab','start_recording','stop_recording','run_routine'];
    const command=String(body.command||'').trim().toLowerCase();if(!allowed.includes(command))return json({ok:false,error:'Comando no permitido'},400);
    const id=crypto.randomUUID();await write('command',pc_slot,{id,command,payload:body.payload||{},createdAt:Date.now()},60);return json({ok:true,command_id:id,command});
  }
  if(action==='poll_command'){
    if(!device||body.token!==device.token)return json({ok:false,error:'Token inválido'},401);
    device.lastSeen=Date.now();await write('device',pc_slot,device,90);const command=await read('command',pc_slot);if(!command)return json({ok:true,command:null});await remove('command',pc_slot);return json({ok:true,command});
  }
  if(action==='command_result'){
    if(!device||body.token!==device.token)return json({ok:false,error:'Token inválido'},401);
    device.lastSeen=Date.now();await write('device',pc_slot,device,90);await write('result',pc_slot,{...(body.result||{}),command_id:body.command_id,receivedAt:Date.now()},300);return json({ok:true});
  }
  if(action==='last_result')return json({ok:true,result:await read('result',pc_slot)});
  return json({ok:false,error:'Acción desconocida'},400);
}
