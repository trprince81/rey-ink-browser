const REY_INK_API = 'https://rey-ink-browser.vercel.app/api/rey-ink';
let polling = false, autoClickTimer = null, offscreenCreating = null, remotePointer = null;
const wait = ms => new Promise(r => setTimeout(r, ms));

async function api(action, body = {}) {
  const r = await fetch(REY_INK_API, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({action, ...body}), cache:'no-store' });
  const d = await r.json().catch(() => ({error:'Respuesta inválida'}));
  if (!r.ok || d.ok === false) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}
async function cfg(){ return (await chrome.storage.local.get('reyInkRemote')).reyInkRemote || null; }
async function setTab(id){ if(id) await chrome.storage.local.set({reyInkControlledTabId:Number(id)}); }
async function activeTab(){
  const s = await chrome.storage.local.get('reyInkControlledTabId');
  if(s.reyInkControlledTabId){ try { const t=await chrome.tabs.get(Number(s.reyInkControlledTabId)); if(t?.id && /^https?:/i.test(t.url||'')) return t; } catch {} }
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});
  const t=tabs.find(x=>x?.id && /^https?:/i.test(x.url||''));
  if(t?.id) await setTab(t.id); return t||null;
}
async function attach(id){
  try { await chrome.debugger.attach({tabId:id},'1.3'); }
  catch(e){ if(!/already attached/i.test(String(e?.message||e))) throw e; }
}
async function cdp(id,method,params={}){
  await attach(id);
  try { return await chrome.debugger.sendCommand({tabId:id},method,params); }
  catch(e){
    if(/detached|not attached|target closed/i.test(String(e?.message||e))){
      try{await chrome.debugger.detach({tabId:id})}catch{}; await attach(id);
      return chrome.debugger.sendCommand({tabId:id},method,params);
    }
    throw e;
  }
}
async function prepare(id){ await cdp(id,'Page.enable'); await cdp(id,'Runtime.enable'); await cdp(id,'Input.setIgnoreInputEvents',{ignore:false}); }
async function viewport(id){
  const m=await cdp(id,'Page.getLayoutMetrics'),v=m?.cssVisualViewport||m?.visualViewport||{};
  return {width:Number(v.clientWidth||v.width)||1280,height:Number(v.clientHeight||v.height)||720};
}
async function mouse(id,type,p){return cdp(id,'Input.dispatchMouseEvent',{type,...p});}
async function press(id,x,y,button='left',count=1){
  await prepare(id); const buttons=button==='left'?1:button==='right'?2:4;
  await mouse(id,'mouseMoved',{x,y,button:'none',buttons:0,pointerType:'mouse'});
  await mouse(id,'mousePressed',{x,y,button,buttons,clickCount:count,pointerType:'mouse'});
}
async function release(id,x,y,button='left',count=1){
  const buttons=button==='left'?1:button==='right'?2:4;
  await mouse(id,'mouseMoved',{x,y,button,buttons,pointerType:'mouse'});
  await mouse(id,'mouseReleased',{x,y,button,buttons:0,clickCount:count,pointerType:'mouse'});
}
async function clickAt(id,x,y,button='left',count=1){await press(id,x,y,button,count);await release(id,x,y,button,count);}
async function scrollAt(id,x,y,dx,dy){await prepare(id);await mouse(id,'mouseWheel',{x,y,deltaX:dx,deltaY:dy});}
async function typeText(id,text){await prepare(id);await cdp(id,'Input.insertText',{text:String(text||'')});}
async function keyAt(id,p){
  await prepare(id); const key=String(p.key||'Enter'),code=String(p.code||key),text=String(p.text||'');
  await cdp(id,'Input.dispatchKeyEvent',{type:'keyDown',key,code,text,unmodifiedText:text});
  await cdp(id,'Input.dispatchKeyEvent',{type:'keyUp',key,code});
}
async function remoteMouse(m){
  const t=await activeTab(); if(!t?.id) throw new Error('No hay pestaña controlada.');
  const v=await viewport(t.id),x=Math.max(0,Math.min(v.width,Number(m.x)*v.width)),y=Math.max(0,Math.min(v.height,Number(m.y)*v.height)),button=m.button||'left';
  if(m.action==='down'){await press(t.id,x,y,button,Number(m.clickCount)||1);remotePointer={tabId:t.id,x,y,button};return {ok:true};}
  if(m.action==='move'){if(remotePointer){await mouse(t.id,'mouseMoved',{x,y,button:remotePointer.button,buttons:1,pointerType:'mouse'});remotePointer.x=x;remotePointer.y=y;}return {ok:true};}
  if(m.action==='up'){if(remotePointer){await release(t.id,x,y,remotePointer.button,1);remotePointer=null;}return {ok:true};}
  if(m.action==='wheel'){await scrollAt(t.id,x,y,Number(m.dx)||0,Number(m.dy)||0);return {ok:true};}
  return {ok:false,error:'Acción de ratón desconocida.'};
}
async function execute(cmd){
  const p=cmd.payload||{},t=await activeTab(); if(cmd.command!=='get_state'&&!t?.id) throw new Error('No hay una pestaña web controlada.');
  const id=t?.id;if(id)await setTab(id);
  switch(cmd.command){
    case'get_state':return{ok:true,tabId:t?.id||null,url:t?.url||'',title:t?.title||''};
    case'click':{const v=await viewport(id);await clickAt(id,Number(p.nx)*v.width,Number(p.ny)*v.height,p.button||'left',Number(p.clickCount)||1);return{ok:true};}
    case'double_click':{const v=await viewport(id);await clickAt(id,Number(p.nx)*v.width,Number(p.ny)*v.height,'left',2);return{ok:true};}
    case'right_click':{const v=await viewport(id);await clickAt(id,Number(p.nx)*v.width,Number(p.ny)*v.height,'right',1);return{ok:true};}
    case'drag':{const v=await viewport(id),a={x:Number(p.nx1)*v.width,y:Number(p.ny1)*v.height},b={x:Number(p.nx2)*v.width,y:Number(p.ny2)*v.height};await press(id,a.x,a.y);for(let i=1;i<=30;i++)await mouse(id,'mouseMoved',{x:a.x+(b.x-a.x)*i/30,y:a.y+(b.y-a.y)*i/30,button:'left',buttons:1,pointerType:'mouse'});await release(id,b.x,b.y);return{ok:true};}
    case'scroll':{const v=await viewport(id);await scrollAt(id,Number(p.nx)*v.width,Number(p.ny)*v.height,Number(p.dx)||0,Number(p.dy)||0);return{ok:true};}
    case'type':await typeText(id,p.text);return{ok:true};
    case'key':await keyAt(id,p);return{ok:true};
    case'back':await chrome.tabs.goBack(id);return{ok:true};
    case'forward':await chrome.tabs.goForward(id);return{ok:true};
    case'reload':await chrome.tabs.reload(id);return{ok:true};
    case'new_tab':{const n=await chrome.tabs.create({url:p.url||'https://www.google.com',active:true});await setTab(n.id);return{ok:true,tabId:n.id};}
    case'navigate':{let u=String(p.url||'').trim();if(!u)throw new Error('URL vacía');if(!/^https?:/i.test(u))u='https://'+u;await chrome.tabs.update(id,{url:u,active:true});return{ok:true,url:u};}
    case'close_tab':await chrome.tabs.remove(id);await chrome.storage.local.remove('reyInkControlledTabId');return{ok:true};
    case'autoclick_start':{const v=await viewport(id),x=Number(p.nx)*v.width,y=Number(p.ny)*v.height,ms=Math.max(100,Math.min(3600000,Number(p.interval)||500));if(autoClickTimer)clearInterval(autoClickTimer);await clickAt(id,x,y);autoClickTimer=setInterval(()=>clickAt(id,x,y).catch(()=>{}),ms);return{ok:true};}
    case'autoclick_stop':if(autoClickTimer)clearInterval(autoClickTimer);autoClickTimer=null;return{ok:true};
    default:throw new Error('Comando no reconocido: '+cmd.command);
  }
}
async function ensureOffscreen(){
  const url=chrome.runtime.getURL('offscreen.html');
  const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[url]});
  if(contexts.length)return;
  if(offscreenCreating){await offscreenCreating;return;}
  offscreenCreating=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA'],justification:'Mantener la captura WebRTC de la pestaña real para control remoto.'});
  try{await offscreenCreating}finally{offscreenCreating=null;}
}
async function offscreenMessage(message){
  await ensureOffscreen();
  return new Promise(resolve=>chrome.runtime.sendMessage({...message,target:'offscreen'},r=>resolve(r||{ok:true})));
}
async function register(){
  const s=await chrome.storage.local.get('reyInkPcSlot'),pcSlot=Number(s.reyInkPcSlot);if(!Number.isInteger(pcSlot)||pcSlot<1||pcSlot>20)throw new Error('Selecciona PC1–PC20.');
  const t=await activeTab(),old=(await cfg())||{},token=old.token||crypto.randomUUID();
  const r=await api('register_device',{pc_slot:pcSlot,token,state:{tabId:t?.id||null,url:t?.url||'',title:t?.title||''}});
  await chrome.storage.local.set({reyInkRemote:{enabled:true,token:r.token||token,pcSlot,session:r.session_id,api:REY_INK_API},reyInkRelayStatus:{connected:true,lastConnected:Date.now()}});
  startPolling();return{ok:true,pcSlot,session:r.session_id};
}
async function heartbeat(){
  const s=await cfg();if(!s?.enabled)return;
  try{const t=await activeTab();await api('heartbeat',{pc_slot:s.pcSlot,token:s.token,state:{tabId:t?.id||null,url:t?.url||'',title:t?.title||''}});await chrome.storage.local.set({reyInkRelayStatus:{connected:true,lastConnected:Date.now()}});}
  catch(e){await chrome.storage.local.set({reyInkRelayStatus:{connected:false,error:String(e?.message||e)}});}
}
async function poll(){
  const s=await cfg();if(!s?.enabled)return;
  try{const d=await api('poll_command',{pc_slot:s.pcSlot,token:s.token});if(!d.command)return;const result=await execute(d.command).catch(e=>({ok:false,error:String(e?.message||e)}));await api('command_result',{pc_slot:s.pcSlot,token:s.token,command_id:d.command.id,result}).catch(()=>{});}catch{}
}
async function loop(){if(polling)return;polling=true;while(polling){await poll();await wait(250);}polling=false;}
function startPolling(){loop().catch(()=>{polling=false;});}
async function saveDraft(name){const s=await chrome.storage.local.get('reyInkAutoDraft'),r=await chrome.storage.local.get('reyInkAutoRoutines'),list=r.reyInkAutoRoutines||[];list.push({name:String(name||'Auto clic'),actions:s.reyInkAutoDraft||[],createdAt:Date.now()});await chrome.storage.local.set({reyInkAutoRoutines:list,reyInkAutoDraft:[]});return{ok:true,routines:list};}
async function scheduleRoutine(index,minutes){const n=Math.max(.5,Number(minutes)||16);await chrome.alarms.clear('reyink-autoclick');await chrome.alarms.create('reyink-autoclick',{delayInMinutes:n,periodInMinutes:n});await chrome.storage.local.set({reyInkAutoSchedule:{enabled:true,index:Number(index),minutes:n}});}
async function stopSchedule(){await chrome.alarms.clear('reyink-autoclick');await chrome.storage.local.set({reyInkAutoSchedule:{enabled:false}});}
chrome.runtime.onMessage.addListener((m,sender,send)=>{(async()=>{try{
  if(m.target==='offscreen')return{ok:false};
  switch(m.type){
    case'SET_PC_SLOT':{const n=Number(m.pcSlot);if(!Number.isInteger(n)||n<1||n>20)throw new Error('PC inválida');await chrome.storage.local.set({reyInkPcSlot:n});return{ok:true};}
    case'REGISTER_REMOTE':return register();
    case'DISCONNECT_REMOTE':polling=false;await stopSchedule();if(autoClickTimer)clearInterval(autoClickTimer);autoClickTimer=null;try{await offscreenMessage({action:'WEBRTC_STOP'});}catch{}await chrome.storage.local.set({reyInkRemote:{enabled:false},reyInkRelayStatus:{connected:false}});return{ok:true};
    case'GET_STATE':{const t=await activeTab(),s=await chrome.storage.local.get(['reyInkPcSlot','reyInkRelayStatus','reyInkRemote','reyInkAutoRoutines','reyInkAutoDraft','reyInkAutoSchedule']);return{ok:true,tabId:t?.id||null,url:t?.url||'',title:t?.title||'',pcSlot:s.reyInkPcSlot||null,relayStatus:s.reyInkRelayStatus||null,remote:s.reyInkRemote||null,routines:s.reyInkAutoRoutines||[],draft:s.reyInkAutoDraft||[],updateBot:s.reyInkAutoSchedule||{enabled:false}};}
    case'WEBRTC_HOST':return offscreenMessage({action:'WEBRTC_HOST',streamId:m.streamId});
    case'WEBRTC_STOP':return offscreenMessage({action:'WEBRTC_STOP'});
    case'RELOAD':return execute({command:'reload'});
    case'GO_BACK':return execute({command:'back'});
    case'GO_FORWARD':return execute({command:'forward'});
    case'NAVIGATE':return execute({command:'navigate',payload:{url:m.url}});
    case'NEW_TAB':return execute({command:'new_tab'});
    case'CLICK':return execute({command:'click',payload:m});
    case'AUTO_RECORD_START':{const t=await activeTab();if(!t?.id)throw new Error('Abre una página web primero.');await chrome.scripting.executeScript({target:{tabId:t.id},files:['content.js']}).catch(()=>{});await chrome.tabs.sendMessage(t.id,{type:'AUTO_RECORD_START'}).catch(()=>{});await chrome.storage.local.set({reyInkAutoDraft:[]});return{ok:true};}
    case'AUTO_RECORD_STOP':{const t=await activeTab();if(t?.id)await chrome.tabs.sendMessage(t.id,{type:'AUTO_RECORD_STOP'}).catch(()=>{});return{ok:true};}
    case'SAVE_AUTO_ROUTINE':return saveDraft(m.name);
    case'SCHEDULE_AUTO':await scheduleRoutine(m.index,m.minutes);return{ok:true};
    case'STOP_SCHEDULE':await stopSchedule();return{ok:true};
    case'RUN_ROUTINE_NOW':{const r=(await chrome.storage.local.get('reyInkAutoRoutines')).reyInkAutoRoutines||[],row=r[Number(m.index)];if(!row?.actions?.length)throw new Error('Rutina vacía.');const t=await activeTab();if(!t?.id)throw new Error('No hay pestaña controlada.');const v=await viewport(t.id);for(const a of row.actions){await clickAt(t.id,Number(a.x)*v.width,Number(a.y)*v.height);await wait(Math.max(0,Number(a.delayMs)||250));}return{ok:true};}
    case'mouse':return remoteMouse(m);
    case'type':await typeText((await activeTab()).id,m.text);return{ok:true};
    case'key':await keyAt((await activeTab()).id,m);return{ok:true};
    default:return{ok:false,error:'Comando no reconocido: '+m.type};
  }
}catch(e){return{ok:false,error:String(e?.message||e)}}})().then(send);return true;});
chrome.runtime.onMessage.addListener(m=>{if(m.target==='offscreen')return;if(m.type==='AUTO_CLICK_RECORDED')chrome.storage.local.get('reyInkAutoDraft').then(x=>{const a=x.reyInkAutoDraft||[],last=a[a.length-1];a.push({x:Number(m.x),y:Number(m.y),delayMs:last?250:0,url:m.url||'',title:m.title||''});return chrome.storage.local.set({reyInkAutoDraft:a});}).catch(()=>{});if(m.type==='WEBRTC_STATUS')chrome.storage.local.set({reyInkWebRTCStatus:m}).catch(()=>{});});
chrome.alarms.onAlarm.addListener(async a=>{if(a.name!=='reyink-autoclick')return;const s=await chrome.storage.local.get('reyInkAutoSchedule'),r=(await chrome.storage.local.get('reyInkAutoRoutines')).reyInkAutoRoutines||[],row=r[s.reyInkAutoSchedule?.index];if(s.reyInkAutoSchedule?.enabled&&row?.actions?.length){try{const t=await activeTab();if(t?.id){const v=await viewport(t.id);for(const x of row.actions){await clickAt(t.id,Number(x.x)*v.width,Number(x.y)*v.height);await wait(Math.max(0,Number(x.delayMs)||250));}}}catch{}}});
chrome.runtime.onInstalled.addListener(()=>chrome.storage.local.set({reyInkVersion:'4.8.7'}).catch(()=>{}));
chrome.runtime.onStartup.addListener(()=>{startPolling();heartbeat();});
setInterval(heartbeat,15000);
chrome.tabs.onActivated.addListener(async({tabId})=>{try{const t=await chrome.tabs.get(tabId);if(t?.id&&/^https?:/i.test(t.url||''))await setTab(t.id);}catch{}});
chrome.tabs.onRemoved.addListener(async id=>{const s=await chrome.storage.local.get('reyInkControlledTabId');if(Number(s.reyInkControlledTabId)===Number(id))await chrome.storage.local.remove('reyInkControlledTabId');});
