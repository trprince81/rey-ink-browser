const ALARM = "reyInkUpdateBot";
const REMOTE_API = "https://rey-ink-browser.vercel.app/api/rey-ink";
let remoteLoopRunning = false;

async function remoteApi(action, body={}, token="") {
  const headers={"content-type":"application/json"};
  if(token) headers.authorization="Bearer "+token;
  const r=await fetch(REMOTE_API,{method:"POST",headers,body:JSON.stringify({action,...body,...(token?{token}: {})})});
  const d=await r.json().catch(()=>({error:"Respuesta inválida"}));
  if(!r.ok) throw new Error(d.error||("HTTP "+r.status));
  return d;
}

async function getRemoteInstallId(){
  const s=await chrome.storage.local.get("reyInkInstallId");
  if(s.reyInkInstallId)return s.reyInkInstallId;
  const id=crypto.randomUUID?crypto.randomUUID():"rey-"+Date.now()+"-"+Math.random().toString(36).slice(2);
  await chrome.storage.local.set({reyInkInstallId:id});
  return id;
}

async function remoteRegister(){
  const {reyInkPcSlot}=await chrome.storage.local.get("reyInkPcSlot");
  const pcSlot=Number(reyInkPcSlot)||0;
  if(pcSlot<1||pcSlot>20)throw new Error("Configura el número de PC (1-20).");
  let {reyInkPcToken}=await chrome.storage.local.get("reyInkPcToken");
  if(!reyInkPcToken){reyInkPcToken=crypto.randomUUID();await chrome.storage.local.set({reyInkPcToken});}
  const d=await remoteApi("register_device",{pc_slot:pcSlot,token:reyInkPcToken,state:{installation_id:await getRemoteInstallId()}});
  await chrome.storage.local.set({
    reyInkRemote:{enabled:true,api:REMOTE_API,deviceId:d.deviceId||String(pcSlot),pcToken:reyInkPcToken,pcSlot},
    reyInkRelayStatus:{connected:true,lastConnected:Date.now(),transport:"vercel"}
  });
  startRemoteLoop();
  return d;
}

async function remoteDisconnect(){
  remoteLoopRunning=false;
  await chrome.storage.local.set({reyInkRemote:{enabled:false},reyInkRelayStatus:{connected:false,transport:"vercel"}});
}

async function remoteHeartbeat(){
  const {reyInkRemote}=await chrome.storage.local.get("reyInkRemote");
  if(!reyInkRemote?.enabled||!reyInkRemote.pcToken)return;
  try{await remoteApi("heartbeat",{pc_slot:reyInkRemote.pcSlot},reyInkRemote.pcToken);}catch{}
}

async function remoteLoop(){
  if(remoteLoopRunning)return;
  remoteLoopRunning=true;
  while(remoteLoopRunning){
    const {reyInkRemote}=await chrome.storage.local.get("reyInkRemote");
    if(!reyInkRemote?.enabled||!reyInkRemote.pcToken)break;
    try{
      const d=await remoteApi("poll_command",{pc_slot:reyInkRemote.pcSlot},reyInkRemote.pcToken);
      if(d.command){
        const c=d.command;
        const map={get_state:"GET_STATE",status:"GET_STATE",reload:"RELOAD",back:"GO_BACK",forward:"GO_FORWARD",new_tab:"NEW_TAB",start_bot:"START_BOT",stop_bot:"STOP_BOT"};
        const type=map[String(c.command||"").toLowerCase()]||c.command;
        let result;
        try{result=await chrome.runtime.sendMessage({type,...(c.payload||{}),remoteRequestId:c.id});}
        catch(e){result={ok:false,error:String(e?.message||e)}}
        try{await remoteApi("command_result",{pc_slot:reyInkRemote.pcSlot,command_id:c.id,result},reyInkRemote.pcToken);}catch{}
      }
    }catch(e){await chrome.storage.local.set({reyInkRelayStatus:{connected:false,transport:"vercel",error:String(e?.message||e)}});await new Promise(r=>setTimeout(r,3000));}
  }
  remoteLoopRunning=false;
}
function startRemoteLoop(){remoteLoop().catch(()=>{remoteLoopRunning=false});}

// Preserve the existing Rey Ink command implementation below this transport layer.
