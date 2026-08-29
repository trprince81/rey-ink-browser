const API='https://rey-ink-browser.vercel.app/api/rey-ink';
let rtc=null,dc=null,pcSlot=null,session=null,stream=null;
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function post(action,body){const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...body}),cache:'no-store'});const d=await r.json();if(!r.ok||d.ok===false)throw Error(d.error||('HTTP '+r.status));return d}
async function waitIce(){if(rtc.iceGatheringState==='complete')return;await new Promise(resolve=>{const f=()=>{if(rtc.iceGatheringState==='complete'){rtc.removeEventListener('icegatheringstatechange',f);resolve()}};rtc.addEventListener('icegatheringstatechange',f);setTimeout(resolve,8000)})}
async function host(streamId,slot,sess,token){
 pcSlot=slot;session=sess;
 stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:streamId}}});
 rtc=new RTCPeerConnection(ICE);stream.getTracks().forEach(t=>rtc.addTrack(t,stream));
 dc=rtc.createDataChannel('control',{ordered:true});dc.onopen=()=>chrome.runtime.sendMessage({action:'WEBRTC_STATUS',connected:true});dc.onmessage=e=>{try{const evt=JSON.parse(e.data);chrome.runtime.sendMessage(evt)}catch{}};
 rtc.onconnectionstatechange=()=>chrome.runtime.sendMessage({action:'WEBRTC_STATUS',state:rtc.connectionState});
 const offer=await rtc.createOffer();await rtc.setLocalDescription(offer);await waitIce();
 await post('webrtc_offer',{pc_slot:pcSlot,session,token,offer:rtc.localDescription});
 for(let i=0;i<60;i++){const r=await fetch(API+'?action=webrtc_answer&pc_slot='+pcSlot+'&session='+encodeURIComponent(session),{cache:'no-store'});const d=await r.json();if(d.answer){await rtc.setRemoteDescription(d.answer);return {ok:true}}await sleep(500)}
 throw Error('El teléfono no respondió al enlace WebRTC.');
}
chrome.runtime.onMessage.addListener((m,s,r)=>{if(m?.action==='WEBRTC_HOST'){(async()=>{const x=await chrome.storage.local.get('reyInkRemote'),d=x.reyInkRemote||{};if(!d.session||!d.token)throw Error('Sesión Rey Ink no disponible.');return host(m.streamId,d.pcSlot,d.session,d.token)})().then(r).catch(e=>r({ok:false,error:String(e.message||e)}));return true}return false});
