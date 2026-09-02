(function(){'use strict';
const q=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let last='';
function api(){return window.__RI_ADMIN?.api}
function data(){const box=q('#riLinkManager');if(!box)return null;const rows=[...box.querySelectorAll('tbody tr')];return rows.length?rows:null}
function decorate(){const box=q('#riLinkManager');if(!box)return;const table=box.querySelector('table');if(!table)return;const rows=[...table.querySelectorAll('tbody tr')].filter(r=>r.querySelector('td')&&r.children.length>=6);
 rows.forEach(r=>{if(r.dataset.pro)return;r.dataset.pro='1';const action=r.lastElementChild;if(!action)return;const revoke=action.querySelector('[data-ri="revoke"]');if(revoke){const b=document.createElement('button');b.className='btn mini';b.textContent='Nuevo link';b.dataset.pro='regen';b.dataset.clientName=r.children[0]?.innerText||'Cliente';b.dataset.deviceName=r.children[1]?.innerText||'Navegador';b.title='Generar un nuevo link para este cliente y equipo';action.appendChild(document.createTextNode(' '));action.appendChild(b)}});
 const head=table.querySelector('thead tr');if(head&&!head.dataset.pro){head.dataset.pro='1';const th=document.createElement('th');th.textContent='Gestión';head.appendChild(th);rows.forEach(r=>{const td=document.createElement('td');td.dataset.procell='1';td.innerHTML='<span class="muted">Link individual</span>';r.appendChild(td)})}
 const stats=box.querySelector('.riLinkCount');if(stats&&!stats.dataset.pro){stats.dataset.pro='1';const note=document.createElement('span');note.className='riProNote';note.textContent=' · sin límite de clientes, equipos ni links';stats.appendChild(note)}
}
async function regen(b){const apiFn=api();if(!apiFn){alert('Control Center no está listo.');return}const client=q('#riLinkClient')?.value||'';const device=q('#riLinkDevice')?.value||'';if(!client||!device){alert('Para generar un nuevo link, selecciona el cliente y el navegador en los filtros.');return}const label=(q('#riLinkLabel')?.value||'').trim()||b.dataset.clientName||'Cliente';b.disabled=true;const old=b.textContent;b.textContent='Generando…';try{const r=await apiFn({action:'create_link',client_id:client,device_id:device,label,base_url:location.origin});if(!r?.ok)throw new Error(r?.error||'No se pudo generar el link.');if(window.__RI_ADMIN?.refresh)await window.__RI_ADMIN.refresh();setTimeout(decorate,300)}catch(e){alert(e.message||'No se pudo generar el link.')}finally{b.disabled=false;b.textContent=old}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-pro="regen"]');if(b)regen(b)});
const boot=()=>{const sig=q('#riLinkManager');if(!sig)return;const key=(sig.innerText||'').slice(0,500);if(key!==last){last=key;decorate()}else decorate()};
new MutationObserver(()=>setTimeout(boot,30)).observe(document.documentElement,{childList:true,subtree:true});setInterval(boot,1500);setTimeout(boot,1200);
})();
