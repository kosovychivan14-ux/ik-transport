const expandLabel='Відкрити відео на весь екран';
const collapseLabel='Згорнути відео';
const fallbackMessage='Системний повноекранний режим недоступний. Відео розгорнуто в межах сторінки.';

export function setupViewerFullscreen({player,button,room,notice,win=window,doc=document}){
  if(!player||!button||!room)throw new TypeError('Fullscreen controls require player, button and room elements.');
  let mode='none',destroyed=false,suppressAuto=false,operation=0;
  let telegramPending=0,telegramOwns=false,telegramLinked=false;
  let browserPending=0,browserOwns=false;
  const telegram=win.Telegram?.WebApp;
  const telegramApp=!!telegram?.initData;
  const telegramV8=telegramApp&&telegram.isVersionAtLeast?.('8.0')===true;
  const telegramFullscreen=telegramV8&&typeof telegram.requestFullscreen==='function'&&typeof telegram.exitFullscreen==='function';
  const telegramMobile=telegramApp&&['ios','android'].includes(String(telegram.platform).toLowerCase());
  const orientation=win.matchMedia?.('(orientation: landscape)');
  const coarse=win.matchMedia?.('(pointer: coarse)');

  function setNotice(message=''){
    if(!notice)return;
    notice.textContent=message;notice.hidden=!message;
  }
  function render(){
    const expanded=mode!=='none';
    player.classList.toggle('is-expanded',expanded);doc.body?.classList.toggle('viewer-expanded',expanded);
    if(player.dataset)player.dataset.fullscreenMode=mode;
    button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',expanded?collapseLabel:expandLabel);
    button.textContent=expanded?'Згорнути ⤡':'На весь екран ⛶';
  }
  function landscape(){return orientation?orientation.matches:win.innerWidth>win.innerHeight;}
  function mobileLandscape(){
    const mobile=telegramMobile||!!coarse?.matches;
    return mobile&&landscape();
  }
  function roomVisible(){
    return !room.hidden&&room.getAttribute?.('aria-hidden')!=='true'&&!room.closest?.('[hidden]');
  }
  function safeTelegramExit(){
    try{const result=telegram.exitFullscreen();result?.catch?.(()=>{});}catch{}
    telegramOwns=false;telegramLinked=false;
  }
  function safeBrowserExit(){
    try{const result=doc.exitFullscreen?.();result?.catch?.(()=>{});}catch{}
    browserOwns=false;
  }
  function collapse({focus=false,suppress=false,native=true}={}){
    const wasManual=mode==='manual';++operation;mode='none';
    if(suppress&&landscape())suppressAuto=true;
    render();setNotice();
    if(native){
      if(telegramFullscreen){
        // A fullscreen Telegram app that predated this controller is deliberately preserved.
        if(telegramOwns)safeTelegramExit();
      }else if(doc.fullscreenElement===player||browserOwns)safeBrowserExit();
    }
    if(focus&&wasManual)try{button.focus({preventScroll:true});}catch{}
  }
  function telegramFailure(error,token){
    if(token&&telegramPending!==token)return;
    const pending=telegramPending;telegramPending=0;
    if(destroyed){removeTelegramListeners();return;}
    const code=typeof error==='string'?error:error?.error;
    if(code==='ALREADY_FULLSCREEN'){
      if(mode==='none'&&pending)safeTelegramExit();
      else{telegramLinked=true;telegramOwns=false;}
      return;
    }
    if(mode==='manual'&&(!token||token===operation))setNotice(fallbackMessage);
  }
  function onTelegramChanged(){
    if(destroyed){const pending=telegramPending;telegramPending=0;if(pending&&telegram.isFullscreen)safeTelegramExit();removeTelegramListeners();return;}
    if(telegram.isFullscreen){
      const token=telegramPending;telegramPending=0;
      if(token){
        if(mode==='none'||token!==operation){safeTelegramExit();return;}
        telegramOwns=true;telegramLinked=true;setNotice();
      }
      return;
    }
    const linked=telegramLinked;telegramOwns=false;telegramLinked=false;
    if(linked&&mode!=='none')collapse({focus:mode==='manual',suppress:true,native:false});
  }
  function requestTelegram(token){
    if(telegram.isFullscreen){telegramLinked=true;telegramOwns=false;return;}
    telegramPending=token;
    try{
      const result=telegram.requestFullscreen();
      result?.then?.(()=>{
        if(destroyed){if(telegram.isFullscreen)safeTelegramExit();removeTelegramListeners();return;}
        if(mode==='none'||token!==operation){if(telegram.isFullscreen)safeTelegramExit();return;}
        if(telegram.isFullscreen)onTelegramChanged();
      },error=>telegramFailure(error,token));
    }catch(error){telegramFailure(error,token);}
  }
  function requestBrowser(token){
    if(typeof player.requestFullscreen!=='function'){setNotice(fallbackMessage);return;}
    if(doc.fullscreenElement===player){browserOwns=false;return;}
    browserPending=token;
    try{
      const result=player.requestFullscreen();
      Promise.resolve(result).then(()=>{
        if(destroyed){if(doc.fullscreenElement===player)safeBrowserExit();return;}
        if(mode==='none'||token!==operation){if(doc.fullscreenElement===player)safeBrowserExit();return;}
        browserPending=0;browserOwns=doc.fullscreenElement===player;setNotice(browserOwns?'':fallbackMessage);
      },()=>{
        if(browserPending===token)browserPending=0;
        if(mode==='manual'&&token===operation)setNotice(fallbackMessage);
      });
    }catch{
      if(browserPending===token)browserPending=0;
      if(mode==='manual'&&token===operation)setNotice(fallbackMessage);
    }
  }
  function expandManual(){
    setNotice();mode='manual';const token=++operation;render();
    if(telegramApp){
      if(telegramFullscreen)requestTelegram(token);
      else setNotice(fallbackMessage);
    }else requestBrowser(token);
  }
  function evaluateAuto(){
    if(destroyed)return;
    const isLandscape=landscape();
    if(!isLandscape)suppressAuto=false;
    const shouldExpand=mobileLandscape()&&roomVisible();
    if(mode==='manual')return;
    if(mode==='auto'&&!shouldExpand){collapse();return;}
    if(mode==='none'&&shouldExpand&&!suppressAuto){mode='auto';const token=++operation;setNotice();render();if(telegramFullscreen)requestTelegram(token);}
  }
  function onButton(){
    if(mode==='none')expandManual();
    else collapse({focus:true,suppress:true});
  }
  function onKeydown(event){if(event.key==='Escape'&&mode!=='none')collapse({focus:true,suppress:true});}
  function onBrowserFullscreen(){
    if(destroyed||telegramApp)return;
    if(doc.fullscreenElement===player){
      if(browserPending){
        if(mode==='none'||browserPending!==operation){browserPending=0;safeBrowserExit();return;}
        browserOwns=true;browserPending=0;
      }
      return;
    }
    const owned=browserOwns;browserOwns=false;browserPending=0;
    if(owned&&mode==='manual')collapse({focus:true,suppress:true,native:false});
  }
  function onNavigation(){queueMicrotask(()=>{if(destroyed)return;if(!roomVisible()){if(mode!=='none')collapse();}else evaluateAuto();});}
  function onPageHide(){if(mode!=='none')collapse({suppress:true});}
  function addMediaListener(query,listener){query?.addEventListener?.('change',listener);}
  function removeMediaListener(query,listener){query?.removeEventListener?.('change',listener);}
  function removeTelegramListeners(){telegram?.offEvent?.('fullscreenChanged',onTelegramChanged);telegram?.offEvent?.('fullscreenFailed',telegramFailure);}

  button.addEventListener('click',onButton);doc.addEventListener('keydown',onKeydown);doc.addEventListener('fullscreenchange',onBrowserFullscreen);
  win.addEventListener('resize',evaluateAuto);win.addEventListener('orientationchange',evaluateAuto);win.addEventListener('hashchange',onNavigation);win.addEventListener('popstate',onNavigation);win.addEventListener('pagehide',onPageHide);
  addMediaListener(orientation,evaluateAuto);addMediaListener(coarse,evaluateAuto);
  if(telegramFullscreen){telegram.onEvent?.('fullscreenChanged',onTelegramChanged);telegram.onEvent?.('fullscreenFailed',telegramFailure);try{const value=telegram.unlockOrientation?.();value?.catch?.(()=>{});}catch{}}
  render();evaluateAuto();

  return function cleanup(){
    if(destroyed)return;collapse({native:true});destroyed=true;
    button.removeEventListener('click',onButton);doc.removeEventListener('keydown',onKeydown);doc.removeEventListener('fullscreenchange',onBrowserFullscreen);
    win.removeEventListener('resize',evaluateAuto);win.removeEventListener('orientationchange',evaluateAuto);win.removeEventListener('hashchange',onNavigation);win.removeEventListener('popstate',onNavigation);win.removeEventListener('pagehide',onPageHide);
    removeMediaListener(orientation,evaluateAuto);removeMediaListener(coarse,evaluateAuto);
    if(!telegramPending)removeTelegramListeners();
  };
}
