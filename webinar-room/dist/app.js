import {DEMO_DURATION,clampTime,formatTime,scheduledState} from './timeline.js';
const $ = id => document.getElementById(id);
const slides = [
  {title:'Технології.<br>Можливості.<br><span>Новий погляд.</span>',kicker:'ЗНАЙОМСТВО З КІМНАТОЮ',description:'Простір для ваших презентацій<br>та зустрічей з Іваном Косовичем.',image:'autonomous-car.webp',alt:'Автономний електромобіль із лендингу Івана Косовича',caption:'ВІД ТЕХНОЛОГІЇ ДО РОЗУМІННЯ'},
  {title:'Ваша зустріч.<br>Ваш час.<br><span>Одна кімната.</span>',kicker:'ЗУСТРІЧІ ЗА РОЗКЛАДОМ',description:'Запрошення у Telegram.<br>Презентація — у вашій кімнаті.',image:'ivan-cutout.webp',alt:'Іван Косович, ведучий презентації',caption:'ІВАН КОСОВИЧ · ВЕДУЧИЙ'},
  {title:'Поверніться.<br>Перегляньте.<br><span>Зрозумійте.</span>',kicker:'ПЕРЕГЛЯД У ЗРУЧНИЙ ЧАС',description:'Зупиніться на важливому.<br>Продовжуйте, коли зручно.',image:'autonomous-car.webp',alt:'Електротранспорт із презентації',caption:'ПРЕЗЕНТАЦІЇ, ДО ЯКИХ МОЖНА ПОВЕРТАТИСЯ'}
];
let state = {mode:'recording',position:0,playing:false,anchor:0,startAt:null,fileUrl:null};
let lastSlide=-1,toastTimer;
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},4500);}
function renderPosition(){
  $('progress').value=state.position;$('current-time').textContent=formatTime(state.position);
  const slideIndex=Math.min(2,Math.floor(state.position/10));
  if(slideIndex!==lastSlide){const slide=slides[slideIndex];$('slide-title').innerHTML=slide.title;$('slide-kicker').textContent=slide.kicker;$('slide-description').innerHTML=slide.description;$('slide-image').src='/'+slide.image;$('slide-image').alt=slide.alt;$('slide-image').classList.toggle('portrait',slideIndex===1);$('image-caption').textContent=slide.caption;$('slide-number').textContent=`0${slideIndex+1} / 03`;document.querySelectorAll('[data-seek]').forEach((el,i)=>{el.classList.toggle('active',i===slideIndex);if(i===slideIndex)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});lastSlide=slideIndex;}
  $('play-button').textContent=state.playing?'Ⅱ':'▶';$('play-button').setAttribute('aria-label',state.playing?'Поставити на паузу':'Почати перегляд');
  $('stage-overlay').hidden=state.playing||state.mode!=='recording'||!!state.fileUrl;
}
function seek(time){if(state.mode!=='recording'||state.fileUrl)return;state.position=clampTime(time);state.anchor=performance.now()-state.position*1000;renderPosition();}
function play(){if(state.mode!=='recording'||state.fileUrl)return;if(state.position>=DEMO_DURATION)state.position=0;state.playing=true;state.anchor=performance.now()-state.position*1000;renderPosition();}
function pause(){state.playing=false;renderPosition();}
function resetFile(){if(!state.fileUrl)return;$('video').pause();$('video').removeAttribute('src');$('video').load();URL.revokeObjectURL(state.fileUrl);state.fileUrl=null;$('video-file').value='';$('file-note').textContent='Файл відтворюється лише на вашому пристрої й не завантажується на сервер.';}
function setMode(mode){
  if(!['recording','waiting','live'].includes(mode))throw new Error('Невідомий режим');
  resetFile();state.mode=mode;state.playing=false;state.position=0;state.startAt=mode==='waiting'?Date.now()+30000:null;
  $('waiting-panel').hidden=mode!=='waiting';$('live-panel').hidden=mode!=='live';$('video').hidden=true;$('slide').hidden=false;$('reset-video').hidden=true;
  $('demo-controls').hidden=mode!=='recording';$('chapters').querySelectorAll('button').forEach(b=>b.disabled=mode!=='recording');
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  const descriptions={recording:'Пауза, перемотування та перехід між розділами.',waiting:'Тестовий старт за 30 секунд. Показ синхронізовано з часом сеансу у цьому браузері.',live:'Екран очікування живого ефіру. Джерело трансляції ще не підключено.'};
  const statuses={recording:'Демонстраційний запис',waiting:'Очікування тестового показу',live:'Очікування трансляції'};
  $('mode-description').textContent=descriptions[mode];$('room-status').textContent=statuses[mode];$('countdown').textContent='00:30';renderPosition();
}
function tick(){
  if(state.mode==='waiting'){
    const scheduled=scheduledState(state.startAt,Date.now());
    $('countdown').textContent=formatTime(scheduled.remaining);
    if(scheduled.phase==='playing'){$('waiting-panel').hidden=true;$('room-status').textContent='Демонстраційний показ за розкладом';state.position=scheduled.position;renderPosition();}
    if(scheduled.phase==='ended'){setMode('recording');state.position=DEMO_DURATION;renderPosition();notify('Тестовий показ завершено. Тепер доступний повторний перегляд.');}
  }else if(state.playing){state.position=clampTime((performance.now()-state.anchor)/1000);if(state.position>=DEMO_DURATION)state.playing=false;renderPosition();}
}
setInterval(tick,100);
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.mode==='recording')pause();}else tick();});
$('hero-play').addEventListener('click',play);$('play-button').addEventListener('click',()=>state.playing?pause():play());$('restart-button').addEventListener('click',()=>seek(0));$('progress').addEventListener('input',e=>seek(Number(e.target.value)));
document.querySelectorAll('[data-seek]').forEach(b=>b.addEventListener('click',()=>{seek(Number(b.dataset.seek));play();}));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
function showPage(){const page=['room','schedule','recordings'].includes(location.hash.slice(1))?location.hash.slice(1):'room';document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==page+'-page');document.querySelectorAll('[data-page]').forEach(el=>{if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(page!=='room'){pause();$('video').pause();}document.title=({room:'Вебінарна кімната',schedule:'Розклад',recordings:'Записи'})[page]+' — Іван Косович';}
window.addEventListener('hashchange',showPage);showPage();
$('test-schedule').addEventListener('click',()=>{setMode('waiting');location.hash='room';});
function openDemo(){setMode('recording');location.hash='room';play();}
$('open-demo').addEventListener('click',openDemo);$('open-demo-link').addEventListener('click',openDemo);
$('video-file').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(file.type&&!file.type.startsWith('video/')){notify('Оберіть відеофайл, наприклад MP4.');return;}setMode('recording');state.fileUrl=URL.createObjectURL(file);$('video').src=state.fileUrl;$('video').hidden=false;$('slide').hidden=true;$('stage-overlay').hidden=true;$('demo-controls').hidden=true;$('reset-video').hidden=false;$('chapters').querySelectorAll('button').forEach(b=>b.disabled=true);$('room-status').textContent='Ваше тестове відео';$('file-note').textContent=file.name+' · тільки на цьому пристрої';$('mode-description').textContent='Використовуйте кнопки плеєра для перегляду вашого відео.';location.hash='room';$('video').load();});
$('video').addEventListener('error',()=>{if(!state.fileUrl)return;notify('Браузер не зміг відтворити цей файл. Спробуйте MP4 із відео H.264.');$('file-note').textContent='Формат відео не підтримується. Оберіть інший файл або поверніть демопрезентацію.';});
$('reset-video').addEventListener('click',()=>setMode('recording'));
$('expand-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('stage').requestFullscreen)await $('stage').requestFullscreen();else if(state.fileUrl&&$('video').webkitEnterFullscreen)$('video').webkitEnterFullscreen();else notify('Для більшого зображення поверніть пристрій горизонтально.');}catch{notify('Для більшого зображення поверніть пристрій горизонтально.');}});
document.addEventListener('fullscreenchange',()=>{$('expand-button').textContent=document.fullscreenElement?'Згорнути ⛶':'Розгорнути ⛶';});
window.addEventListener('pagehide',()=>{if(state.fileUrl)URL.revokeObjectURL(state.fileUrl);});
function initTelegram(){const app=window.Telegram?.WebApp;if(!app?.initData)return;try{app.ready();app.expand();app.setHeaderColor?.('#101513');app.setBackgroundColor?.('#101513');const updateInsets=()=>{document.documentElement.style.setProperty('--safe-top',Math.max(app.safeAreaInset?.top||0,app.contentSafeAreaInset?.top||0)+'px');document.documentElement.style.setProperty('--safe-bottom',Math.max(app.safeAreaInset?.bottom||0,app.contentSafeAreaInset?.bottom||0)+'px');};updateInsets();app.onEvent?.('safeAreaChanged',updateInsets);app.onEvent?.('contentSafeAreaChanged',updateInsets);}catch{/* Browser mode remains usable on older Telegram clients. */}}
initTelegram();setMode('recording');
const modelContext=document.modelContext;
if(modelContext?.registerTool){try{Promise.resolve(modelContext.registerTool({name:'preview_webinar_mode',title:'Переглянути режим кімнати',description:'Open a demo room mode. Does not schedule real webinars, register users or send messages.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['recording','waiting','live']}},required:['mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).some(k=>k!=='mode')||!['recording','waiting','live'].includes(input.mode))throw new Error('Expected mode: recording, waiting, or live.');setMode(input.mode);location.hash='room';showPage();return {mode:state.mode,status:$('room-status').textContent,demo:true};}})).catch(()=>{});}catch{/* WebMCP is optional. */}}
