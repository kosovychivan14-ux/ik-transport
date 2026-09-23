import {ProgramStream} from './program-stream.js';

function recordingMime(MediaRecorderClass){
  for(const type of ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'])if(MediaRecorderClass.isTypeSupported?.(type))return type;
  return '';
}
function formatDuration(milliseconds){const total=Math.floor(milliseconds/1000),minutes=Math.floor(total/60),seconds=total%60;return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;}

export function setupStudioRecorder({getState,message,uploadFile,setVisibility,backup,doc=document,MediaRecorderClass=globalThis.MediaRecorder,ProgramStreamClass=ProgramStream,now=()=>Date.now(),setTimer=setInterval,clearTimer=clearInterval,wait=(milliseconds)=>new Promise(resolve=>setTimeout(resolve,milliseconds))}={}){
  const $=id=>doc.getElementById(id),start=$('start-recording'),stop=$('stop-recording'),quickStart=$('quick-start-recording'),quickStop=$('quick-stop-recording'),state=$('recording-state'),time=$('recording-time'),progress=$('recording-upload-progress'),result=$('recording-result'),download=$('recording-download'),visibility=$('recording-visibility');
  let program=null,recorder=null,chunks=[],startedAt=0,lastDuration=0,timer=0,status='idle',stopping=null,lastRecording=null,visible=true,backupId='';
  const buttons=[start,quickStart].filter(Boolean),stops=[stop,quickStop].filter(Boolean);
  function update(){const active=status==='recording',busy=['stopping','uploading'].includes(status);for(const button of buttons)button.disabled=active||busy;for(const button of stops)button.disabled=!active;const labels={idle:'Готово до запису',recording:'Триває запис',stopping:'Завершуємо файл…',uploading:'Публікуємо запис…',published:'Запис опубліковано',error:'Не вдалося зберегти запис'};if(state)state.textContent=labels[status];if(state)state.dataset.state=status;}
  function tick(){if(time)time.textContent=formatDuration(status==='recording'?Math.max(0,now()-startedAt):lastDuration);}
  function cleanup(){clearTimer(timer);timer=0;program?.stop();program=null;recorder=null;chunks=[];}
  async function uploadWithRetry(value){let error;for(let attempt=1;attempt<=3;attempt++){try{return await uploadFile(value);}catch(cause){error=cause;if(attempt<3){message?.(`Завантаження перервано. Повторна спроба ${attempt+1} з 3…`,'error');await wait(attempt*1000);}}}throw error;}
  function fileFor({id,startedAt:started,mime,chunks:parts,duration}){const extension=(mime||'').includes('mp4')?'mp4':'webm',blob=new Blob(parts,{type:mime||'video/webm'});return {file:new File([blob],`IK-webinar-${new Date(started).toISOString().slice(0,10)}.${extension}`,{type:mime||'video/webm'}),pathname:`recordings/${id}-${Math.max(1000,Math.round(duration||1000))}ms.${extension}`};}
  async function publish(record,{recovered=false}={}){const {file,pathname}=fileFor(record);status='uploading';update();if(progress){progress.hidden=false;progress.value=0;}const uploaded=await uploadWithRetry({file,pathname,onProgress(value){if(progress)progress.value=Math.max(0,Math.min(100,value));}});await backup?.remove?.(record.id);lastRecording=uploaded;visible=true;if(download){download.href=uploaded.downloadUrl||`${uploaded.url}?download=1`;download.download=file.name;}if(visibility)visibility.textContent='Сховати від людей';if(result)result.hidden=false;status='published';update();if(progress){progress.value=100;progress.hidden=false;}message?.(recovered?'Незавершений запис відновлено та збережено у хмарі.':`Запис ${formatDuration(record.duration)} опубліковано. Він уже доступний клієнтам у розділі «Записи».`);if(typeof CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('recording:published',{detail:uploaded}));return uploaded;}
  async function recover(){if(!backup?.list)return;try{const pending=await backup.list();for(const record of pending){message?.('Знайдено незбережений запис. Відновлюємо завантаження…');try{await publish(record,{recovered:true});}catch(error){status='error';update();message?.(`Запис збережено локально, але хмарне завантаження ще не вдалося: ${error.message||'помилка мережі'}. Він буде повторно завантажений при наступному відкритті студії.`,'error');}}}catch(error){message?.(error.message||'Не вдалося перевірити локальні резервні записи.','error');}}
  async function begin(){
    if(status==='recording'||status==='uploading')return;
    const current=getState?.()||{};if(!current.videoReady){message?.('Увімкніть камеру, відкрийте слайди або оберіть екран перед початком запису.','error');return;}
    if(typeof MediaRecorderClass!=='function'){message?.('Цей браузер не підтримує запис. Відкрийте студію в актуальному Chrome або Edge.','error');return;}
    try{
      program=new ProgramStreamClass({getState});await program.resume();chunks=[];const type=recordingMime(MediaRecorderClass);startedAt=now();backupId=String(startedAt);await backup?.begin?.({id:backupId,startedAt,mime:type||'video/webm'});
      recorder=new MediaRecorderClass(program.stream,{...(type?{mimeType:type}:{}),videoBitsPerSecond:3500000,audioBitsPerSecond:128000});
      recorder.addEventListener('dataavailable',event=>{if(event.data?.size){chunks.push(event.data);backup?.append?.(backupId,event.data,Math.max(1000,now()-startedAt))?.catch?.(()=>{});}});recorder.addEventListener('error',()=>{status='error';update();message?.('Запис перервано браузером. Його фрагменти збережені локально й будуть відновлені після повторного відкриття студії.','error');cleanup();});
      recorder.start(1000);status='recording';tick();timer=setTimer(tick,1000);if(progress){progress.hidden=true;progress.value=0;}update();message?.('Запис почався. Щосекунди створюється резервна копія, а після завершення файл автоматично завантажиться у хмару.');
    }catch(error){status='error';update();cleanup();message?.(error.message||'Не вдалося почати запис.','error');}
  }
  async function finish(){
    if(status!=='recording')return stopping;status='stopping';update();clearTimer(timer);timer=0;
    const duration=Math.max(1000,now()-startedAt),current=recorder;lastDuration=duration;tick();
    stopping=new Promise(resolve=>{current.addEventListener('stop',resolve,{once:true});current.stop();});await stopping;
    try{
      const mime=current.mimeType||chunks[0]?.type||'video/webm';await backup?.flush?.();await backup?.finalize?.(backupId,{duration,mime});program?.stop();program=null;await publish({id:backupId,startedAt,mime,chunks:[...chunks],duration});
    }catch(error){status='error';update();message?.(`${error.message||'Не вдалося опублікувати запис.'} Копія залишилася у цьому браузері й автоматично завантажиться після наступного відкриття студії.`,'error');}
    finally{cleanup();stopping=null;}
  }
  async function toggleVisibility(){if(!lastRecording||!setVisibility)return;visibility.disabled=true;try{const next=!visible;await setVisibility({id:lastRecording.pathname,visible:next});visible=next;visibility.textContent=visible?'Сховати від людей':'Відкрити для людей';message?.(visible?'Запис знову відкритий для клієнтів.':'Запис прихований. У клієнтській кімнаті його більше не видно.');if(typeof CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('recording:visibility'));}catch(error){message?.(error.message||'Не вдалося змінити видимість запису.','error');}finally{visibility.disabled=false;}}
  for(const button of buttons)button.addEventListener('click',begin);for(const button of stops)button.addEventListener('click',finish);visibility?.addEventListener('click',toggleVisibility);update();tick();recover();
  return {get active(){return status==='recording';},start:begin,stop:finish,destroy(){if(status==='recording')recorder?.stop();cleanup();}};
}

