let recording=false;
function send(type,payload={}){try{chrome.runtime.sendMessage({type,...payload})}catch{}}
document.addEventListener('click',e=>{if(!recording)return;if(e.isTrusted===false)return;const x=e.clientX/Math.max(1,innerWidth),y=e.clientY/Math.max(1,innerHeight);send('AUTO_CLICK_RECORDED',{x,y,url:location.href,title:document.title})},true);
chrome.runtime.onMessage.addListener(m=>{if(m.type==='AUTO_RECORD_START'){recording=true}if(m.type==='AUTO_RECORD_STOP'){recording=false}});