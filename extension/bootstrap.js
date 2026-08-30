const API='https://rey-ink-browser.vercel.app/api/rey-ink';
let polling=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(action,body={},pcToken=''){
  const headers={'content-type':'application/json'};
  if(pcToken) headers['x-pc-token']=pcToken;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(API,{method:'POST',headers,body:JSON.stringify({action,...body}),cache:'no-store',signal:controller.signal});
    const d=await r.json().catch(()=>({error:'Respuesta inválida del servidor'}));
    if(!r.ok||d.ok===false)throw Error(d.error||`HTTP ${r.status}`);
    return d;
  }catch(e){
    if(e?.name==='AbortError')throw Error('El servidor tardó demasiado en responder.');
    throw e;
  }finally{clearTimeout(timer)}
}
async function tab(){
  const s=await chrome.storage.local.get('reyInkControlledTabId');
  if(s.reyInkControlledTabId)try{const t=await chrome.tabs.get(Number(s.reyInkControlledTabId));if(t?.id&&/^https?:/i.test(t.url||''))return t}catch{}
  const a=await chrome.tabs.query({active:true,currentWindow:true}),t=a.find(x=>x?.id&&/^https?:/i.test(x.url||''));
  if(t?.id)await chrome.storage.local.set({reyInkControlledTabId:t.id});
  return t||null;
}
async function attach(id){try{await chrome.debugger.attach({tabId:id},'1.3')}catch(e){if(!/already attached/i.test(String(e?.message||e)))throw e}}
async function cdp(id,m,p={}){await attach(id);try{return await chrome.debugger.sendCommand({tabId:id},m,p)}catch(e){if(/detached|not attached|target closed/i.test(String(e?.message||e))){try{await chrome.debugger.detach({tabId:id})}catch{}await attach(id);return chrome.debugger.sendCommand({tabId:id},m,p)}throw e}}
async function vp(id){const x=await cdp(id,'Page.getLayoutMetrics'),v=x?.cssVisualViewport||x?.visualViewport||{};return{w:Number(v.clientWidth||v.width)||1280,h:Number(v.clientHeight||v.height)||720}}
async function click(id,x,y,b='left',n=1){const q=b==='left'?1:b==='right'?2:4;await cdp(id,'Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'none',buttons:0,pointerType:'mouse'});await cdp(id,'Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:b,buttons:q,clickCount:n,pointerType:'mouse'});await cdp(id,'Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:b,buttons:0,clickCount:n,pointerType:'mouse'})}
async function prepare(id){await cdp(id,'Page.enable');await cdp(id,'Runtime.enable');await cdp(id,'Input.setIgnoreInputEvents',{ignore:false})}
async function execute(c){const t=await tab(),id=t?.id,p=c.payload||{};if(c.command!=='get_state'&&!id)throw Error('No hay pestaña controlada.');if(id)await chrome.storage.local.set({reyInkControlledTabId:id});switch(c.command){case'get_state':return{ok:true,tabId:id||null,url:t?.url||'',title:t?.title||''};case'click':{await prepare(id);const v=await vp(id);await click(id,Number(p.nx)*v.w,Number(p.ny)*v.h,p.button||'left',Number(p.clickCount)||1);return{ok:true}}case'double_click':{await prepare(id);const v=await vp(id);await click(id,Number(p.nx)*v.w,Number(p.ny)*v.h,'left',2);return{ok:true}}case'scroll':{await prepare(id);const v=await vp(id);await cdp(id,'Input.dispatchMouseEvent',{type:'mouseWheel',x:Number(p.nx)*v.w,y:Number(p.ny)*v.h,deltaX:Number(p.dx)||0,deltaY:Number(p.dy)||0});return{ok:true}}case'type':{await prepare(id);await cdp(id,'Input.insertText',{text:String(p.text||'')});return{ok:true}}case'key':{await prepare(id);const key=String(p.key||'Enter'),code=String(p.code||key),text=String(p.text||'');await cdp(id,'Input.dispatchKeyEvent',{type:'keyDown',key,code,text,unmodifiedText:text});await cdp(id,'Input.dispatchKeyEvent',{type:'keyUp',key,code});return{ok:true}}case'back':await chrome.tabs.goBack(id);return{ok:true};case'forward':await chrome.tabs.goForward(id);return{ok:true};case'reload':await chrome.tabs.reload(id);return{ok:true};case'navigate':{let u=String(p.url||'').trim();if(!/^https?:/i.test(u))u='https://'+u;await chrome.tabs.update(id,{url:u,active:true});return{ok:true,url:u}}default:throw Error('Comando no reconocido: '+c.command)}}
async function register(){
  const s=await chrome.storage.local.get('reyInkRemote');
  const pcSlot=Number(s.reyInkRemote?.pcSlot||1);
  const r=await api('register_pc',{pc_slot:pcSlot,username:`PC${pcSlot}`,password:`taysha${pcSlot}`});
  const token=r.pc_token;
  if(!token)throw Error('El servidor no devolvió el token de la PC.');
  await chrome.storage.local.set({reyInkRemote:{enabled:true,token,pcSlot,deviceId:r.device_id},reyInkRelayStatus:{connected:true,lastConnected:Date.now()}});
  startPolling();
  return{ok:true,pcSlot,deviceId:r.device_id}
}
async function heartbeat(){
  const s=(await chrome.storage.local.get('reyInkRemote')).reyInkRemote;
  if(!s?.enabled||!s?.token)return;
  try{const t=await tab();await api('heartbeat',{state:{tabId:t?.id||null,url:t?.url||'',title:t?.title||''}},s.token);await chrome.storage.local.set({reyInkRelayStatus:{connected:true,lastConnected:Date.now()}})}catch(e){await chrome.storage.local.set({reyInkRelayStatus:{connected:false,error:String(e?.message||e)}})}}
async function poll(){
  const s=(await chrome.storage.local.get('reyInkRemote')).reyInkRemote;
  if(!s?.enabled||!s?.token)return;
  try{
    const d=await api('poll',{},s.token);
    if(d.command){
      const result=await execute(d.command).catch(e=>({ok:false,error:String(e?.message||e)}));
      await api('complete',{command_id:d.command.id,status:result.ok===false?'error':'completed',result},s.token).catch(()=>{});
    }
  }catch(e){await chrome.storage.local.set({reyInkRelayStatus:{connected:false,error:String(e?.message||e)}})}
}
async function startPolling(){if(polling)return;polling=true;while(polling){await poll();await sleep(500)}polling=false}
async function state(){const t=await tab(),s=await chrome.storage.local.get(['reyInkRemote','reyInkRelayStatus']);return{ok:true,tabId:t?.id||null,url:t?.url||'',title:t?.title||'',remote:s.reyInkRemote||null,relayStatus:s.reyInkRelayStatus||null}}
chrome.runtime.onMessage.addListener((m,s,send)=>{(async()=>{try{switch(m.type){case'GET_STATE':return state();case'CONNECT':return register();case'DISCONNECT':polling=false;await chrome.storage.local.set({reyInkRemote:{enabled:false},reyInkRelayStatus:{connected:false}});return{ok:true};case'RELOAD':return execute({command:'reload'});case'BACK':return execute({command:'back'});case'FORWARD':return execute({command:'forward'});case'NAVIGATE':return execute({command:'navigate',payload:{url:m.url}});default:return{ok:false,error:'Comando no reconocido'}}}catch(e){return{ok:false,error:String(e?.message||e)}}})().then(send);return true});
chrome.runtime.onStartup.addListener(()=>{register().catch(e=>chrome.storage.local.set({reyInkRelayStatus:{connected:false,error:String(e?.message||e)}}));heartbeat()});
chrome.runtime.onInstalled.addListener(()=>{register().catch(e=>chrome.storage.local.set({reyInkRelayStatus:{connected:false,error:String(e?.message||e)}}));});
setInterval(heartbeat,15000);
