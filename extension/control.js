const $=id=>document.getElementById(id);
const msg=(type,data={})=>new Promise(r=>chrome.runtime.sendMessage({type,...data},x=>r(x||{ok:false,error:chrome.runtime.lastError?.message||'Error'})));
const BRIDGE='https://rnduuuiskfuikzuepvnw.supabase.co/functions/v1/rey-ink-bridge';
async function bridge(body){
  const r=await fetch(BRIDGE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const j=await r.json().catch(()=>({error:'Respuesta inválida del servidor'}));
  if(!r.ok||j.ok===false)throw Error(j.error||`HTTP ${r.status}`);
  return j;
}
async function refresh(){
  const s=await msg('GET_STATE');
  const connected=!!s?.relayStatus?.connected&&!!s?.remote?.enabled;
  $('status').textContent=connected?'🟢 CONECTADO · Navegador '+(s.remote.number||''):'🟠 SIN CONECTAR';
  $('status').className='status '+(connected?'ok':'err');
  $('tab').textContent=(s.title||'Sin pestaña')+'\n'+(s.url||'');
}
let pairTimer=null;
async function startPairing(){
  try{
    if(pairTimer)clearInterval(pairTimer);
    const g=await chrome.storage.local.get(['reyInkInstallationId']);
    const installationId=g.reyInkInstallationId||crypto.randomUUID();
    await chrome.storage.local.set({reyInkInstallationId:installationId});
    const r=await bridge({action:'begin_pairing',installation_id:installationId});
    $('pairCode').style.display='block';
    $('pairCode').textContent=String(r.pairing_code||'------');
    $('pairStatus').textContent='⏳ Esperando que el administrador introduzca el código…';
    pairTimer=setInterval(async()=>{
      try{
        const s=await bridge({action:'pair_status',installation_id:installationId});
        if(s.status==='paired'){
          clearInterval(pairTimer);pairTimer=null;
          await chrome.storage.local.set({reyInkPairing:{paired:true,deviceId:s.device_id,token:s.pc_token,number:s.number,installationId}});
          const saved=await msg('SET_PAIRING',{deviceId:s.device_id,token:s.pc_token,number:s.number,installationId});
          $('pairStatus').textContent=saved.ok?'🟢 Navegador emparejado. Ya puedes conectarlo.':'⚠ Emparejado, pero no se pudo guardar la conexión.';
          await refresh();
        }
      }catch(e){}
    },1500);
  }catch(e){
    $('pairCode').style.display='block';
    $('pairCode').textContent='------';
    $('pairStatus').textContent='⚠ '+(e?.message||'No se pudo contactar al servidor');
  }
}
$('pair').onclick=startPairing;
$('connect').onclick=async()=>{
  const r=await msg('REGISTER_REMOTE');
  $('status').textContent=r.ok?'🟢 CONECTADO · Navegador '+(r.number||''):'⚠ '+(r.error||'Error');
  await refresh();
};
$('disconnect').onclick=async()=>{await msg('DISCONNECT_REMOTE');refresh()};
$('reload').onclick=async()=>{await msg('RELOAD');refresh()};
$('back').onclick=async()=>{await msg('GO_BACK');refresh()};
$('forward').onclick=async()=>{await msg('GO_FORWARD');refresh()};
refresh();setInterval(refresh,3000);