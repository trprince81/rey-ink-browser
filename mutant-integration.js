(()=>{
  const style=document.createElement('style');
  style.textContent=`
  .mutant-tab{position:relative;color:#39ff88!important;border-color:#245d3d!important;background:linear-gradient(90deg,#0c2016,#0a120d)!important;box-shadow:0 0 18px #39ff8812!important}
  .mutant-tab:hover{border-color:#39ff88!important;box-shadow:0 0 24px #39ff8820!important}
  .mutant-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#39ff88;box-shadow:0 0 10px #39ff88;margin-right:7px;vertical-align:middle}
  #mutantOverlay{position:fixed;inset:0;z-index:99999;display:none;background:#020403e8;backdrop-filter:blur(9px);padding:24px}
  #mutantOverlay.open{display:flex;align-items:center;justify-content:center}
  #mutantShell{width:min(1500px,96vw);height:min(900px,94vh);border:1px solid #245d3d;border-radius:20px;overflow:hidden;background:#050708;box-shadow:0 0 80px #39ff8818,0 25px 90px #000}
  #mutantTop{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:#080d0a;border-bottom:1px solid #1d3025;color:#f2fff7;font-weight:900}
  #mutantTop strong{color:#39ff88;letter-spacing:1px}
  #mutantClose{border:1px solid #294333;background:#0d1611;color:#fff;border-radius:9px;padding:7px 11px;cursor:pointer;font-weight:900}
  #mutantFrame{width:100%;height:calc(100% - 48px);border:0;background:#050708}
  `;
  document.head.appendChild(style);

  const findTabs=()=>document.querySelector('.tabs');
  const tabs=findTabs();
  if(tabs && !document.getElementById('mutantTab')){
    const b=document.createElement('button');
    b.id='mutantTab';b.className='tab mutant-tab';b.type='button';
    b.innerHTML='<span class="mutant-dot"></span>MUTANT';
    b.title='Centro de control de licencias y límites Mutant';
    b.onclick=()=>window.__openMutant();
    tabs.appendChild(b);
  }

  const overlay=document.createElement('div');overlay.id='mutantOverlay';
  overlay.innerHTML='<div id="mutantShell"><div id="mutantTop"><strong>⬢ MUTANT — CONTROL DE LICENCIAS</strong><button id="mutantClose">Cerrar ×</button></div><iframe id="mutantFrame" src="/mutant.html" title="Mutant License Center"></iframe></div>';
  document.body.appendChild(overlay);
  window.__openMutant=()=>overlay.classList.add('open');
  const close=()=>overlay.classList.remove('open');
  document.getElementById('mutantClose').onclick=close;
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))close()});
})();
