export function setupStudioPreviewFullscreen({shell,button,previous,next,doc=document}={}){
  if(!shell||!button)throw new TypeError('Preview fullscreen requires shell and button elements.');
  let expanded=false,nativeOwned=false,destroyed=false;
  function render(){shell.classList.toggle('is-fullscreen',expanded);button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',expanded?'Згорнути попередній перегляд':'Розгорнути попередній перегляд на весь екран');button.textContent=expanded?'Згорнути ⤡':'Розгорнути слайди ⛶';}
  async function open(){expanded=true;render();if(typeof shell.requestFullscreen!=='function')return;try{await shell.requestFullscreen();if(destroyed){if(doc.fullscreenElement===shell)await doc.exitFullscreen?.();return;}nativeOwned=doc.fullscreenElement===shell;}catch{nativeOwned=false;}}
  async function close(){expanded=false;render();if(nativeOwned&&doc.fullscreenElement===shell)try{await doc.exitFullscreen?.();}catch{}nativeOwned=false;}
  function toggle(){if(expanded)close();else open();}
  function onFullscreenChange(){if(destroyed)return;if(doc.fullscreenElement===shell){nativeOwned=true;expanded=true;render();return;}if(nativeOwned){nativeOwned=false;expanded=false;render();}}
  function onKeydown(event){if(!expanded)return;if(event.key==='Escape'&&!nativeOwned){event.preventDefault();close();return;}if(['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName))return;if(event.key==='ArrowLeft'&&!previous?.disabled){event.preventDefault();previous.click();}if(event.key==='ArrowRight'&&!next?.disabled){event.preventDefault();next.click();}}
  button.addEventListener('click',toggle);doc.addEventListener('fullscreenchange',onFullscreenChange);doc.addEventListener('keydown',onKeydown);render();
  return ()=>{destroyed=true;button.removeEventListener('click',toggle);doc.removeEventListener('fullscreenchange',onFullscreenChange);doc.removeEventListener('keydown',onKeydown);if(expanded)close();};
}
