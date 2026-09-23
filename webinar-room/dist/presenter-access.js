import {liveRequest,telegramData,liveMessages} from './live-connection.js';
const $=id=>document.getElementById(id);
let presenterHref='',linkTimer=0;
$('make-presenter-link').addEventListener('click',async()=>{
  $('make-presenter-link').disabled=true;$('presenter-link-status').textContent='Перевіряємо доступ ведучого…';
  try{const result=await liveRequest('presenter-access',{initData:telegramData()});const url=new URL('/studio.html','https://ik-webinar-telegram-test.vercel.app');url.hash=new URLSearchParams({presenter:result.presenterTicket}).toString();presenterHref=url.href;$('presenter-link').href=presenterHref;$('presenter-link').hidden=false;$('copy-presenter-link').hidden=false;$('presenter-link-status').textContent='Особисте посилання готове. Відкрийте протягом 5 хвилин.';clearTimeout(linkTimer);linkTimer=setTimeout(()=>{presenterHref='';$('presenter-link').removeAttribute('href');$('presenter-link').hidden=true;$('copy-presenter-link').hidden=true;$('presenter-link-status').textContent='Посилання прострочене. Отримайте нове.';},Math.max(0,result.expiresAt*1000-Date.now()));}catch(error){$('presenter-link-status').textContent=error.message;}finally{$('make-presenter-link').disabled=false;}
});
$('copy-presenter-link').addEventListener('click',async()=>{if(!presenterHref)return;try{await navigator.clipboard.writeText(presenterHref);$('presenter-link-status').textContent='Посилання скопійовано. Вставте його в адресний рядок Chrome або Edge.';}catch{$('presenter-link-status').textContent='Скористайтеся посиланням «Відкрити студію» вище.';}});

window.addEventListener('pagehide',()=>{clearTimeout(linkTimer);presenterHref='';});
try{const status=await liveRequest('status');$('make-presenter-link').disabled=!status.configured;if(!status.configured)$('presenter-link-status').textContent=liveMessages.LIVE_SERVICE_NOT_CONFIGURED;}catch(error){$('make-presenter-link').disabled=true;$('presenter-link-status').textContent=error.message;}
