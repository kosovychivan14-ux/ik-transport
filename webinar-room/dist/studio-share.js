const invite='https://ik-webinar-telegram-test.vercel.app/live.html#room';
const button=document.querySelector('#copy-viewer-invite');
const status=document.querySelector('#viewer-share-status');
button?.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(invite);status.textContent='URL скопійовано. Вставте його в кнопку Web App / Mini App у повідомленні SendPulse.';}
  catch{status.textContent='Не вдалося скопіювати автоматично. Виділіть і скопіюйте URL вище.';}
});
