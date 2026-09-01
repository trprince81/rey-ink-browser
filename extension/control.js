const $=id=>document.getElementById(id);
const msg=(type,data={})=>new Promise(resolve=>chrome.runtime.sendMessage({type,...data},r=>resolve(r||{ok:false,error:chrome.runtime.lastError?.message||'Error'})));
let pairTimer=null;
let registering=false;

async function refresh(){
  try{
    const s=await msg('GET_STATE');
    const connected=!!s?.relayStatus?.connected&&!!s?.remote?.enabled;
    const number=s?.remote?.number||s?.pairing?.number||'';
    $('status').textContent=connected?'🟢 CONECTADO · Navegador '+number:(s?.relayStatus?.lastError?'⚠ '+s.relayStatus.lastError:'🟠 SIN CONECTAR');
    $('status').className='status '+(connected?'ok':'err');
    $('tab').textContent=(s?.title||'Sin pestaña')+'\n'+(s?.url||'');
    if(s?.pairing?.paired){
      $('pairCode').style.display='block';
      $('pairCode').textContent='✓';
      $('pairStatus').textContent=connected?'🟢 Navegador emparejado y conectado.':'🟢 Navegador emparejado. Pulsa CONECTAR si aún no aparece online.';
    }
  }catch(e){
    $('status').textContent='⚠ '+(e?.message||'No se pudo consultar la extensión');
    $('status').className='status err';
  }
}

async function startPairing(){
  try{
    if(pairTimer)clearInterval(pairTimer);
    const r=await msg('BEGIN_PAIRING');
    if(!r.ok)throw Error(r.error||'No se pudo generar el código.');
    $('pairCode').style.display='block';
    $('pairCode').textContent=String(r.pairingCode||'------');
    $('pairStatus').textContent='⏳ Escribe este código en Control Center → Navegadores → Agregar navegador.';
    const installationId=r.installationId;
    pairTimer=setInterval(async()=>{
      const s=await msg('CHECK_PAIRING',{installationId});
      if(s?.status==='paired'){
        clearInterval(pairTimer);pairTimer=null;
        $('pairStatus').textContent='🟢 Navegador emparejado. Conectando…';
        if(!registering){
          registering=true;
          const c=await msg('REGISTER_REMOTE');
          registering=false;
          $('pairStatus').textContent=c?.ok?'🟢 Navegador emparejado y conectado.':'🟢 Emparejado. ⚠ '+(c?.error||'No se pudo conectar todavía.');
        }
        await refresh();
      }else if(s?.status==='expired'){
        clearInterval(pairTimer);pairTimer=null;
        $('pairStatus').textContent='⚠ El código expiró. Genera uno nuevo.';
      }
    },1500);
  }catch(e){
    $('pairCode').style.display='block';
    $('pairCode').textContent='------';
    $('pairStatus').textContent='⚠ '+(e?.message||'No se pudo contactar al servidor');
  }
}

$('pair').onclick=startPairing;
$('connect').onclick=async()=>{
  if(registering)return;
  registering=true;
  try{
    const r=await msg('REGISTER_REMOTE');
    $('status').textContent=r.ok?'🟢 CONECTADO · Navegador '+(r.number||''):'⚠ '+(r.error||'Error');
  }finally{
    registering=false;
    await refresh();
  }
};
$('disconnect').onclick=async()=>{await msg('DISCONNECT_REMOTE');await refresh()};
$('reload').onclick=async()=>{const r=await msg('RELOAD');if(!r.ok)alert(r.error||'No se pudo recargar');await refresh()};
$('back').onclick=async()=>{const r=await msg('GO_BACK');if(!r.ok)alert(r.error||'No se pudo volver');await refresh()};
$('forward').onclick=async()=>{const r=await msg('GO_FORWARD');if(!r.ok)alert(r.error||'No se pudo avanzar');await refresh()};
refresh();
setInterval(refresh,3000);