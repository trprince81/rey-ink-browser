(function(){'use strict';
const qs=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let links=[], history=[], filterClient='';
async function call(body){
  for(let i=0;i<30;i++){
    if(window.__RI_ADMIN?.api) return window.__RI_ADMIN.api(body);
    await new Promise(r=>setTimeout(r,250));
  }
  throw new Error('Control Center no está listo.');
}
function normalizeData(x){
  const d=x?.data||x?.result||x||{};
  return {links:Array.isArray(d.links)?d.links:[],clients:Array.isArray(d.clients)?d.clients:[],history:Array.isArray(d.history)?d.history:[]};
}
async function load(){
  try{
    const [dr,hr]=await Promise.all([call({action:'getData'}),call({action:'history'})]);
    const d=normalizeData(dr); links=d.links; history=Array.isArray(hr?.history)?hr.history:(Array.isArray(hr?.data)?hr.data:[]);
    render(d.clients||[]);
  }catch(e){render([],[],e.message)}
}
function render(clients=[],_,err=''){
  const sec=qs('#links'); if(!sec)return;
  let box=qs('#riLinkManager');
  if(!box){
    box=document.createElement('div'); box.id='riLinkManager';
    sec.prepend(box);
  }
  const active=links.filter(x=>x.active!==false);
  const shown=filterClient?links.filter(x=>String(x.client_id||'')===filterClient):links;
  box.innerHTML=`<div class="riLinkPanel">
    <div class="riLinkHead"><div><div class="riLinkTitle">Administración de links</div><div class="riLinkSub">Genera, consulta y revoca los links individuales de tus clientes.</div></div><div class="riLinkCount"><b>${active.length}</b> activos</div></div>
    ${err?`<div class="riLinkErr">${esc(err)}</div>`:''}
    <div class="riLinkTools"><select id="riLinkClient"><option value="">Todos los clientes</option>${clients.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===filterClient?'selected':''}>${esc(c.name||'Cliente')}</option>`).join('')}</select><button class="btn" data-ri="refresh">↻ Actualizar links</button></div>
    <div class="riLinkTableWrap"><table class="table"><thead><tr><th>Cliente</th><th>Link</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead><tbody>${shown.length?shown.map((l,i)=>{
      const name=l.label||l.client_name||'Cliente'; const url=l.url||l.link||l.href||((location.origin||'')+'/?d='+encodeURIComponent(l.token||''));
      const id=l.id||''; const active=l.active!==false;
      return `<tr><td><b>${esc(name)}</b></td><td><div class="riLinkUrl">${esc(url)}</div></td><td>${active?'<span class="green">● Activo</span>':'<span class="red">● Revocado</span>'}</td><td>${l.created_at?esc(new Date(l.created_at).toLocaleString()):'—'}</td><td><button class="btn mini" data-ri="copy" data-url="${esc(url)}">Copiar</button> ${active&&id?`<button class="btn mini danger" data-ri="revoke" data-id="${esc(id)}">Revocar</button>`:''}</td></tr>`;
    }).join(''):`<tr><td colspan="5" class="empty">No hay links registrados.</td></tr>`}</tbody></table></div>
    <div class="riActivity"><div class="riLinkTitle">Actividad de links</div><div class="riLinkSub">Historial relacionado con generación y revocación.</div><div class="riEvents">${renderHistory()}</div></div>
  </div>`;
}
function renderHistory(){
  let h=history.filter(x=>!filterClient||String(x.client_id||x.metadata?.client_id||'')===filterClient);
  if(!h.length)return '<div class="empty">No hay actividad para este filtro.</div>';
  return h.slice(0,100).map(x=>`<div class="riEvent"><div><b>${esc(x.action||x.event||'Actividad')}</b> <span>${esc(x.label||x.target_name||x.entity_id||'')}</span></div><small>${x.created_at?esc(new Date(x.created_at).toLocaleString()):''}</small></div>`).join('');
}
document.addEventListener('change',e=>{if(e.target.id==='riLinkClient'){filterClient=e.target.value||'';render([])}});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-ri]'); if(!b)return;
 if(b.dataset.ri==='refresh'){load();return}
 if(b.dataset.ri==='copy'){try{await navigator.clipboard.writeText(b.dataset.url||'');b.textContent='Copiado ✓';setTimeout(()=>b.textContent='Copiar',1200)}catch(_){alert('No se pudo copiar el link.');}return}
 if(b.dataset.ri==='revoke'){
   if(!confirm('¿Revocar este link? El link dejará de estar activo.'))return;
   b.disabled=true;
   try{await call({action:'delete_link',link_id:b.dataset.id});await load();if(window.__RI_ADMIN?.refresh)await window.__RI_ADMIN.refresh();}
   catch(err){alert(err.message||'No se pudo revocar el link.');b.disabled=false;}
 }
});
const boot=()=>{if(qs('#links'))load()};
new MutationObserver(boot).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(boot,800);
})();
