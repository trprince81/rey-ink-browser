(function(){'use strict';
const q=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
function linkUrl(raw){const s=String(raw||'').trim();return /^https?:\/\//i.test(s)?s:(location.origin+'/?d='+encodeURIComponent(s));}
function decorate(){const t=q('#linksTable');if(!t)return;const head=t.querySelector('thead tr');if(head&&!head.querySelector('.riLinkActionsHead')){const th=document.createElement('th');th.className='riLinkActionsHead';th.textContent='Administrar';head.append(th)}
 t.querySelectorAll('tbody tr').forEach(tr=>{if(tr.querySelector('.riStableLinkActions'))return;const cells=tr.querySelectorAll('td');if(!cells.length)return;const code=tr.querySelector('code');const raw=code?.textContent?.trim()||'';const client=(cells[0]?.textContent||'Cliente').trim();const td=document.createElement('td');td.className='riStableLinkActions';td.innerHTML='<div class="riLinkButtons"><button type="button" class="btn mini" data-ri-stable="copy" data-url="'+esc(linkUrl(raw))+'">Copiar</button><button type="button" class="btn mini" data-ri-stable="open" data-url="'+esc(linkUrl(raw))+'">Abrir</button><button type="button" class="btn mini" data-ri-stable="activity" data-client="'+esc(client)+'">Actividad</button></div>';tr.append(td)});
}
function glass(){
 const s=document.getElementById('ri-glass-override')||document.createElement('style');s.id='ri-glass-override';s.textContent=`
html,body{background:transparent!important;background-color:transparent!important}
body:before{opacity:.12!important}
.hero{background:rgba(7,9,16,.38)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important}
.tabs{background:rgba(8,10,17,.42)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important}
.section,.toolbar,.card,.table,.table th,.detail,.detailCard,.pair,.linkbox,#status,.history,.event{background-color:rgba(8,10,18,.38)!important;backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important}
.card{background:linear-gradient(145deg,rgba(12,15,25,.46),rgba(9,11,19,.38))!important}
`;if(!s.parentNode)document.head.append(s);
 const bg=document.getElementById('ri-background-layer');if(bg){bg.style.setProperty('z-index','-1','important');bg.style.setProperty('opacity','1','important')}
}
function persistMutantAdmin(){
 const key=q('#adminKey');if(!key)return;
 const K='rey_ink_mutant_admin_key';
 if(!key.dataset.riPersist){key.dataset.riPersist='1';const saved=localStorage.getItem(K);if(saved&&!key.value)key.value=saved;
 const save=()=>{const v=key.value.trim();if(v)localStorage.setItem(K,v)};key.addEventListener('change',save);key.addEventListener('blur',save);key.addEventListener('keydown',e=>{if(e.key==='Enter')save()});
 const form=key.closest('form');if(form)form.addEventListener('submit',save);
 }
}
function nav(){document.addEventListener('click',e=>{const n=e.target.closest('.riPanelLink');if(n){const p=n.closest('.riPanel');const map=[['riBrowsers','browsers'],['riLicenses','licenses'],['riActivity','history'],['riLinks','links'],['riClients','clients']];const hit=map.find(x=>p?.classList.contains(x[0]));if(hit){e.preventDefault();document.querySelector('.tab[data-tab="'+hit[1]+'"]')?.click()}return}
 const b=e.target.closest('[data-ri-stable]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const act=b.dataset.riStable;if(act==='copy'){const url=b.dataset.url||'';const done=()=>{const old=b.textContent;b.textContent='Copiado ✓';setTimeout(()=>b.textContent=old||'Copiar',1200)};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url).then(done).catch(()=>fallback(url,done));else fallback(url,done);return}if(act==='open'){window.open(b.dataset.url||'','_blank','noopener,noreferrer');return}if(act==='activity'){document.querySelector('.tab[data-tab="history"]')?.click();setTimeout(()=>{const box=q('#historyList');const term=(b.dataset.client||'').toLowerCase();box?.querySelectorAll('.event').forEach(x=>x.style.display=(x.textContent||'').toLowerCase().includes(term)?'':'none')},150)}});}
function fallback(text,done){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.append(ta);ta.select();try{document.execCommand('copy');done()}finally{ta.remove()}}
function boot(){decorate();glass();persistMutantAdmin();nav();setInterval(function(){decorate();glass();persistMutantAdmin()},1500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();