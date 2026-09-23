const OFFLINE_RESPONSE='Студія потребує з’єднання з інтернетом. Перевірте мережу та відкрийте її знову.';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>new Response(OFFLINE_RESPONSE,{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});
