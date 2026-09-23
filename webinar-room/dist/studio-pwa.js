let installPrompt;
const button=document.querySelector('#install-studio-app');

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/studio-service-worker.js',{scope:'/'}).catch(()=>{}));
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  installPrompt=event;
  if(button)button.hidden=false;
});

button?.addEventListener('click',async()=>{
  if(!installPrompt)return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt=undefined;
  button.hidden=true;
});

window.addEventListener('appinstalled',()=>{if(button)button.hidden=true;});
