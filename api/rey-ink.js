export const runtime = 'nodejs';

const mem = globalThis.__reyInkDevicesV7 || (globalThis.__reyInkDevicesV7 = {
  devices: new Map(), commands: new Map(), results: new Map()
});

const key = (kind, slot) => `reyink:v7:${kind}:${slot}`;
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};
const online = d => !!d && Date.now() - Number(d.lastSeen || 0) < 30000;
function send(res, body, status = 200) { if (res.headersSent) return; res.statusCode=status; for(const [k,v] of Object.entries(headers)) res.setHeader(k,v); res.end(JSON.stringify(body)); }
function getAction(req){try{return new URL(String(req?.url||'/'),'https://rey-ink-browser.vercel.app').searchParams.get('action')||''}catch{return ''}}
async function readBody(req){if(req?.body&&typeof req.body==='object')return req.body;let raw='';for await(const chunk of req)raw+=chunk;if(!raw)return {};return JSON.parse(raw)}
function storageName(){return process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN?'vercel-kv':'memory'}
async function kv(command,args=[]){const url=process.env.KV_REST_API_URL,token=process.env.KV_REST_API_TOKEN;if(!url||!token)return null;const c=new AbortController(),t=setTimeout(()=>c.abort(),1500);try{const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify([command,...args]),cache:'no-store',signal:c.signal});if(!r.ok)return null;const d=await r.json();return d?.result??null}catch{return null}finally{clearTimeout(t)}}
async function read(kind,slot){const v=await kv('GET',[key(kind,slot)]);if(v!==null&&v!==undefined){try{return JSON.parse(v)}catch{return null}}return mem[`${kind}s`]?.get(Number(slot))||null}
async function write(kind,slot,value,ttl=90){const saved=await kv('SET',[key(kind,slot),JSON.stringify(value),'EX',ttl]);if(saved!==null||(process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN))return;mem[`${kind}s`]?.set(Number(slot),value)}
async function remove(kind,slot){const result=await kv('DEL',[key(kind,slot)]);if(result!==null||(process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN))return;mem[`${kind}s`]?.delete(Number(slot))}
async function devices(){const out=[];for(let i=1;i<=20;i++){const d=await read('device',i);out.push({pc_slot:i,is_online:online(d),last_seen:d?.lastSeen||null,state:d?.state||null})}return out}
export default async function handler(req,res){try{
if(req.method==='OPTIONS')return send(res,{ok:true,service:'rey-ink'});
if(req.method==='GET'){const action=getAction(req);if(action==='health'||!action)return send(res,{ok:true,service:'rey-ink',version:'8.2',storage:storageName(),time:Date.now()});if(action==='list_devices')return send(res,{ok:true,devices:await devices(),storage:storageName()});if(action==='last_result'){const n=Number(new URL(String(req.url||'/'),'https://rey-ink-browser.vercel.app').searchParams.get('pc_slot'));if(!Number.isInteger(n)||n<1||n>20)return send(res,{ok:false,error:'PC inválida'},400);return send(res,{ok:true,result:await read('result',n),storage:storageName()})}return send(res,{ok:false,error:'Acción GET desconocida'},400)}
if(req.method!=='POST')return send(res,{ok:false,error:'Método no permitido'},405);let body;try{body=await readBody(req)}catch{return send(res,{ok:false,error:'JSON inválido'},400)}
const action=String(body?.action||'').trim();if(action==='health')return send(res,{ok:true,service:'rey-ink',version:'8.2',storage:storageName(),time:Date.now()});if(action==='list_devices')return send(res,{ok:true,devices:await devices(),storage:storageName()});
const n=Number(body?.pc_slot);if(!Number.isInteger(n)||n<1||n>20)return send(res,{ok:false,error:'PC inválida'},400);
if(action==='register_device'||action==='heartbeat'){const old=await read('device',n),token=String(body?.token||old?.token||crypto.randomUUID()),device={pc_slot:n,token,lastSeen:Date.now(),state:body?.state||old?.state||null};await write('device',n,device,90);return send(res,{ok:true,pc_slot:n,token,is_online:true,storage:storageName()})}
const device=await read('device',n);
if(action==='get_state')return send(res,{ok:true,pc_slot:n,is_online:online(device),state:device?.state||null,storage:storageName()});
if(action==='command'){if(!online(device))return send(res,{ok:false,error:'PC sin conexión'},409);if(body?.token&&body.token!==device.token)return send(res,{ok:false,error:'Token inválido'},401);const allowed=['get_state','reload','back','forward','new_tab','close_tab','start_bot','stop_bot','navigate','click','type','scroll','drag','key','tab_next','tab_prev','switch_tab','start_recording','stop_recording','run_routine','start_screen','stop_screen'];const command=String(body?.command||'').toLowerCase().trim();if(!allowed.includes(command))return send(res,{ok:false,error:'Comando no permitido'},400);const id=crypto.randomUUID();await write('command',n,{id,command,payload:body?.payload||{},createdAt:Date.now()},60);return send(res,{ok:true,command_id:id,command})}
if(action==='poll_command'){if(!device||body?.token!==device.token)return send(res,{ok:false,error:'Token inválido'},401);device.lastSeen=Date.now();await write('device',n,device,90);const command=await read('command',n);if(!command)return send(res,{ok:true,command:null});await remove('command',n);return send(res,{ok:true,command})}
if(action==='command_result'){if(!device||body?.token!==device.token)return send(res,{ok:false,error:'Token inválido'},401);device.lastSeen=Date.now();await write('device',n,device,90);await write('result',n,{...(body?.result||{}),command_id:body?.command_id,receivedAt:Date.now()},300);return send(res,{ok:true})}
return send(res,{ok:false,error:'Acción desconocida'},400)
}catch(error){return send(res,{ok:false,error:String(error?.message||error)},500)}}
