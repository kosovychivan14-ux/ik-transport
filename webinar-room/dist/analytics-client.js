const sessionId=crypto.randomUUID();
const startedAt=Date.now();
let visibleStarted=document.visibilityState==='visible'?Date.now():null,visibleMs=0,lastProgressSent=0;
function watched(){return Math.floor((visibleMs+(visibleStarted?Date.now()-visibleStarted:0))/1000);}
function payload(eventType,extra={}){return JSON.stringify({eventType,sessionId,watchSeconds:watched(),...extra});}
function send(eventType,extra={},beacon=false){const body=payload(eventType,extra);if(beacon&&navigator.sendBeacon){navigator.sendBeacon('/api/analytics/events',new Blob([body],{type:'application/json'}));return;}fetch('/api/analytics/events',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body,keepalive:true}).catch(()=>{});}
function section(){return location.hash.slice(1)||'room';}
send('room_open',{section:section()});
setInterval(()=>{if(document.visibilityState==='visible')send('heartbeat',{section:section()});},20000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){if(visibleStarted){visibleMs+=Date.now()-visibleStarted;visibleStarted=null;}send('heartbeat',{section:section()},true);}else visibleStarted=Date.now();});
window.addEventListener('hashchange',()=>send('section_view',{section:section()}));
window.addEventListener('pagehide',()=>send('room_close',{section:section()},true));
const video=document.getElementById('recording-video');
video?.addEventListener('play',()=>send('recording_start',{recordingId:video.dataset.recordingId||'',positionSeconds:video.currentTime}));
video?.addEventListener('pause',()=>{if(!video.ended)send('recording_pause',{recordingId:video.dataset.recordingId||'',positionSeconds:video.currentTime});});
video?.addEventListener('timeupdate',()=>{if(video.currentTime-lastProgressSent>=15){lastProgressSent=video.currentTime;send('recording_progress',{recordingId:video.dataset.recordingId||'',positionSeconds:video.currentTime});}});
video?.addEventListener('ended',()=>send('recording_end',{recordingId:video.dataset.recordingId||'',positionSeconds:video.currentTime}));
window.addEventListener('webinar:question',event=>send('question',{label:event.detail?.text||''}));
window.addEventListener('webinar:cta-click',event=>send('cta_click',{label:event.detail?.label||''}));
