import {MediaSession,mediaErrorMessage} from './media-session.js';
import {setupCameraPosition} from './camera-position.js';
import {BackgroundBlur} from './background-blur.js';
import {loadSlideDeck,normalizeWebsite} from './slide-deck.js';
import {ProgramStream} from './program-stream.js';

const $=id=>document.getElementById(id);
const $$=sel=>[...document.querySelectorAll(sel)];

/* ---------- повідомлення ---------- */
let messageTimer=0;
function message(text,type='info'){
  const el=$('studio-message');
  el.textContent=text; el.dataset.type=type;
  clearTimeout(messageTimer);
  if(text) messageTimer=setTimeout(()=>{el.textContent='';},type==='error'?9000:7000);
}

/* ---------- годинник (Київ) ---------- */
function tickClock(){
  try{
    $('room-clock').textContent=new Intl.DateTimeFormat('uk-UA',{timeZone:'Europe/Kyiv',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
  }catch{$('room-clock').textContent='--:--:--';}
}
tickClock(); setInterval(tickClock,1000);

/* ---------- стан ---------- */
const labels={camera:{off:'Увімкнути камеру',on:'Вимкнути камеру'},microphone:{off:'Увімкнути мікрофон',on:'Вимкнути мікрофон'},screen:{off:'Показати екран',on:'Зупинити екран'}};
let layout='camera', contentSource='screen', screenWasActive=false, pageActive=true;
let audioContext=null, meterSource=null, meterFrame=0, meterStream=null;
let blur=null, cameraPosition=null, materials=null;
let program=null, programActive=false;

/* ---------- прев'ю ---------- */
function bindPreview(id,stream){
  const video=$(id); if(!video||video.srcObject===stream) return;
  video.srcObject=stream;
  if(stream) video.play().catch(()=>{});
}

/* ---------- індикатор мікрофона ---------- */
function stopMeter(){
  cancelAnimationFrame(meterFrame); meterFrame=0;
  meterSource?.disconnect(); meterSource=null; meterStream=null;
  const old=audioContext; audioContext=null; old?.close().catch(()=>{});
  $('mic-level').value=0; $('mic-level-text').textContent='Мікрофон вимкнений';
}
function startMeter(stream){
  if(stream===meterStream) return;
  stopMeter(); if(!stream) return;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context){$('mic-level-text').textContent='Мікрофон увімкнений';return;}
  try{
    const context=new Context(); audioContext=context; meterStream=stream;
    const analyser=context.createAnalyser(); analyser.fftSize=256;
    meterSource=context.createMediaStreamSource(stream); meterSource.connect(analyser);
    const samples=new Uint8Array(analyser.fftSize);
    const renderMeter=()=>{
      if(audioContext!==context) return;
      analyser.getByteTimeDomainData(samples);
      let total=0; for(const s of samples) total+=((s-128)/128)**2;
      const level=Math.min(1,Math.sqrt(total/samples.length)*4);
      $('mic-level').value=level;
      $('mic-level-text').textContent=context.state!=='running'?'Натисніть у студії для перевірки':level>.035?'Є звук':'Скажіть кілька слів';
      meterFrame=requestAnimationFrame(renderMeter);
    };
    context.resume().catch(()=>{}); renderMeter();
  }catch{ stopMeter(); $('mic-level-text').textContent='Індикатор звуку недоступний'; }
}
document.addEventListener('pointerdown',()=>{if(audioContext?.state==='suspended')audioContext.resume().catch(()=>{});});

/* ---------- сесія пристроїв ---------- */
const session=new MediaSession({mediaDevices:navigator.mediaDevices,secureContext:window.isSecureContext,onChange:render});

/* ---------- розмиття фону ---------- */
function updateCameraOutput(){
  const active=session.active('camera'), enabled=!!blur?.enabled, state=blur?.state||'off';
  $('camera-preview').hidden=!active||enabled;
  $('camera-blurred').hidden=!active||!enabled||state!=='active';
  $('camera-empty').hidden=active;
  $('blur-placeholder').hidden=!active||!enabled||state==='active';
  $('blur-placeholder').textContent=['error','unsupported'].includes(state)?'Розмиття недоступне. Вимкніть його, щоб показати камеру.':'Готуємо розмиття…';
  $('blur-strength').disabled=!enabled;
  $('blur-status').textContent=({off:'Вимкнено. Обробка працює лише на вашому пристрої.',waiting:'Увімкніть камеру — розмиття застосується автоматично.',loading:'Завантажуємо розмиття. Камеру буде видно після обробки.',active:'Фон розмито. Кадри обробляються на вашому пристрої.',error:'Не вдалося запустити розмиття. Вимкніть і ввімкніть його знову або відкрийте студію в Chrome чи Edge.',unsupported:'Цей браузер не підтримує розмиття. Відкрийте студію в Chrome чи Edge на комп’ютері.'})[state];
}
blur=new BackgroundBlur({video:$('camera-preview'),canvas:$('camera-blurred'),onState:updateCameraOutput});
$('blur-toggle').addEventListener('change',e=>blur.setEnabled(e.target.checked));
$('blur-strength').addEventListener('input',e=>{blur.setAmount(e.target.value);$('blur-strength-value').value=e.target.value;paintRange(e.target);});

/* ---------- програма (зведений кадр) ---------- */
function videoReady(){
  if(layout==='camera') return session.active('camera');
  return contentSource==='slides' ? !!materials?.available : session.active('screen');
}
function getProgramState(){
  return {
    layout, contentSource,
    microphoneStream:session.streams.microphone,
    blur:{enabled:blur.enabled,state:blur.state},
    videoReady:videoReady(),
  };
}
async function ensureProgram(){
  if(program) return program;
  const fresh=new ProgramStream({getState:getProgramState});
  program=fresh;
  await fresh.resume();
  if(program!==fresh||!videoReady()){fresh.stop();if(program===fresh)program=null;return program;}
  bindPreview('program-out',fresh.stream);
  return fresh;
}
function destroyProgram(){
  if(!program) return;
  program.stop(); program=null;
  const out=$('program-out'); out.pause(); out.srcObject=null; out.removeAttribute('src');
}
function syncProgram(){
  const ready=videoReady();
  $('program-empty').style.display=ready?'none':'flex';
  $('program-out').style.visibility=ready?'visible':'hidden';
  if(ready&&!programActive){programActive=true;ensureProgram().catch(err=>{programActive=false;message(err.message||'Не вдалося створити кадр програми.','error');});}
  if(!ready&&programActive){programActive=false;destroyProgram();}
}

/* ---------- запис (локальний файл) ---------- */
let recorder=null,recChunks=[],recTimer=0,recStartedAt=0;
function recordingMime(){
  for(const t of ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'])
    if(window.MediaRecorder?.isTypeSupported?.(t)) return t;
  return '';
}
function fmtDur(ms){const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function setRecUI(state){
  const active=state==='recording';
  $('start-recording').disabled=active; $('stop-recording').disabled=!active;
  $('recording-state').textContent={idle:'Готово до запису',recording:'Триває запис…',done:'Запис завершено'}[state];
  $('recording-state').dataset.state=state;
  const pill=$('live-pill');
  pill.classList.toggle('is-rec',active);
  if(active) pill.textContent='● Запис';
  else if(pill.dataset.mode!=='live') pill.textContent='Ефір не запущено';
}
function recTick(){$('recording-time').textContent=fmtDur(Date.now()-recStartedAt);}
async function startRecording(){
  if(recorder) return;
  if(!videoReady()){message('Увімкніть камеру, відкрийте слайди або оберіть екран перед початком запису.','error');return;}
  if(typeof window.MediaRecorder!=='function'){message('Цей браузер не підтримує запис. Відкрийте студію в Chrome або Edge.','error');return;}
  try{
    await ensureProgram();
    recChunks=[]; const type=recordingMime();
    recorder=new MediaRecorder(program.stream,{...(type?{mimeType:type}:{}),videoBitsPerSecond:5000000,audioBitsPerSecond:128000});
    recorder.addEventListener('dataavailable',e=>{if(e.data?.size)recChunks.push(e.data);});
    recorder.addEventListener('stop',()=>{
      const mime=recorder.mimeType||recChunks[0]?.type||'video/webm';
      const ext=mime.includes('mp4')?'mp4':'webm';
      const blob=new Blob(recChunks,{type:mime});
      const url=URL.createObjectURL(blob);
      const a=$('recording-download');
      a.href=url; a.download=`IK-webinar-${new Date(recStartedAt).toISOString().slice(0,10)}.${ext}`;
      a.hidden=false; a.textContent=`Завантажити запис (${(blob.size/1048576).toFixed(1)} МБ)`;
      recorder=null; recChunks=[];
      clearInterval(recTimer); recTimer=0;
      setRecUI('done'); $('recording-time').textContent=fmtDur(Date.now()-recStartedAt);
      message('Запис завершено. Файл готовий до завантаження.');
    });
    recorder.addEventListener('error',()=>{recorder=null;clearInterval(recTimer);setRecUI('idle');message('Запис перервано браузером.','error');});
    recStartedAt=Date.now();
    recorder.start(1000); recTick(); recTimer=setInterval(recTick,1000);
    setRecUI('recording');
    message('Запис почався. Зведений кадр і звук мікрофона пишуться у файл.');
  }catch(err){setRecUI('idle');message(err.message||'Не вдалося почати запис.','error');}
}
function stopRecording(){ if(recorder?.state!=='inactive') recorder.stop(); }
$('start-recording').addEventListener('click',startRecording);
$('stop-recording').addEventListener('click',stopRecording);

/* ---------- ефір (чесний стан: відеосервіс не підключено) ---------- */
(function initBroadcast(){
  $('go-live').disabled=true; $('stop-live').disabled=true;
  $('broadcast-help').textContent='Прямий ефір через відеосервіс ще не підключено. Для запуску потрібні ключі LiveKit — скажіть, коли будете готові, і я підключу.';
})();

/* ---------- рендер ---------- */
function render(){
  const screenActive=session.active('screen');
  if(screenWasActive&&!screenActive&&contentSource==='screen'){
    if(materials?.available) contentSource='slides';
    else if(session.active('camera')&&layout!=='camera') setLayout('camera');
  }
  screenWasActive=screenActive;
  for(const kind of ['camera','microphone','screen']){
    const active=session.active(kind), pending=session.pending[kind];
    $(`toggle-${kind}`).disabled=pending||!session.supported(kind);
    $(`toggle-${kind}`).setAttribute('aria-pressed',String(active));
    $(`${kind}-button-text`).textContent=pending?'Очікуємо дозволу…':labels[kind][active?'on':'off'];
  }
  $('stop-sources').disabled=!['camera','microphone','screen'].some(k=>session.active(k)||session.pending[k]);
  const camState=$('camera-state'), micState=$('microphone-state');
  camState.textContent=session.pending.camera?'Очікуємо дозволу':session.active('camera')?'Увімкнена':'Вимкнена';
  camState.classList.toggle('on',session.active('camera'));
  micState.textContent=session.pending.microphone?'Очікуємо дозволу':session.active('microphone')?'Увімкнений':'Вимкнений';
  micState.classList.toggle('on',session.active('microphone'));
  $('camera-select').disabled=session.pending.camera;
  $('microphone-select').disabled=session.pending.microphone;
  bindPreview('camera-preview',session.streams.camera);
  bindPreview('screen-preview',session.streams.screen);
  blur.setStream(session.streams.camera); updateCameraOutput();
  const slidesActive=contentSource==='slides'&&materials?.available;
  $('screen-preview').hidden=contentSource!=='screen'||!screenActive;
  $('screen-empty').style.display=slidesActive||(contentSource==='screen'&&screenActive)?'none':'flex';
  $('preview-source-label').textContent=layout==='camera'?'Камера':slidesActive?'Завантажені слайди':screenActive?'Вкладка або вікно':'Попередній перегляд';
  $('show-slides').setAttribute('aria-pressed',String(!!slidesActive));
  $('show-slides').disabled=!materials?.available;
  $('show-screen').disabled=!screenActive;
  $('show-screen').setAttribute('aria-pressed',String(contentSource==='screen'&&screenActive));
  $('share-website').disabled=session.pending.screen||!session.supported('screen');
  if(session.streams.microphone!==meterStream){if(session.streams.microphone)startMeter(session.streams.microphone);else stopMeter();}
  syncProgram();
}

/* ---------- композиція ---------- */
function setLayout(next){
  if(!['camera','screen','pip'].includes(next)) return;
  layout=next;
  $('program-preview').dataset.layout=layout;
  $('camera-layer').hidden=layout==='screen';
  $$('[name=layout]').forEach(r=>r.checked=r.value===layout);
  cameraPosition?.refresh(); render();
}
function selectContent(source){
  contentSource=source;
  setLayout(session.active('camera')?'pip':'screen');
  render();
}
$$('[name=layout]').forEach(r=>r.addEventListener('change',()=>{setLayout(r.value);render();}));
$('show-slides').addEventListener('click',()=>{if(materials?.available)selectContent('slides');});
$('show-screen').addEventListener('click',()=>{if(session.active('screen'))selectContent('screen');});

/* ---------- положення камери ---------- */
cameraPosition=setupCameraPosition({stage:$('program-preview'),layer:$('camera-layer'),activate:()=>{setLayout('pip');render();}});

/* ---------- увімкнення джерел ---------- */
async function refreshDevices(){
  try{
    const devices=await session.listDevices(); if(!pageActive) return;
    for(const [kind,deviceKind,label] of [['camera','videoinput','Камера'],['microphone','audioinput','Мікрофон']]){
      const select=$(`${kind}-select`), selected=select.value;
      select.replaceChildren(new Option(`${label} за замовчуванням`,''));
      devices.filter(d=>d.kind===deviceKind&&d.deviceId&&d.deviceId!=='default').forEach((d,i)=>select.add(new Option(d.label||`${label} ${i+1}`,d.deviceId)));
      if([...select.options].some(o=>o.value===selected)) select.value=selected;
    }
  }catch{/* типовий пристрій все одно доступний */}
}
async function enable(kind){
  const choice=kind==='screen'?'':$(`${kind}-select`).value;
  if(session.pending[kind]) return;
  message(kind==='screen'?'Оберіть вкладку із сайтом або вікно презентації у запиті браузера.':'Підтвердьте доступ у запиті браузера. Скасувати очікування можна кнопкою «Вимкнути все».');
  try{
    const stream=await session.start(kind,choice);
    if(!stream||!pageActive) return;
    if(kind==='screen') selectContent('screen');
    if(kind==='camera'&&(session.active('screen')||materials?.available)) setLayout('pip');
    render();
    message({camera:'Камера увімкнена. Кадр видно лише вам.',microphone:'Мікрофон увімкнений. Скажіть кілька слів і перевірте індикатор.',screen:'Показ екрана увімкнений лише для попереднього перегляду. Звук екрана не захоплюється.'}[kind]);
    await refreshDevices();
  }catch(err){ if(pageActive) message(mediaErrorMessage(err,kind),'error'); }
}
for(const kind of ['camera','microphone','screen'])
  $(`toggle-${kind}`).addEventListener('click',()=>{
    if(session.active(kind)){session.stop(kind);message('Джерело вимкнено. Решта активних джерел залишаються у вашому перегляді.');render();}
    else enable(kind);
  });
for(const kind of ['camera','microphone'])
  $(`${kind}-select`).addEventListener('change',()=>{if(session.active(kind))enable(kind);});
$('stop-sources').addEventListener('click',()=>{
  stopRecording(); destroyProgram(); programActive=false;
  session.stopAll(); blur.stop(); stopMeter();
  message('Камера, мікрофон і показ екрана вимкнені.');
  render();
});

/* ---------- матеріали: слайди ---------- */
materials=(function setupMaterials(){
  let deck=null,page=0,version=0,busy=false,fetchController=null,savedActive=false;
  const status=(text,error=false)=>{const el=$('materials-status');el.textContent=text;el.dataset.type=error?'error':'info';};
  function controls(){
    $('slide-prev').disabled=busy||!deck||page===0;
    $('slide-next').disabled=busy||!deck||page===deck.count-1;
    $('slide-number').disabled=busy||!deck;
    $('slide-number').max=deck?.count||1; $('slide-number').value=page+1;
    $('slide-count').textContent=deck?`із ${deck.count}`:'із 0';
    $('remove-slides').disabled=!deck&&!busy;
    $('deck-name').textContent=deck?.name||'Презентацію ще не відкрито';
    $('slides-navigation').hidden=!deck;
    $('slide-layer').setAttribute('aria-busy',String(busy));
    $('load-saved-slides').disabled=busy;
    render();
  }
  function display(canvas){
    canvas.setAttribute('aria-label',`Слайд ${page+1} із ${deck.count}`);
    $('slide-layer').replaceChildren(canvas);
  }
  async function load(files,saved=false){
    if(!saved&&!files.length) return;
    const request=++version; fetchController?.abort();
    const controller=new AbortController(); fetchController=controller;
    busy=true; controls();
    status(saved?'Завантажуємо E-Transport українською — 27,6 МБ…':'Відкриваємо презентацію…');
    let incoming;
    try{
      if(saved){
        const url=new URL('./assets/presentations/e-transport.pdf',import.meta.url).href;
        const response=await fetch(url,{signal:controller.signal});
        if(!response.ok) throw new Error('Не вдалося завантажити E-Transport. Перевірте з’єднання й натисніть кнопку ще раз.');
        let blob=await response.blob();
        if(response.status===206){
          const total=Number(response.headers.get('content-range')?.split('/')[1]);
          if(!Number.isSafeInteger(total)||total<=0||total>80*1024*1024) throw new Error('Некоректний розмір презентації.');
          const parts=[blob]; let offset=blob.size;
          while(offset<total){
            const part=await fetch(url,{signal:controller.signal,headers:{Range:`bytes=${offset}-`}});
            if(part.status!==206||!part.headers.get('content-range')?.startsWith(`bytes ${offset}-`)) throw new Error('Не вдалося завантажити частину презентації.');
            const chunk=await part.blob();
            if(!chunk.size) throw new Error('Порожня частина презентації.');
            parts.push(chunk); offset+=chunk.size;
          }
          if(offset!==total) throw new Error('Розмір презентації не збігається.');
          blob=new Blob(parts,{type:'application/pdf'});
        }
        if(request!==version) return;
        files=[new File([blob],'E-Transport_UA.pdf',{type:'application/pdf'})];
      }
      incoming=await loadSlideDeck(files);
      const canvas=await incoming.render(0);
      if(request!==version){await incoming.dispose();return;}
      const old=deck; deck=incoming; savedActive=saved; page=0;
      display(canvas); busy=false; controls();
      selectContent('slides');
      old?.dispose().catch(()=>{});
      status(saved?`E-Transport українською відкрито. Слайдів: ${deck.count}.`:`Готово. Слайдів: ${deck.count}. Файл відкрито лише до перезавантаження вкладки.`);
    }catch(err){
      if(incoming&&incoming!==deck) await incoming.dispose().catch(()=>{});
      if(request===version){busy=false;controls();status(err.message||'Не вдалося додати презентацію.',true);}
    }
  }
  async function goTo(next){
    if(!deck||busy) return;
    const target=Math.min(deck.count-1,Math.max(0,Number(next)));
    if(!Number.isInteger(target)||target===page){controls();return;}
    const request=++version; busy=true; controls();
    try{
      const canvas=await deck.render(target);
      if(request!==version) return;
      page=target; display(canvas); status(`Слайд ${page+1} із ${deck.count}`);
    }catch(err){ if(request===version) status(err.message||'Не вдалося відкрити слайд.',true); }
    finally{ if(request===version){busy=false;controls();} }
  }
  $('slides-file').addEventListener('change',e=>{load([...e.target.files]);e.target.value='';});
  $('load-saved-slides').addEventListener('click',()=>{if(savedActive&&deck)selectContent('slides');else load([],true);});
  $('slide-prev').addEventListener('click',()=>goTo(page-1));
  $('slide-next').addEventListener('click',()=>goTo(page+1));
  $('slide-number').addEventListener('change',e=>goTo(Number(e.target.value)-1));
  $('slide-number').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();goTo(Number(e.target.value)-1);}});
  document.addEventListener('keydown',e=>{
    if(!deck||busy||e.altKey||e.ctrlKey||e.metaKey) return;
    if(e.target.closest?.('input, textarea, select, button, a, [contenteditable=true]')) return;
    const dir=['ArrowRight','PageDown',' '].includes(e.key)?1:['ArrowLeft','PageUp'].includes(e.key)?-1:0;
    if(dir){e.preventDefault();goTo(page+dir);}
  });
  $('remove-slides').addEventListener('click',()=>{
    version++; fetchController?.abort(); deck?.dispose().catch(()=>{});
    deck=null; savedActive=false; page=0; busy=false;
    $('slide-layer').replaceChildren(); controls();
    contentSource='screen'; if(!session.active('screen')) setLayout('camera');
    render(); status('Презентацію прибрано. E-Transport можна знову відкрити кнопкою вище.');
  });
  $('website-form').addEventListener('submit',e=>{
    e.preventDefault();
    try{
      const url=normalizeWebsite($('website-url').value);
      $('website-url').value=url;
      const link=$('website-link');
      link.href=url; link.hidden=false; link.textContent=`Відкрити ${new URL(url).hostname} ↗`;
      $('website-guide').hidden=false;
      status('Посилання готове. Відкрийте сайт, а потім оберіть його вкладку для показу.');
    }catch{ status('Вставте коректне посилання на сайт, наприклад https://example.com.',true); }
  });
  $('website-url').addEventListener('input',()=>{$('website-link').hidden=true;$('website-guide').hidden=true;});
  $('share-website').addEventListener('click',()=>enable('screen'));
  $('website-link').addEventListener('click',()=>message('Сайт відкривається в окремій вкладці. Поверніться сюди, натисніть «Обрати вкладку або вікно» та оберіть саме цей сайт у запиті браузера.'));
  controls();
  return {get available(){return !!deck;},get busy(){return busy;}};
})();

/* ---------- повзунки ---------- */
function paintRange(el){
  const pct=(el.value-el.min)/(el.max-el.min)*100;
  el.style.setProperty('--fill',pct+'%');
}
$$('input[type="range"]').forEach(el=>{paintRange(el);el.addEventListener('input',()=>paintRange(el));});

/* ---------- системні події ---------- */
function stopOnLeave(){
  pageActive=false;
  stopRecording(); destroyProgram();
  session.stopAll(); stopMeter(); blur.stop();
}
window.addEventListener('beforeunload',e=>{if(recorder){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',stopOnLeave);
window.addEventListener('pageshow',()=>{pageActive=true;render();});
navigator.mediaDevices?.addEventListener?.('devicechange',refreshDevices);

if(!window.isSecureContext){
  $('browser-notice').hidden=false;
  $('browser-notice').textContent='Для пристроїв потрібне захищене HTTPS-посилання. Відкрийте опубліковану студію у звичайному браузері.';
}else if(!session.supported('camera')){
  $('browser-notice').hidden=false;
  $('browser-notice').textContent='Цей переглядач не надає доступу до камери. Відкрийте посилання студії окремо у Chrome, Edge або Safari.';
}else if(!session.supported('screen')){
  $('browser-notice').hidden=false;
  $('browser-notice').textContent='Камеру й мікрофон можна використати тут. Для показу слайдів відкрийте студію у Chrome або Edge на комп’ютері.';
}

render();
