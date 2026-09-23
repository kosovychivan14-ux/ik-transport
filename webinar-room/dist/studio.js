import {MediaSession,mediaErrorMessage} from './media-session.js';
import {setupMaterials} from './materials.js';
import {setupCameraPosition} from './camera-position.js';
import {BackgroundBlur} from './background-blur.js';
import {setupStudioBroadcast} from './studio-live.js';
import {setupStudioPreviewFullscreen} from './studio-preview-fullscreen.js';
const $=id=>document.getElementById(id);
setupStudioPreviewFullscreen({shell:$('preview-shell'),button:$('preview-fullscreen'),previous:$('slide-prev'),next:$('slide-next')});
function setupQuickControls(){
  const start=$('go-live'),stop=$('stop-live'),quickStart=$('quick-go-live'),quickStop=$('quick-stop-live'),blurMain=$('blur-toggle'),blurQuick=$('quick-blur-toggle'),state=$('broadcast-state'),quickState=$('quick-broadcast-state');
  const sync=()=>{quickStart.disabled=start.disabled;quickStop.disabled=stop.disabled;blurQuick.checked=blurMain.checked;quickState.textContent=state.textContent;quickState.classList.toggle('is-live',!stop.disabled);};
  quickStart.addEventListener('click',()=>start.click());quickStop.addEventListener('click',()=>stop.click());
  blurQuick.addEventListener('change',()=>{blurMain.checked=blurQuick.checked;blurMain.dispatchEvent(new Event('change',{bubbles:true}));});
  blurMain.addEventListener('change',sync);
  new MutationObserver(sync).observe(start,{attributes:true,attributeFilter:['disabled']});
  new MutationObserver(sync).observe(stop,{attributes:true,attributeFilter:['disabled']});
  new MutationObserver(sync).observe(state,{childList:true,subtree:true});sync();
}
setupQuickControls();
const labels={camera:{off:'Увімкнути камеру',on:'Вимкнути камеру'},microphone:{off:'Увімкнути мікрофон',on:'Вимкнути мікрофон'},screen:{off:'Показати екран',on:'Зупинити екран'}};
let layout='camera',screenWasActive=false,pageActive=true,audioContext=null,meterSource=null,meterFrame=0,meterStream=null;
let contentSource='screen',materials=null;
let blur=null,cameraPosition=null,broadcast=null,recorder=null;
function message(text,type='info'){$('studio-message').textContent=text;$('studio-message').dataset.type=type;}
function bindPreview(id,stream){const video=$(id);if(video.srcObject===stream)return;video.srcObject=stream;if(stream)video.play().catch(()=>message('Відео отримано, але браузер призупинив перегляд. Поверніться до вкладки студії.'));}
function stopMeter(){cancelAnimationFrame(meterFrame);meterFrame=0;meterSource?.disconnect();meterSource=null;meterStream=null;const oldContext=audioContext;audioContext=null;oldContext?.close().catch(()=>{});$('mic-level').value=0;$('mic-level-text').textContent='Мікрофон вимкнений';}
function startMeter(stream){
  if(stream===meterStream)return;stopMeter();
  if(!stream)return;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context){$('mic-level-text').textContent='Мікрофон увімкнений';return;}
  try{
    const context=new Context();audioContext=context;meterStream=stream;
    const analyser=context.createAnalyser();analyser.fftSize=256;
    meterSource=context.createMediaStreamSource(stream);meterSource.connect(analyser);
    const samples=new Uint8Array(analyser.fftSize);
    const render=()=>{
      if(audioContext!==context)return;
      analyser.getByteTimeDomainData(samples);
      let total=0;for(const sample of samples)total+=((sample-128)/128)**2;
      const level=Math.min(1,Math.sqrt(total/samples.length)*4);$('mic-level').value=level;
      $('mic-level-text').textContent=context.state!=='running'?'Натисніть у студії для перевірки':level>.035?'Є звук':'Скажіть кілька слів';
      meterFrame=requestAnimationFrame(render);
    };
    context.resume().catch(()=>{});render();
  }catch{stopMeter();$('mic-level-text').textContent='Індикатор звуку недоступний';}
}
document.addEventListener('pointerdown',()=>{if(audioContext?.state==='suspended')audioContext.resume().catch(()=>{});});
const session=new MediaSession({mediaDevices:navigator.mediaDevices,secureContext:window.isSecureContext,onChange:render});
function updateCameraOutput(){
  const active=session.active('camera'),enabled=!!blur?.enabled,state=blur?.state||'off';
  $('camera-preview').hidden=!active||enabled;$('camera-blurred').hidden=!active||!enabled||state!=='active';
  $('camera-empty').hidden=active;$('blur-placeholder').hidden=!active||!enabled||state==='active';
  $('blur-placeholder').textContent=['error','unsupported'].includes(state)?'Розмиття недоступне. Вимкніть його, щоб показати камеру.':'Готуємо розмиття…';
  $('blur-strength').disabled=!enabled;
  $('blur-status').textContent=({off:'Вимкнено. Обробка працює лише на вашому пристрої.',waiting:'Увімкніть камеру — розмиття застосовується автоматично.',loading:'Завантажуємо розмиття. Камеру буде видно після обробки.',active:'Фон розмито. Кадри обробляються на вашому пристрої.',error:'Не вдалося запустити розмиття. Вимкніть і ввімкніть його знову або відкрийте студію в Chrome чи Edge.',unsupported:'Цей браузер не підтримує розмиття. Відкрийте студію в Chrome чи Edge на комп’ютері.'})[state];
}
blur=new BackgroundBlur({video:$('camera-preview'),canvas:$('camera-blurred'),onState:updateCameraOutput});
$('blur-toggle').addEventListener('change',event=>blur.setEnabled(event.target.checked));
$('blur-strength').addEventListener('input',event=>{blur.setAmount(event.target.value);$('blur-strength-value').value=event.target.value;});
function render(){
  const screenActive=session.active('screen');
  if(screenWasActive&&!screenActive&&contentSource==='screen'){
    if(materials?.available)contentSource='slides';
    else if(session.active('camera')&&layout!=='camera')setLayout('camera');
  }
  screenWasActive=screenActive;
  for(const kind of ['camera','microphone','screen']){
    const active=session.active(kind),pending=session.pending[kind];
    $(`toggle-${kind}`).disabled=pending||!session.supported(kind);
    $(`toggle-${kind}`).setAttribute('aria-pressed',String(active));
    $(`${kind}-button-text`).textContent=pending?'Очікуємо дозволу…':labels[kind][active?'on':'off'];
  }
  $('stop-sources').disabled=!Object.keys(session.streams).some(kind=>session.active(kind)||session.pending[kind]);
  $('camera-state').textContent=session.pending.camera?'Очікуємо дозволу':session.active('camera')?'Увімкнена':'Вимкнена';
  $('microphone-state').textContent=session.pending.microphone?'Очікуємо дозволу':session.active('microphone')?'Увімкнений':'Вимкнений';
  $('camera-select').disabled=session.pending.camera;$('microphone-select').disabled=session.pending.microphone;
  bindPreview('camera-preview',session.streams.camera);bindPreview('screen-preview',session.streams.screen);
  blur.setStream(session.streams.camera);updateCameraOutput();
  const slidesActive=contentSource==='slides'&&materials?.available;
  $('screen-preview').hidden=contentSource!=='screen'||!screenActive;
  $('slide-layer').hidden=!slidesActive;
  $('screen-empty').hidden=slidesActive||(contentSource==='screen'&&screenActive);
  $('preview-source-label').textContent=layout==='camera'?'Камера':slidesActive?'Завантажені слайди':screenActive?'Вкладка або вікно':'Попередній перегляд';
  $('show-slides').setAttribute('aria-pressed',String(!!slidesActive));
  $('show-screen').disabled=!screenActive;$('show-screen').setAttribute('aria-pressed',String(contentSource==='screen'&&screenActive));
  $('share-website').disabled=session.pending.screen||!session.supported('screen');
  if(session.streams.microphone!==meterStream){if(session.streams.microphone)startMeter(session.streams.microphone);else stopMeter();}
}
function setLayout(next){if(!['camera','screen','pip'].includes(next))return;layout=next;$('program-preview').dataset.layout=layout;$('camera-layer').hidden=layout==='screen';$('screen-layer').hidden=layout==='camera';document.querySelectorAll('[name=layout]').forEach(radio=>radio.checked=radio.value===layout);cameraPosition?.refresh();}
function selectContent(source){contentSource=source;setLayout(session.active('camera')?'pip':'screen');render();}
materials=setupMaterials({showSlides:()=>selectContent('slides'),removeSlides:()=>{contentSource='screen';if(!session.active('screen'))setLayout('camera');render();},shareScreen:()=>enable('screen'),message});
cameraPosition=setupCameraPosition({stage:$('program-preview'),layer:$('camera-layer'),activate:()=>{setLayout('pip');render();}});
$('show-screen').addEventListener('click',()=>{if(session.active('screen'))selectContent('screen');});
async function refreshDevices(){
  try{
    const devices=await session.listDevices();if(!pageActive)return;
    for(const [kind,deviceKind,label] of [['camera','videoinput','Камера'],['microphone','audioinput','Мікрофон']]){
      const select=$(`${kind}-select`),selected=select.value;
      select.replaceChildren(new Option(`${label} за замовчуванням`,''));
      devices.filter(device=>device.kind===deviceKind&&device.deviceId&&device.deviceId!=='default').forEach((device,i)=>select.add(new Option(device.label||`${label} ${i+1}`,device.deviceId)));
      if([...select.options].some(option=>option.value===selected))select.value=selected;
    }
  }catch{/* Media capture can still use the default device. */}
}
async function enable(kind){
  const choice=kind==='screen'?'':$(`${kind}-select`).value;
  const wasPending=session.pending[kind];if(wasPending)return;
  message(kind==='screen'?'Оберіть вкладку із сайтом або вікно презентації у запиті браузера. Потім керуйте ним у його вікні.':'Підтвердьте доступ у запиті браузера. Можна скасувати очікування кнопкою «Вимкнути все».');
  try{
    const stream=await session.start(kind,choice);if(!stream||!pageActive)return;
    if(kind==='screen')selectContent('screen');
    if(kind==='camera'&&(session.active('screen')||materials.available))setLayout('pip');
    render();
    message(broadcast?.active?({camera:'Камера увімкнена у кадрі трансляції.',microphone:'Мікрофон увімкнений у трансляції. Перевірте індикатор звуку.',screen:'Обраний екран передається в ефір. Звук екрана не захоплюється.'})[kind]:({camera:'Камера увімкнена. Попередній перегляд видно лише вам.',microphone:'Мікрофон увімкнений. Скажіть кілька слів і перевірте індикатор.',screen:'Показ екрана увімкнений лише для попереднього перегляду. Звук екрана не захоплюється.'})[kind]);
    await refreshDevices();
  }catch(error){if(pageActive)message(mediaErrorMessage(error,kind),'error');}
}
for(const kind of ['camera','microphone','screen'])$(`toggle-${kind}`).addEventListener('click',()=>{if(session.active(kind)){session.stop(kind);message(broadcast?.active?'Джерело вимкнено. Решта джерел продовжують передаватися в ефір.':'Джерело вимкнено. Решта активних джерел залишаються у вашому перегляді.');}else enable(kind);});
for(const kind of ['camera','microphone'])$(`${kind}-select`).addEventListener('change',()=>{if(session.active(kind))enable(kind);});
$('stop-sources').addEventListener('click',()=>{broadcast?.stop();session.stopAll();message('Ефір, камера, мікрофон і показ екрана вимкнені.');});
document.querySelectorAll('[name=layout]').forEach(radio=>radio.addEventListener('change',()=>{setLayout(radio.value);render();}));
function stopOnLeave(){pageActive=false;broadcast?.stop();recorder?.destroy();session.stopAll();stopMeter();blur.stop();}
window.addEventListener('beforeunload',event=>{if(recorder?.active){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',stopOnLeave);
window.addEventListener('pageshow',()=>{pageActive=true;render();});
document.querySelectorAll('a[href]').forEach(link=>link.addEventListener('click',event=>{if(link.target!=='_blank'&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!link.getAttribute('href').startsWith('#'))stopOnLeave();}));
navigator.mediaDevices?.addEventListener?.('devicechange',refreshDevices);
if(!window.isSecureContext){$('browser-notice').hidden=false;$('browser-notice').textContent='Для пристроїв потрібне захищене HTTPS-посилання. Відкрийте опубліковану студію у звичайному браузері.';}
else if(!session.supported('camera')){$('browser-notice').hidden=false;$('browser-notice').textContent='Цей переглядач не надає доступу до камери. Відкрийте посилання студії окремо у Chrome, Edge або Safari.';}
else if(!session.supported('screen')){$('browser-notice').hidden=false;$('browser-notice').textContent='Камеру й мікрофон можна використати тут. Для показу слайдів відкрийте студію у Chrome або Edge на комп’ютері.';}
broadcast=setupStudioBroadcast({getState:()=>({layout,contentSource,microphoneStream:session.streams.microphone,blur:{enabled:blur.enabled,state:blur.state},videoReady:layout==='camera'?session.active('camera'):(contentSource==='slides'?materials.available:session.active('screen'))}),message});
recorder=window.createStudioRecorder?.({getState:()=>({layout,contentSource,microphoneStream:session.streams.microphone,blur:{enabled:blur.enabled,state:blur.state},videoReady:layout==='camera'?session.active('camera'):(contentSource==='slides'?materials.available:session.active('screen'))}),message})||null;
render();
