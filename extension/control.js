const $=id=>document.getElementById(id);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function msg(type,data={}){return await new Promise(resolve=>chrome.runtime.sendMessage({type,...data},r=>resolve(r||{ok:false,error:chrome.runtime.lastError?.message||'Error'})))}
// Libera una captura anterior de Rey Ink al abrir el panel.
msg('WEBRTC_STOP').catch(()=>{});
function show(id,text,good=true){const e=$(id);if(!e)return;e.textContent=(good?'● ':'⚠ ')+text;e.className='status '+(good?'ok':'err')}
async function state(){return msg('GET_STATE')}
function log(x){const e=$('diag');if(e)e.textContent=new Date().toLocaleTimeString()+'  '+x+'\n'+e.textContent}
async function refreshPCs(){const d=await fetch('https://rey-ink-browser.vercel.app/api/rey-ink?action=list_devices',{cache:'no-store'}).then(r=>r.json()).catch(()=>({devices:[]}));const s=$('pc');if(!s)return;const old=s.value;s.innerHTML='<option value="">Selecciona PC</option>';for(const x of d.devices||[]){const o=document.createElement('option');o.value=String(x.pc_slot);o.textContent='PC '+x.pc_slot+(x.is_online?' · 🟢 en línea':'');s.appendChild(o)}if(old)s.value=old}
$('connect').onclick=async()=>{
  const n=Number($('pc')?.value);
  if(!Number.isInteger(n)||n<1||n>20){show('relay','Selecciona PC1–PC20.',false);return}
  show('relay','Conectando PC'+n+'…',true);
  try{
    const tabs=await chrome.tabs.query({active:true,currentWindow:true});
    const tab=tabs.find(t=>t?.id&&/^https?:/i.test(t.url||''));
    if(!tab?.id)throw Error('Abre primero una página web normal en Chrome.');

    // Guarda la PC localmente y pide el stream inmediatamente.
    // El registro de red ocurre en paralelo para que el streamId no expire.
    chrome.storage.local.set({reyInkPcSlot:n});
    const streamPromise=chrome.tabCapture.getMediaStreamId({targetTabId:Number(tab.id)});
    const regPromise=msg('REGISTER_REMOTE');
    let streamId,reg;
    try{[streamId,reg]=await Promise.all([streamPromise,regPromise]);}
    catch(e){throw Error('Chrome no pudo capturar esta pestaña: '+(e?.message||e));}
    if(!reg?.ok)throw Error(reg?.error||'No se pudo registrar la PC.');
    const r=await msg('WEBRTC_HOST',{streamId});
    if(!r?.ok)throw Error(r?.error||'No se pudo iniciar la transmisión WebRTC.');
    show('relay','🟢 PC'+n+' conectada · transmisión real activa',true);
    log('PC'+n+' conectada. Captura de pestaña iniciada.');
  }catch(e){show('relay',e.message||String(e),false);log('ERROR: '+(e.message||e))}
};
$('disconnect').onclick=async()=>{const r=await msg('DISCONNECT_REMOTE');show('relay',r?.ok?'PC desconectada.':(r?.error||'No se pudo desconectar.'),!!r?.ok)};
$('check').onclick=async()=>{const r=await state();show('browser',r?.ok?(r.title||'Pestaña activa')+'\n'+(r.url||''):(r.error||'Error'),!!r?.ok)};
$('reload').onclick=async()=>log((await msg('RELOAD')).ok?'Recargar: OK':'Recargar: error');
$('back').onclick=async()=>log((await msg('GO_BACK')).ok?'Atrás: OK':'Atrás: error');
$('forward').onclick=async()=>log((await msg('GO_FORWARD')).ok?'Adelante: OK':'Adelante: error');
$('go').onclick=async()=>log((await msg('NAVIGATE',{url:$('url').value})).ok?'Navegar: OK':'Navegar: error');
$('record').onclick=async()=>{const r=await msg('AUTO_RECORD_START');show('autoStatus',r?.ok?'🔴 Grabando clics reales. Haz tus clics en la página.':r?.error||'No se pudo iniciar.',!!r?.ok)};
$('stopRecord').onclick=async()=>{const r=await msg('AUTO_RECORD_STOP');if(!r?.ok){show('autoStatus',r?.error||'No se pudo detener.',false);return}const s=await state();const count=s?.draft?.length||0;if(!count){show('autoStatus','No se registraron clics.',false);return}const name=prompt('Nombre de la rutina:','Auto clic');if(name===null)return;const saved=await msg('SAVE_AUTO_ROUTINE',{name:name.trim()||'Auto clic'});show('autoStatus',saved?.ok?'Rutina guardada con '+count+' clics.':saved?.error||'No se pudo guardar.',!!saved?.ok);await refreshRoutines()};
$('schedule').onclick=async()=>{const r=await msg('SCHEDULE_AUTO',{index:Number($('routineSelect')?.value||0),minutes:Number($('minutes').value)||16});show('autoStatus',r?.ok?'⏱️ Programa activo cada '+(Number($('minutes').value)||16)+' minutos.':r?.error||'Error',!!r?.ok)};
$('stopSchedule').onclick=async()=>show('autoStatus',(await msg('STOP_SCHEDULE')).ok?'Programa detenido.':'No se pudo detener.',true);
$('run').onclick=async()=>{const r=await msg('RUN_ROUTINE_NOW',{index:Number($('routineSelect')?.value||0)});show('autoStatus',r?.ok?'Rutina ejecutada.':r?.error||'Error',!!r?.ok)};
async function refreshRoutines(){const r=await state(),box=$('routines');if(!box)return;box.innerHTML='';const list=r?.routines||[];if(!list.length){box.textContent='No hay rutinas guardadas todavía.';return}const label=document.createElement('div');label.className='small';label.textContent='Rutinas guardadas:';box.appendChild(label);const sel=document.createElement('select');sel.id='routineSelect';for(const [i,x] of list.entries()){const o=document.createElement('option');o.value=String(i);o.textContent=(x.name||'Rutina '+(i+1))+' · '+(x.actions?.length||0)+' clics';sel.appendChild(o)}box.appendChild(sel)}
$('diagBtn').onclick=async()=>{$('diag').textContent=JSON.stringify(await state(),null,2)};refreshPCs();refreshRoutines();