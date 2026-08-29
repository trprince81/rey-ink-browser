export const runtime='nodejs';

const mem=globalThis.__reyInkDevicesV8||(globalThis.__reyInkDevicesV8={devices:new Map(),commands:new Map(),results:new Map()});
const key=(kind,slot)=>`reyink:v8:${kind}:${slot}`;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type'};
const online=d=>!!d&&Date.now()-Number(d.lastSeen||0)<30000;
function send(res,body,status=200){if(res.headersSent)return;res.statusCode=status;for(const[k,v]of Object.entries(headers))res.setHeader(k,v);res.end(JSON.stringify(body))}
function urlOf(req){const raw=String(req?.url||'/');try{return new URL(raw,'https://rey-ink-browser.vercel.app')}catch{return new URL('https://rey-ink-browser.vercel.app/api/rey-ink')}}
async function bodyOf(req){if(req?.body&&typeof req.body==='object')return req.body;let raw='';for await(const c of req)raw+=c;if(!raw)return{};try{return JSON.parse(raw)}catch{throw Error('JSON inválido')}}
function storageName(){return process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN?'vercel-kv':'memory'}
async function kv(command,args=[]){const u=process.env.KV_REST_API_URL,tok=process.env.KV_REST_API_TOKEN;if(!u||!tok)return null;const c=new AbortController(),tm=setTimeout(()=>c.abort(),1200);try{const r=await fetch(u,{method:'POST',headers:{Authorization:`Bearer ${tok}`,'content-type':'application/json'},body:JSON.stringify([command,...args]),cache:'no-store',signal:c.signal});if(!r.ok)return null;const d=await r.json();return d?.result??null}catch{return null}finally{clearTimeout(tm)}}
async function read(kind,slot){const v=await kv('GET',[key(kind,slot)]);if(v!==null&&v!==undefined){try{return JSON.parse(v)}catch{return null}}return mem[`${kind}s`].get(Number(slot))||null}
async function write(kind,slot,value,ttl=90){const v=await kv('SET',[key(kind,slot),JSON.stringify(value),'EX',ttl]);if(v===null)mem[`${kind}s`].set(Number(slot),value)}
async function remove(kind,slot){const v=await kv('DEL',[key(kind,slot)]);if(v===null)mem[`${kind}s`].delete(Number(slot))}
async function devices(){const out=[];for(let i=1;i<=20;i++){const d=await read('device',i);out.push({pc_slot:i,is_online:online(d),last_seen:d?.lastSeen||null,state:d?.state||null})}return out}
export default async function handler(req,res){try{
if(req.method==='OPTIONS')return send(res,{ok:true,service:'rey-ink'});
const u=urlOf(req),action=String(u.searchParams.get('action')||'').trim();
if(req.method==='GET'){if(action==='health'||!action)return send(res,{ok:true,service:'rey-ink',version:'9.0',storage:storageName(),time:Date.now()});if(action==='list_devices')return send(res,{ok:true,devices:await devices(),storage:storageName()});if(action==='last_result'){const n=Number(u.searchParams.get('pc_slot'));if(!Number.isInteger(n)||n<1||n>20)return send(res,{ok:false,error:'PC inválida'},400);return send(res,{ok:true,result:await read('result',n),storage:storageName()})}return send(res,{ok:false,error:'Acción GET desconocida'},400)}
if(req.method!=='POST')return send(res,{ok:false,error:'Método no permitido'},405);
let b;try{b=await bodyOf(req)}catch(e){return send(res,{ok:false,error:String(e.message||e)},400)}
const a=String(b?.action||'').trim();if(a==='health')return send(res,{ok:true,service:'rey-ink',version:'9.0',storage:storageName(),time:Date.now()});if(a==='list_devices')return send(res,{ok:true,devices:await devices(),storage:storageName()});
const n=Number(b?.pc_slot);if(!Number.isInteger(n)||n<1||n>20)return send(res,{ok:false,error:'PC inválida'},400);
if(a==='register_device'||a==='heartbeat'){const old=await read('device',n),token=String(b?.token||old?.token||crypto.randomUUID()),d={pc_slot:n,token,lastSeen:Date.now(),state:b?.state||old?.state||null};await write('device',n,d,90);return send(res,{ok:true,pc_slot:n,token,is_online:true,storage:storageName()})}
const d=await read('device',n);if(a==='get_state')return send(res,{ok:true,pc_slot:n,is_online:online(d),state:d?.state||null,storage:storageName()});
if(a==='command'){if(!online(d))return send(res,{ok:false,error:'PC sin conexión'},409);if(b?.token&&b.token!==d.token)return send(res,{ok:false,error:'Token inválido'},401);const allowed=['get_state','reload','back','forward','new_tab','close_tab','navigate','click','double_click','right_click','type','scroll','drag','key','start_screen','stop_screen','autoclick_start','autoclick_stop'];const cmd=String(b?.command||'').toLowerCase().trim();if(!allowed.includes(cmd))return send(res,{ok:false,error:'Comando no permitido'},400);const id=crypto.randomUUID();await write('command',n,{id,command:cmd,payload:b?.payload||{},createdAt:Date.now()},60);return send(res,{ok:true,command_id:id,command:cmd})}
if(a==='poll_command'){if(!d||b?.token!==d.token)return send(res,{ok:false,error:'Token inválido'},401);d.lastSeen=Date.now();await write('device',n,d,90);const cmd=await read('command',n);if(!cmd)return send(res,{ok:true,command:null});await remove('command',n);return send(res,{ok:true,command:cmd})}
if(a==='command_result'){if(!d||b?.token!==d.token)return send(res,{ok:false,error:'Token inválido'},401);d.lastSeen=Date.now();await write('device',n,d,90);await write('result',n,{...(b?.result||{}),command_id:b?.command_id,receivedAt:Date.now()},300);return send(res,{ok:true})}
return send(res,{ok:false,error:'Acción desconocida'},400)
}catch(e){return send(res,{ok:false,error:String(e?.message||e)},500)}}
