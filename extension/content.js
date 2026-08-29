(()=>{
 if(window.__reyInkLoaded)return; window.__reyInkLoaded=true;
 const state={enabled:false,intervalMinutes:16,waitSeconds:25,next:0,phase:'WAIT_BUMP',waitUntil:0};
 const norm=s=>(s||'').replace(/\s+/g,' ').trim().toLowerCase();
 function find(labels){return [...document.querySelectorAll('button,a,input[type=button],input[type=submit]')].find(el=>{const t=norm(el.innerText||el.value||el.textContent);return labels.some(x=>t===x||t.includes(x))});}
 const box=document.createElement('div'); box.id='rey-ink-panel';
 box.innerHTML='<div class="ri-head"><b>👑 Rey ink</b><span id="ri-dot">●</span></div><div class="ri-sub">Actualizador</div><div id="ri-state">DETENIDO</div><div id="ri-time">PAUSADO</div><div id="ri-phase">Esperando</div><button id="ri-bump">⚡ BUMP TO TOP</button><button id="ri-my">MY POSTS</button><div class="ri-note">16 min → BUMP → 20–30 s → MY POSTS. No modifica CAPTCHA ni inicia sesión.</div>';
 document.documentElement.appendChild(box);
 const $=id=>document.getElementById(id);
 function setText(stateText,timeText,phase){$('ri-state').textContent=stateText;$('ri-time').textContent=timeText;$('ri-phase').textContent=phase;}
 async function cfg(){return chrome.storage.local.get({enabled:false,intervalMinutes:16,waitSeconds:25});}
 function scheduleBump(){state.phase='WAIT_BUMP';state.next=Date.now()+state.intervalMinutes*60000;state.waitUntil=0;}
 function scheduleMyPosts(){const base=Math.max(20,Math.min(30,Number(state.waitSeconds)||25));const extra=Math.floor(Math.random()*(31-base));state.phase='WAIT_MY';state.waitUntil=Date.now()+(base+extra)*1000;state.next=state.waitUntil;}
 function clickSite(labels){const b=find(labels);if(!b)return false;b.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>{try{b.click()}catch(e){}},350);return true;}
 async function tick(){if(!state.enabled){setText('DETENIDO','PAUSADO','Esperando');return;}
  if(state.phase==='WAIT_BUMP'){
   const left=Math.max(0,state.next-Date.now());setText('ACTIVO',fmt(left),'Próximo BUMP');
   if(left<=0){if(clickSite(['bump to top'])){setText('BUMP EJECUTADO','20–30 s','Esperando MY POSTS');scheduleMyPosts();}else setText('BUMP NO ENCONTRADO','Reintentando…','Busca BUMP TO TOP');}
  } else if(state.phase==='WAIT_MY'){
   const left=Math.max(0,state.waitUntil-Date.now());setText('ACTIVO',fmt(left),'Esperando MY POSTS');
   if(left<=0){if(clickSite(['my posts','my post'])){setText('MY POSTS EJECUTADO','16:00','Reiniciando ciclo');scheduleBump();}else setText('MY POSTS NO ENCONTRADO','Reintentando…','Busca MY POSTS');}
  }
 }
 function fmt(ms){const sec=Math.ceil(ms/1000);return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;}
 async function sync(){const c=await cfg();state.enabled=!!c.enabled;state.intervalMinutes=Math.max(1,Number(c.intervalMinutes)||16);state.waitSeconds=Math.max(20,Math.min(30,Number(c.waitSeconds)||25));if(!state.enabled){state.next=0;state.waitUntil=0;state.phase='WAIT_BUMP';}else if(!state.next||(!state.waitUntil&&state.next<Date.now()-1000)){scheduleBump();}await tick();}
 $('ri-bump').onclick=()=>{if(!state.enabled)return;const ok=clickSite(['bump to top']);if(ok){scheduleMyPosts();setText('BUMP EJECUTADO','20–30 s','Esperando MY POSTS');}};
 $('ri-my').onclick=()=>{if(!state.enabled)return;const ok=clickSite(['my posts','my post']);if(ok){scheduleBump();setText('MY POSTS EJECUTADO','16:00','Reiniciando ciclo');}};
 sync();setInterval(tick,1000);chrome.storage.onChanged.addListener(sync);
})();
