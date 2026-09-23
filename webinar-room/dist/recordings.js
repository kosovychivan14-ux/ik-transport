const $=id=>document.getElementById(id);
function duration(value){const total=Math.max(0,Math.floor(value/1000)),minutes=Math.floor(total/60),seconds=total%60;return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;}
function date(value){try{return new Intl.DateTimeFormat('uk-UA',{dateStyle:'long',timeZone:'Europe/Kyiv'}).format(new Date(value));}catch{return '';}}
function open(recording){$('recordings-list').hidden=true;$('recordings-empty').hidden=true;$('recording-player').hidden=false;$('recording-video').dataset.recordingId=recording.id;$('recording-video').src=recording.url;$('recording-title').textContent='Електротранспорт. Від технології до бізнесу.';$('recording-meta').textContent=`Запис ефіру · ${date(recording.recordedAt)} · ${duration(recording.duration)}`;$('recording-video').play().catch(()=>{});}
function close(){$('recording-video').pause();$('recording-video').removeAttribute('src');delete $('recording-video').dataset.recordingId;$('recording-video').load();$('recording-player').hidden=true;load();}
async function load(){
  const list=$('recordings-list'),empty=$('recordings-empty'),status=$('recordings-status');if(!list)return;
  status.textContent='Завантажуємо записи…';
  try{
    const response=await fetch('/api/recordings',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error();const {recordings=[]}=await response.json();list.replaceChildren();
    for(const recording of recordings){const card=document.createElement('article');card.className='viewer-recording-card';const button=document.createElement('button');button.type='button';button.className='viewer-recording-play';button.innerHTML='<span class="recording-live-mark">ЗАПИС ЕФІРУ</span><span class="recording-play-icon">▶</span>';button.addEventListener('click',()=>open(recording));const copy=document.createElement('div');copy.className='viewer-recording-copy';const heading=document.createElement('h2');heading.textContent='Електротранспорт. Від технології до бізнесу.';const meta=document.createElement('p');meta.textContent=`Іван Косович · ${date(recording.recordedAt)} · ${duration(recording.duration)}`;copy.append(heading,meta);card.append(button,copy);list.append(card);}
    list.hidden=!recordings.length;empty.hidden=!!recordings.length;status.textContent=recordings.length?`Доступно записів: ${recordings.length}`:'Записів поки немає';
  }catch{list.hidden=true;empty.hidden=false;status.textContent='Не вдалося завантажити записи. Відкрийте розділ ще раз.';}
}
$('recording-back')?.addEventListener('click',close);window.addEventListener('hashchange',()=>{if(location.hash==='#records'&&$('recording-player')?.hidden)load();});load();
