(() => {
  if (window.top !== window.self) return;
  const BRIDGE='https://rnduuuiskfuikzuepvnw.supabase.co/functions/v1/rey-ink-bridge';
  const KEY='reyInkBotState';
  const DEFAULT={active:false,min:15,max:15,nextAt:0,lastBumpAt:0,postId:null,lastMessage:'Listo'};
  let state={...DEFAULT,...(JSON.parse(localStorage.getItem(KEY)||'{}'))};
  let timer=null, countdown=null, busy=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
  const norm=(s)=>String(s||'').trim();
  function postId(){
    const links=[...document.querySelectorAll('a[href*="/users/posts/"]')];
    for(const a of links){const h=a.href||'';const m=h.match(/(?:post|edit|id)[=\/](\d+)/i);if(m)return m[1];}
    const html=document.documentElement?.innerHTML||'';
    const m=html.match(/(?:postId|post_id|externalPostId)["'\s:=]+["']?(\d{3,})/i);
    return m?m[1]:null;
  }
  function bumpButton(){
    return document.querySelector('#managePublishAd,[id*="managePublishAd"]') || [...document.querySelectorAll('button,a,input[type="button"]')].find(e=>/bump\s*to\s*top/i.test(norm(e.textContent||e.value)));
  }
  function myPosts(){return document.querySelector('a[href^="https://megapersonals.eu/users/posts/list"],a[href*="/users/posts/list"]');}
  async function api(action,body={}){
    const s=await chrome.storage.local.get('reyInkRemote');
    if(!s?.reyInkRemote?.token) throw Error('Navegador no emparejado.');
    const r=await fetch(BRIDGE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,token:s.reyInkRemote.token,...body}),cache:'no-store'});
    const d=await r.json().catch(()=>({error:'Respuesta inválida'}));
    if(!r.ok||d.ok===false) throw Error(d.error||`HTTP ${r.status}`); return d;
  }
  async function licenseOk(id){
    try{const d=await api('license_status',{externalPostId:id||undefined});return !!(d?.subscription?.isActive||d?.deviceLicense?.isActive||d?.allowed);}catch{return false;}
  }
  async function report(type,message){try{await api('heartbeat',{state:{botActive:state.active,botEvent:type,message,externalPostId:state.postId,url:location.href,title:document.title}})}catch{}}
  function schedule(){
    const min=Math.max(1,Number(state.min)||15),max=Math.max(min,Number(state.max)||min);
    const ms=(Math.floor(Math.random()*(max-min+1))+min)*60000;
    state.nextAt=Date.now()+ms;save();
    if(timer)clearTimeout(timer);
    timer=setTimeout(cycle,ms);
  }
  function render(){
    let p=document.getElementById('rey-ink-bot-panel');
    if(!p){p=document.createElement('div');p.id='rey-ink-bot-panel';p.innerHTML=`<div class="ri-head"><b>👑 Rey Ink</b><span id="ri-dot">●</span></div><div id="ri-state">BOT PAUSADO</div><div class="ri-post" id="ri-post">Post: —</div><div class="ri-time" id="ri-time">--:--</div><div class="ri-actions"><button id="ri-power">▶ Activar</button><button id="ri-cfg">⚙ Config</button></div><div class="ri-msg" id="ri-msg">Listo</div>`;document.documentElement.appendChild(p);
      const st=document.createElement('style');st.textContent=`#rey-ink-bot-panel{position:fixed!important;right:18px!important;bottom:18px!important;width:250px!important;z-index:2147483647!important;background:#09070f!important;color:#fff!important;border:1px solid #362050!important;border-radius:16px!important;padding:14px!important;font:13px system-ui!important;box-shadow:0 10px 35px #0008!important}#rey-ink-bot-panel button{border:0;border-radius:9px;padding:9px;background:#7b32f5;color:#fff;font-weight:700;cursor:pointer;width:48%}.ri-head{display:flex;justify-content:space-between;font-size:16px}.ri-head span{color:#777}.ri-head span.on{color:#4cff9a}.ri-post,.ri-msg{color:#aaa;margin:8px 0}.ri-time{font-size:27px;font-weight:900;margin:8px 0}.ri-actions{display:flex;gap:8px}.ri-actions button:last-child{background:#21182d}`;document.head?.appendChild(st);
      document.getElementById('ri-power').onclick=()=>setActive(!state.active);
      document.getElementById('ri-cfg').onclick=()=>config();
    }
    const dot=document.getElementById('ri-dot'),st=document.getElementById('ri-state'),tm=document.getElementById('ri-time'),po=document.getElementById('ri-post'),msg=document.getElementById('ri-msg'),btn=document.getElementById('ri-power');
    if(!st)return;dot.classList.toggle('on',state.active);st.textContent=state.active?'BOT ACTIVO':'BOT PAUSADO';btn.textContent=state.active?'⏸ Pausar':'▶ Activar';po.textContent='Post: '+(state.postId?'#'+state.postId:'—');msg.textContent=state.lastMessage||'Listo';
    const left=Math.max(0,(state.nextAt||0)-Date.now()),s=Math.ceil(left/1000);tm.textContent=left?`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`:'00:00';
  }
  function config(){const a=prompt('Intervalo mínimo (minutos):',String(state.min));if(a===null)return;const b=prompt('Intervalo máximo (minutos):',String(state.max));if(b===null)return;state.min=Math.max(1,Number(a)||15);state.max=Math.max(state.min,Number(b)||state.min);save();state.lastMessage=`Intervalo ${state.min}-${state.max} min`;if(state.active)schedule();render();}
  async function setActive(on){
    if(on){state.postId=postId();if(!state.postId){state.lastMessage='No se pudo identificar el post.';save();render();return}if(!(await licenseOk(state.postId))){state.active=false;state.lastMessage='Licencia no activa para este post.';save();render();return}state.active=true;state.lastMessage='Bot iniciado';save();await report('bot_start','Bot iniciado');schedule();}
    else{state.active=false;if(timer)clearTimeout(timer);state.nextAt=0;state.lastMessage='Bot pausado';save();await report('bot_stop','Bot pausado');}
    render();
  }
  async function cycle(){
    if(busy||!state.active)return;
    busy=true;
    try{
      state.postId=postId()||state.postId;
      if(!(await licenseOk(state.postId))){state.active=false;state.lastMessage='Licencia inactiva';save();await report('license_stop','Licencia inactiva');render();return;}
      let btn=bumpButton();
      if(!btn){const mp=myPosts();if(mp){state.lastMessage='Navegando a My Posts…';save();render();mp.click();return}state.lastMessage='No se encontró Bump to Top ni My Posts.';save();await report('selector_error',state.lastMessage);schedule();render();return}
      if(btn.disabled){state.lastMessage='Bump temporalmente bloqueado.';save();schedule();render();return}
      btn.click();state.lastBumpAt=Date.now();state.lastMessage='Bump ejecutado';save();await report('bump','Bump ejecutado');
      await sleep(1200);
      if(/captcha|too many requests|error|failed|denied/i.test(document.body?.innerText||'')){state.active=false;state.lastMessage='Bump detenido: se detectó CAPTCHA/error.';save();await report('bump_error',state.lastMessage);render();return}
      const mp=myPosts();if(mp){state.lastMessage='Bump OK · volviendo a My Posts…';save();render();mp.click();return}
      schedule();render();
    }catch(e){state.lastMessage=e?.message||'Error';save();await report('error',state.lastMessage);schedule();render();}finally{busy=false;}
  }
  chrome.runtime.onMessage.addListener((m,s,send)=>{(async()=>{if(m.type==='REYINK_BOT_START')return setActive(true).then(()=>({ok:true}));if(m.type==='REYINK_BOT_STOP')return setActive(false).then(()=>({ok:true}));if(m.type==='REYINK_BOT_CONFIG'){state.min=Number(m.min)||15;state.max=Math.max(state.min,Number(m.max)||state.min);save();if(state.active)schedule();render();return{ok:true}}if(m.type==='REYINK_BOT_STATE'){return{ok:true,state}}return{ok:false}})().then(send);return true});
  function boot(){render();if(state.active){state.postId=postId()||state.postId;licenseOk(state.postId).then(ok=>{if(!ok){state.active=false;state.lastMessage='Licencia inactiva';save();render()}else if(state.nextAt>Date.now()){if(timer)clearTimeout(timer);timer=setTimeout(cycle,state.nextAt-Date.now())}else cycle()})}countdown=setInterval(render,1000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  document.addEventListener('click',e=>{if(!window.__reyInkRecording)return;if(e.isTrusted===false)return;chrome.runtime.sendMessage({type:'AUTO_CLICK_RECORDED',x:e.clientX/Math.max(1,innerWidth),y:e.clientY/Math.max(1,innerHeight),url:location.href,title:document.title})},true);
})();