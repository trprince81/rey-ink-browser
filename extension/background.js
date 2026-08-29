const API="https://rey-ink-browser.vercel.app/api/rey-ink";
let running=false,screenRunning=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function api(action,body={}){
  const c=new AbortController(), timer=setTimeout(()=>c.abort(),7000);
  try{
    const r=await fetch(API,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...body}),cache:"no-store",signal:c.signal});
    const d=await r.json();
    if(!r.ok||d.ok===false) throw new Error(d.error||`HTTP ${r.status}`);
    return d;
  }finally{clearTimeout(timer)}
}
async function cfg(){return (await chrome.storage.local.get("reyInkRemote")).reyInkRemote||null}
async function setControlled(id){await chrome.storage.local.set({reyInkControlledTabId:Number(id)})}
async function getTab(){
  const saved=await chrome.storage.local.get("reyInkControlledTabId");
  if(saved.reyInkControlledTabId){try{const t=await chrome.tabs.get(Number(saved.reyInkControlledTabId));if(t?.id&&/^https?:\/\//i.test(t.url||""))return t}catch{}}
  const a=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  return a.find(t=>/^https?:\/\//i.test(t.url||""))||null;
}
async function attach(id){try{await chrome.debugger.attach({tabId:id},"1.3")}catch(e){if(!String(e.message||e).toLowerCase().includes("already attached"))throw e}}
async function cdp(id,method,params={}){await attach(id);return chrome.debugger.sendCommand({tabId:id},method,params)}
async function viewport(id){try{const m=await cdp(id,"Page.getLayoutMetrics"),v=m.cssVisualViewport||m.visualViewport||{};return{width:Number(v.clientWidth||v.width)||1280,height:Number(v.clientHeight||v.height)||720}}catch{return{width:1280,height:720}}}
async function mouse(id,type,p){return cdp(id,"Input.dispatchMouseEvent",{type,...p})}
async function click(id,x,y,button="left",count=1){await mouse(id,"mouseMoved",{x,y});await mouse(id,"mousePressed",{x,y,button,clickCount:count,buttons:button==="left"?1:button==="right"?2:2});await mouse(id,"mouseReleased",{x,y,button,clickCount:count,buttons:0})}
async function drag(id,a,b){await mouse(id,"mouseMoved",{x:a.x,y:a.y});await mouse(id,"mousePressed",{x:a.x,y:a.y,button:"left",clickCount:1,buttons:1});for(let i=1;i<=24;i++)await mouse(id,"mouseMoved",{x:a.x+(b.x-a.x)*i/24,y:a.y+(b.y-a.y)*i/24,buttons:1});await mouse(id,"mouseReleased",{x:b.x,y:b.y,button:"left",clickCount:1,buttons:0})}
async function state(){const t=await getTab();return{ok:true,tabId:t?.id||null,url:t?.url||"",title:t?.title||"",width:t?.width||0,height:t?.height||0}}
async function execute(cmd){
  const p=cmd.payload||{},t=await getTab();if(cmd.command!=="get_state"&&!t?.id)throw new Error("No hay una pestaña web controlada.");if(t?.id)await setControlled(t.id);const id=t?.id;
  switch(cmd.command){
    case "get_state":return state();
    case "click":{const v=await viewport(id);await click(id,Number(p.nx)*v.width,Number(p.ny)*v.height,p.button||"left",Number(p.clickCount)||1);return{ok:true}}
    case "double_click":{const v=await viewport(id);await click(id,Number(p.nx)*v.width,Number(p.ny)*v.height,"left",2);return{ok:true}}
    case "right_click":{const v=await viewport(id);await click(id,Number(p.nx)*v.width,Number(p.ny)*v.height,"right",1);return{ok:true}}
    case "drag":{const v=await viewport(id);await drag(id,{x:Number(p.nx1)*v.width,y:Number(p.ny1)*v.height},{x:Number(p.nx2)*v.width,y:Number(p.ny2)*v.height});return{ok:true}}
    case "scroll":{const v=await viewport(id);await mouse(id,"mouseWheel",{x:Number(p.nx)*v.width||v.width/2,y:Number(p.ny)*v.height||v.height/2,deltaX:Number(p.dx)||0,deltaY:Number(p.dy)||0});return{ok:true}}
    case "type":await cdp(id,"Input.insertText",{text:String(p.text||"")});return{ok:true}
    case "key":{const key=String(p.key||"Enter"),code=String(p.code||key);await cdp(id,"Input.dispatchKeyEvent",{type:"rawKeyDown",key,code,text:String(p.text||"")});await cdp(id,"Input.dispatchKeyEvent",{type:"keyUp",key,code});return{ok:true}}
    case "back":await chrome.tabs.goBack(id);return{ok:true};
    case "forward":await chrome.tabs.goForward(id);return{ok:true};
    case "reload":await chrome.tabs.reload(id);return{ok:true};
    case "new_tab":{const n=await chrome.tabs.create({url:"https://www.google.com",active:true});await setControlled(n.id);return{ok:true,tabId:n.id}}
    case "navigate":{let u=String(p.url||"").trim();if(!u)throw new Error("URL vacía");if(!/^https?:\/\//i.test(u))u="https://"+u;await chrome.tabs.update(id,{url:u,active:true});return{ok:true,url:u}}
    case "close_tab":await chrome.tabs.remove(id);await chrome.storage.local.remove("reyInkControlledTabId");return{ok:true};
    case "start_screen":screenLoop();return{ok:true};
    case "stop_screen":screenRunning=false;return{ok:true};
    default:throw new Error("Comando no reconocido: "+cmd.command)
  }
}
async function register(){const s=await chrome.storage.local.get(["reyInkPcSlot","reyInkRemote"]),pcSlot=Number(s.reyInkPcSlot);if(!Number.isInteger(pcSlot)||pcSlot<1||pcSlot>20)throw new Error("Selecciona PC1–PC20.");const token=s.reyInkRemote?.token||crypto.randomUUID();const r=await api("register_device",{pc_slot:pcSlot,token,state:{browser:navigator.userAgent}});await chrome.storage.local.set({reyInkRemote:{enabled:true,token:r.token||token,pcSlot,api:API},reyInkRelayStatus:{connected:true,lastConnected:Date.now()}});startPolling();return{ok:true,pcSlot}}
async function heartbeat(){const s=await cfg();if(!s?.enabled)return;try{const t=await getTab();await api("heartbeat",{pc_slot:s.pcSlot,token:s.token,state:{tabId:t?.id||null,url:t?.url||"",title:t?.title||""}});await chrome.storage.local.set({reyInkRelayStatus:{connected:true,lastConnected:Date.now()}})}catch(e){await chrome.storage.local.set({reyInkRelayStatus:{connected:false,error:String(e.message||e)}})}}
async function poll(){const s=await cfg();if(!s?.enabled)return;try{const d=await api("poll_command",{pc_slot:s.pcSlot,token:s.token});if(d.command){const result=await execute(d.command).catch(e=>({ok:false,error:String(e.message||e)}));await api("command_result",{pc_slot:s.pcSlot,token:s.token,command_id:d.command.id,result}).catch(()=>{})}}catch{}}
async function pollingLoop(){if(running)return;running=true;while(running){await poll();await sleep(300)}running=false}
function startPolling(){pollingLoop().catch(()=>{running=false})}
async function capture(){const s=await cfg();if(!screenRunning||!s?.enabled)return;const t=await getTab();if(!t?.id)return;try{const image=await chrome.tabs.captureVisibleTab(t.windowId,{format:"jpeg",quality:65});await api("command_result",{pc_slot:s.pcSlot,token:s.token,command_id:"__screen__",result:{screen:true,image,ts:Date.now(),url:t.url||"",title:t.title||"",width:t.width||0,height:t.height||0}})}catch{}}
async function screenLoop(){if(screenRunning)return;screenRunning=true;while(screenRunning){await capture();await sleep(400)}screenRunning=false}
chrome.runtime.onInstalled.addListener(async()=>{await chrome.storage.local.set({reyInkVersion:"4.2.0"});const s=await chrome.storage.local.get("reyInkRemote");if(s.reyInkRemote?.enabled)startPolling()});
chrome.runtime.onStartup.addListener(()=>{startPolling();heartbeat()});setInterval(heartbeat,15000);
chrome.tabs.onRemoved.addListener(async id=>{const s=await chrome.storage.local.get("reyInkControlledTabId");if(Number(s.reyInkControlledTabId)===Number(id))await chrome.storage.local.remove("reyInkControlledTabId")});
chrome.runtime.onMessage.addListener((m,s,send)=>{(async()=>{try{switch(m.type){case "SET_PC_SLOT":{const n=Number(m.pcSlot);if(!Number.isInteger(n)||n<1||n>20)throw new Error("PC inválida");await chrome.storage.local.set({reyInkPcSlot:n});return{ok:true,pcSlot:n}}case "REGISTER_REMOTE":return register();case "DISCONNECT_REMOTE":running=false;screenRunning=false;await chrome.storage.local.set({reyInkRemote:{enabled:false},reyInkRelayStatus:{connected:false}});return{ok:true};case "GET_STATE":return execute({command:"get_state",payload:{}});case "START_SCREEN":screenLoop();return{ok:true};case "STOP_SCREEN":screenRunning=false;return{ok:true};case "RELOAD":return execute({command:"reload",payload:{}});case "GO_BACK":return execute({command:"back",payload:{}});case "GO_FORWARD":return execute({command:"forward",payload:{}});case "NEW_TAB":return execute({command:"new_tab",payload:{}});case "CLOSE_TAB":return execute({command:"close_tab",payload:{}});case "NAVIGATE":return execute({command:"navigate",payload:{url:m.url}});case "CLICK":return execute({command:"click",payload:m});case "DOUBLE_CLICK":return execute({command:"double_click",payload:m});case "RIGHT_CLICK":return execute({command:"right_click",payload:m});case "DRAG":return execute({command:"drag",payload:m});case "SCROLL":return execute({command:"scroll",payload:m});case "TYPE":return execute({command:"type",payload:{text:m.text}});case "KEY":return execute({command:"key",payload:{key:m.key,code:m.code,text:m.text}});default:return{ok:false,error:"Comando no reconocido: "+m.type}}}catch(e){return{ok:false,error:String(e.message||e)}}})().then(send);return true});