const API_BASE='https://rey-ink-browser.vercel.app/api/device';
const POLL_MS=2000;

async function getConfig(){return chrome.storage.local.get({reyInkDeviceId:'',reyInkDeviceToken:'',enabled:false,intervalMinutes:16,waitSeconds:25});}
async function api(method,body){
  const c=await getConfig();
  if(!c.reyInkDeviceId||!c.reyInkDeviceToken) return null;
  const url=API_BASE+(method==='GET'?`?id=${encodeURIComponent(c.reyInkDeviceId)}&token=${encodeURIComponent(c.reyInkDeviceToken)}`:'');
  const r=await fetch(url,{method,headers:{'content-type':'application/json'},body:method==='GET'?undefined:JSON.stringify({...body,id:c.reyInkDeviceId,token:c.reyInkDeviceToken}),cache:'no-store'});
  const data=await r.json().catch(()=>({error:'Respuesta inválida'}));
  if(!r.ok) throw new Error(data.error||`HTTP ${r.status}`);
  return data;
}
async function reportState(){
  const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  const t=tabs[0];
  await api('POST',{command:'heartbeat',payload:{url:t?.url||'',title:t?.title||''}}).catch(()=>{});
}
async function poll(){
  const data=await api('GET').catch(()=>null); if(!data)return;
  const c=await getConfig();
  if(data.device?.updater_running!==c.enabled){await chrome.storage.local.set({enabled:!!data.device.updater_running});}
  if(data.command){
    if(data.command.type==='start') await chrome.storage.local.set({enabled:true});
    if(data.command.type==='stop') await chrome.storage.local.set({enabled:false});
    const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if(tabs[0]?.id && /^https?:/i.test(tabs[0].url||'')){
      chrome.tabs.sendMessage(tabs[0].id,{type:'REY_INK_REMOTE_COMMAND',command:data.command}).catch(()=>{});
    }
  }
}
chrome.runtime.onInstalled.addListener(()=>chrome.alarms.create('rey-ink-poll',{periodInMinutes:0.05}));
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='rey-ink-poll')poll();});
setInterval(()=>poll(),POLL_MS);
chrome.runtime.onStartup.addListener(()=>{chrome.alarms.create('rey-ink-poll',{periodInMinutes:0.05});poll();});
chrome.runtime.onMessage.addListener((m,s,send)=>{(async()=>{if(m.type==='REY_INK_CONFIG'){await chrome.storage.local.set({reyInkDeviceId:String(m.deviceId||''),reyInkDeviceToken:String(m.deviceToken||'')});await poll();return{ok:true};}if(m.type==='REY_INK_HEARTBEAT'){await reportState();return{ok:true};}return{ok:false};})().then(send);return true;});
