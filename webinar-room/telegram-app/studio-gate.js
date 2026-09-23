const status=document.getElementById('status');
let ticket=new URLSearchParams(location.hash.slice(1)).get('presenter');
history.replaceState(null,'',location.pathname);
if(!ticket)status.textContent='Для запуску потрібен особистий вхід через твій Telegram.';
else{
  try{
    const response=await fetch('/api/studio/session',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({presenterTicket:ticket}),signal:AbortSignal.timeout(15000)});
    ticket=null;
    if(!response.ok)throw new Error('Посилання недійсне або минули 5 хвилин. Отримай нове через кнопку «🎙 Вхід ведучого» у боті.');
    location.replace('/studio.html');
  }catch(error){ticket=null;status.textContent=error.name==='TimeoutError'?'Сервер не відповів. Отримай нове посилання та спробуй ще раз.':error.message;}
}
