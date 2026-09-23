import {LiveConnection,liveRequest} from './live-connection.js';
import {createRoomClock,formatRoomTime} from './room-clock.js';
import {createAudienceActivity} from './audience-activity.js';
const $=id=>document.getElementById(id),clock=createRoomClock();
let configured=false,connectionState='idle',videoAvailable=false,presenterEnded=false,manualLeft=false,automaticAttempted=false,audioEnabled=false,detail='',active=true,polling=false,pollTimer=0,tickTimer=0,audienceCount=0,audienceParticipants=[];
let activityCount=0,activityParticipants=[];
const tracks=new Set();
const activity=createAudienceActivity({onChange({count,participants}){activityCount=count;activityParticipants=participants;render();}});
const labels={waiting:['ОЧІКУВАННЯ','ПРЯМА ПРЕЗЕНТАЦІЯ','Очікуємо початку ефіру','Відео з’явиться тут, коли ведучий розпочне трансляцію.'],connecting:['ПІДКЛЮЧЕННЯ','ПРЯМА ПРЕЗЕНТАЦІЯ','Приєднуємося до кімнати','Зачекайте мить — готуємо перегляд.'],live:['ПРЯМИЙ ЕФІР'],reconnecting:['ВІДНОВЛЕННЯ ЗВ’ЯЗКУ','ПОВЕРТАЄМОСЯ ДО ЕФІРУ','Відновлюємо з’єднання','Не закривайте кімнату. Перегляд продовжиться після відновлення зв’язку.'],ended:['ЕФІР ЗАВЕРШЕНО','ДЯКУЄМО ЗА УЧАСТЬ','Ведучий завершив ефір','Інформація про наступні зустрічі з’явиться у розкладі.'],offline:['НЕМАЄ З’ЄДНАННЯ','ПЕРЕВІРТЕ ЗВ’ЯЗОК','Не вдалося підключитися','Перевірте інтернет і натисніть «Приєднатися до ефіру».'],paused:['ВИ ВИЙШЛИ З ЕФІРУ','КІМНАТА УЧАСНИКА','Перегляд зупинено','Натисніть «Приєднатися до ефіру», щоб повернутися.']};
function render(){
  const joined=['connected','reconnecting'].includes(connectionState),busy=['connecting','reconnecting'].includes(connectionState);
  const visual=manualLeft?'paused':connectionState==='connecting'?'connecting':connectionState==='reconnecting'?'reconnecting':['error','disconnected'].includes(connectionState)?'offline':videoAvailable?'live':presenterEnded?'ended':'waiting';
  const copy=labels[visual],stage=document.querySelector('.viewer-stage'),badge=document.querySelector('[data-live-badge]');
  if(stage)stage.dataset.state=visual;
  if(badge){badge.textContent=copy[0];badge.classList.toggle('is-live',visual==='live');}
  for(const [id,index] of [['live-wait-kicker',1],['live-wait-title',2],['live-wait-description',3]])if($(id)&&copy[index])$(id).textContent=copy[index];
  $('live-wait').hidden=visual==='live';
  $('join-live').disabled=!configured||joined||busy;$('join-live').textContent=joined?'Ви в кімнаті':busy?'Підключаємося…':'Приєднатися до ефіру';
  $('leave-live').disabled=!joined&&!busy;$('live-sound').disabled=!joined;
  $('live-sound').textContent=audioEnabled?'Вимкнути звук':'Увімкнути звук';
  $('live-status').textContent=detail||(visual==='live'?'Прямий ефір. Ви бачите трансляцію зі студії.':visual==='waiting'?(joined?'Ви в кімнаті. Відео з’явиться автоматично після початку ефіру.':'Ефір ще не розпочався. Кімната оновлює підключення автоматично.'):copy[3]||'');
  renderAudience(joined);
}
function renderAudience(joined){
  const count=$('live-audience-count'),compact=$('viewer-stage-audience-count'),note=$('live-audience-note'),feed=$('live-audience-feed'),status=$('live-audience-status');
  if(!count||!note||!feed)return;
  const visibleCount=joined?Math.max(audienceCount,activityCount):0,visibleParticipants=joined?[...activityParticipants,...audienceParticipants].filter((person,index,all)=>index===all.findIndex(item=>item.name===person.name)).slice(0,20):[];
  count.textContent=String(visibleCount);
  if(compact)compact.textContent=String(visibleCount);
  note.textContent=joined?'Глядачі приєднуються з різних країн':'Кількість оновиться після підключення до ефіру';
  feed.replaceChildren();
  for(const participant of visibleParticipants){
    const name=String(participant?.name||'').trim();if(!name)continue;
    const row=document.createElement('div');row.className='live-audience-person';row.role='listitem';
    const initials=document.createElement('span');initials.className='live-audience-initials';initials.textContent=name.slice(0,1).toUpperCase();
    const copy=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');
    if(participant.countryCode){const flag=document.createElement('img');flag.className='country-flag';flag.src=`/assets/flags/${participant.countryCode}.svg`;flag.alt=`Прапор: ${participant.country}`;strong.append(flag);}
    const nameText=document.createElement('span');nameText.textContent=name;strong.append(nameText);small.textContent=participant.country?`${participant.country} · у кімнаті`:'у кімнаті';copy.append(strong,small);row.append(initials,copy);feed.append(row);
  }
  if(status)status.textContent=joined?`Зараз дивляться: ${visibleCount}`:'Ви не підключені до ефіру';
}
function clearMedia(){for(const track of tracks)track.detach().forEach(el=>{if(el!==$('live-video'))el.remove();});tracks.clear();videoAvailable=false;$('live-video').srcObject=null;$('live-audio').replaceChildren();}
const connection=new LiveConnection({onState(next,error){connectionState=next;detail=error||'';if(['connected','reconnecting'].includes(next))activity.start();else activity.stop();if(['idle','disconnected','error'].includes(next))clearMedia();render();},onParticipants({count,participants}){audienceCount=count;audienceParticipants=participants;render();},onTrack(track){
  tracks.add(track);detail='';
  if(track.kind==='video'){presenterEnded=false;videoAvailable=true;track.attach($('live-video'));$('live-video').play().catch(()=>{detail='Натисніть «Увімкнути звук», щоб почати перегляд.';render();});}
  else{const element=track.attach();element.autoplay=true;element.muted=!audioEnabled;$('live-audio').append(element);}
  render();
},onTrackRemoved(track){tracks.delete(track);track.detach().forEach(el=>{if(el!==$('live-video'))el.remove();});if(track.kind==='video'){videoAvailable=false;$('live-video').srcObject=null;detail='Ведучий зупинив показ. Чекаємо на продовження.';}render();},onParticipantLeft(){clearMedia();presenterEnded=true;detail='';render();}});
async function join(){manualLeft=false;automaticAttempted=true;detail='';await connection.connect('viewer');}
$('join-live').addEventListener('click',join);
$('leave-live').addEventListener('click',async()=>{manualLeft=true;await connection.disconnect();});
$('live-sound').addEventListener('click',async()=>{try{if(!audioEnabled){await connection.startAudio();await $('live-video').play();}audioEnabled=!audioEnabled;for(const element of $('live-audio').children)element.muted=!audioEnabled;detail='';render();}catch{detail='Натисніть кнопку звуку ще раз, щоб продовжити перегляд.';render();}});
function renderClock(){const parts=formatRoomTime(clock.now());if($('viewer-date')){$('viewer-date').textContent=parts.date;$('viewer-date').dateTime=parts.iso;}if($('viewer-time')){$('viewer-time').textContent=parts.time;$('viewer-time').dateTime=parts.iso;}}
async function poll(){
  if(!active||polling||document.hidden)return;
  polling=true;const started=performance.now();
  try{const status=await liveRequest('status');if(!active)return;configured=!!status.configured;if(connectionState==='error'&&!automaticAttempted){connectionState='idle';detail='';}clock.synchronize(status.serverTime,started);if($('viewer-time-sync'))$('viewer-time-sync').textContent=clock.synchronized?'Час оновлюється автоматично':'Час вашого пристрою';renderClock();render();if(configured&&!automaticAttempted&&!manualLeft)await join();}
  catch{if($('viewer-time-sync'))$('viewer-time-sync').textContent=clock.synchronized?'Годинник працює · перевіряємо зв’язок':'Час вашого пристрою · немає зв’язку';if(!['connected','reconnecting','connecting'].includes(connectionState)&&!manualLeft){connectionState='error';detail='Немає зв’язку з кімнатою. Перевіряємо підключення…';render();}}
  finally{polling=false;clearTimeout(pollTimer);if(active&&!document.hidden)pollTimer=setTimeout(poll,30000);}
}
function tick(){clearTimeout(tickTimer);if(!active||document.hidden)return;renderClock();tickTimer=setTimeout(tick,1000);}
document.addEventListener('visibilitychange',()=>{clearTimeout(pollTimer);clearTimeout(tickTimer);if(!document.hidden){tick();poll();}});
window.addEventListener('pagehide',()=>{active=false;activity.stop();clearTimeout(pollTimer);clearTimeout(tickTimer);connection.disconnect();clearMedia();});
window.addEventListener('pageshow',event=>{if(event.persisted){active=true;automaticAttempted=false;tick();poll();}});
render();tick();poll();
