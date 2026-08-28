// Rey Ink Browser transport API for Vercel.
// The extension registers one PC slot and polls for commands.
// NOTE: Vercel Functions are stateless across instances. A durable shared store
// must be attached for production multi-device state. No Supabase is used.
const devices = globalThis.__reyInkDevices || (globalThis.__reyInkDevices = new Map());
const commands = globalThis.__reyInkCommands || (globalThis.__reyInkCommands = new Map());
const results = globalThis.__reyInkResults || (globalThis.__reyInkResults = new Map());
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type, authorization'}});
const online=d=>!!d&&Date.now()-d.lastSeen<30000;
const tokenOK=(d,b)=>!!d&&!!b.token&&b.token===d.token;
function list(){return Array.from({length:20},(_,i)=>{const pc_slot=i+1,d=devices.get(pc_slot);return{pc_slot,is_online:online(d),last_seen:d?.lastSeen||null,state:d?.state||null}})}
export default async function handler(req){
  if(req.method==='OPTIONS')return json({ok:true});
  if(req.method==='GET'){
    const url=new URL(req.url);
    if(url.searchParams.get('action')==='health')return json({ok:true,service:'rey-ink',version:'2.4',time:Date.now()});
    if(url.searchParams.get('action')==='list_devices')return json({ok:true,devices:list()});
    return json({ok:true,service:'rey-ink',version:'2.4',devices:list()});
  }
  if(req.method!=='POST')return json({ok:false,error:'Método no permitido'},405);
  let body;try{body=await req.json()}catch{return json({ok:false,error:'JSON inválido'},400)}
  const action=String(body.action||'');
  if(action==='health')return json({ok:true,service:'rey-ink',version:'2.4',time:Date.now()});
  if(action==='list_devices')return json({ok:true,devices:list()});
  const pc_slot=Number(body.pc_slot);
  if(!Number.isInteger(pc_slot)||pc_slot<1||pc_slot>20)return json({ok:false,error:'PC inválida'},400);
  if(action==='register_device'||action==='heartbeat'){
    if(!body.token)return json({ok:false,error:'Token requerido'},401);
    const previous=devices.get(pc_slot);devices.set(pc_slot,{pc_slot,token:body.token,lastSeen:Date.now(),state:body.state||previous?.state||null});
    return json({ok:true,pc_slot,is_online:true});
  }
  const device=devices.get(pc_slot);
  if(action==='get_state')return json({ok:true,pc_slot,is_online:online(device),state:device?.state||null});
  if(action==='command'){
    if(!online(device))return json({ok:false,error:'PC sin conexión'},409);
    if(body.token&&!tokenOK(device,body))return json({ok:false,error:'Token inválido'},401);
    const allowed=['get_state','reload','back','forward','new_tab','close_tab','start_bot','stop_bot','navigate','click','type','tab_next','tab_prev','switch_tab','start_recording','stop_recording','run_routine'];
    const command=String(body.command||'').trim().toLowerCase();if(!allowed.includes(command))return json({ok:false,error:'Comando no permitido'},400);
    const commandId=crypto.randomUUID();commands.set(pc_slot,{id:commandId,command,payload:body.payload||{},createdAt:Date.now()});return json({ok:true,command_id:commandId,command});
  }
  if(action==='poll_command'){
    if(!tokenOK(device,body))return json({ok:false,error:'Token inválido'},401);device.lastSeen=Date.now();const command=commands.get(pc_slot);if(!command)return json({ok:true,command:null});commands.delete(pc_slot);return json({ok:true,command});
  }
  if(action==='command_result'){
    if(!tokenOK(device,body))return json({ok:false,error:'Token inválido'},401);device.lastSeen=Date.now();results.set(pc_slot,{...body.result,command_id:body.command_id,receivedAt:Date.now()});return json({ok:true});
  }
  if(action==='last_result')return json({ok:true,result:results.get(pc_slot)||null});
  return json({ok:false,error:'Acción desconocida'},400);
}
