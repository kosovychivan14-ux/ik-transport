import {ProgramStream} from './program-stream.js';
import {LiveConnection,liveRequest,telegramData,liveMessages} from './live-connection.js';
export function setupStudioBroadcast({getState,message}){
  const $=id=>document.getElementById(id),start=$('go-live'),stop=$('stop-live');
  let presenterAuthorized=false,configured=false,status='idle',program=null;
  const hash=new URLSearchParams(location.hash.slice(1));let presenterTicket=hash.get('presenter')||'';
  if(presenterTicket)history.replaceState(null,'',location.pathname+location.search);
  function cleanup(){program?.stop();program=null;}
  function update(){
    const busy=['connecting','live','reconnecting'].includes(status);
    start.disabled=!configured||busy;stop.disabled=!busy;
    $('broadcast-state').textContent=({idle:configured?'Готово до приватного тесту':'Потрібне підключення відеосервісу',connecting:'Підключаємо трансляцію…',live:'Ви в ефірі',reconnecting:'Відновлюємо з’єднання…',disconnected:'Ефір завершено',error:'Не вдалося запустити ефір'})[status];
    const sending=['live','reconnecting'].includes(status);document.querySelector('.offline-badge').textContent=sending?'ПРИВАТНИЙ ЕФІР':'Ефір не запущено';document.querySelector('.local-badge').textContent=sending?'ПЕРЕДАЄТЬСЯ ГЛЯДАЧЕВІ':'ВИДНО ЛИШЕ ВАМ';
  }
  const connection=new LiveConnection({onState(next,detail){status=next;if(['error','disconnected','idle'].includes(next))cleanup();update();if(detail)message(detail,'error');if(next==='live')message('Приватний ефір запущено. Камера, вибраний матеріал і мікрофон передаються у кімнату. Залишайте студію відкритою.');}});
  start.addEventListener('click',async()=>{
    if(!presenterAuthorized&&!presenterTicket&&!telegramData()){message('Для приватного ефіру потрібне особисте посилання входу ведучого. Воно видається окремо від кімнати глядача після підключення відеосервісу.','error');return;}
    const state=getState();if(!state.videoReady){message('Увімкніть камеру, відкрийте слайди або оберіть екран перед початком ефіру.','error');return;}
    try{cleanup();program=new ProgramStream({getState});await program.resume();const connected=await connection.connect('presenter',{stream:program.stream,presenterTicket});if(!connected)cleanup();}catch(error){cleanup();status='error';update();message(error.message||'Браузер не підтримує передавання кадру. Відкрийте студію в Chrome або Edge.','error');}
  });
  stop.addEventListener('click',async()=>{await connection.disconnect();message('Ефір завершено. Джерела залишилися у вашому попередньому перегляді.');});
  async function initialize(){try{const result=await liveRequest('status');configured=!!result.configured;presenterAuthorized=!!result.presenterAuthorized;$('broadcast-help').textContent=configured?'Натисніть «Почати ефір», коли підготуєте кадр. Доступ дозволений лише власнику тесту.':liveMessages.LIVE_SERVICE_NOT_CONFIGURED;}catch(error){$('broadcast-help').textContent=error.message;}update();}
  initialize();update();
  return {get active(){return ['connecting','live','reconnecting'].includes(status);},stop(){cleanup();return connection.disconnect();}};
}
