import {loadSlideDeck,normalizeWebsite} from './slide-deck.js';
export function setupMaterials({showSlides,removeSlides,shareScreen,message}){
  const $=id=>document.getElementById(id);
  let deck=null,page=0,version=0,busy=false,fetchController=null,savedActive=false;
  const status=(text,error=false)=>{$('materials-status').textContent=text;$('materials-status').dataset.type=error?'error':'info';};
  function controls(){
    $('slide-prev').disabled=busy||!deck||page===0;$('slide-next').disabled=busy||!deck||page===deck.count-1;
    $('slide-number').disabled=busy||!deck;$('slide-number').max=deck?.count||1;$('slide-number').value=page+1;
    $('slide-count').textContent=deck?`із ${deck.count}`:'із 0';
    $('show-slides').disabled=busy||!deck;$('remove-slides').disabled=!deck&&!busy;
    $('deck-name').textContent=deck?.name||'Презентацію ще не відкрито';$('slides-navigation').hidden=!deck;
    $('slide-layer').setAttribute('aria-busy',String(busy));
    $('load-saved-slides').disabled=busy;
  }
  function display(canvas){canvas.setAttribute('aria-label',`Слайд ${page+1} із ${deck.count}`);canvas.setAttribute('role','img');$('slide-layer').replaceChildren(canvas);window.dispatchEvent(new CustomEvent('studio:slide-change',{detail:{slideNumber:page+1,slideCount:deck.count}}));}
  async function load(files,saved=false){
    if(!saved&&!files.length)return;
    const request=++version;fetchController?.abort();
    const controller=new AbortController();fetchController=controller;
    busy=true;controls();status(saved?'Завантажуємо E-Transport українською — 27,6 МБ…':'Відкриваємо презентацію…');let incoming;
    try{
      if(saved){
        const response=await fetch('/assets/presentations/e-transport.pdf',{signal:controller.signal});
        if(!response.ok)throw new Error('Не вдалося завантажити E-Transport. Перевірте з’єднання й натисніть кнопку ще раз.');
        let blob=await response.blob();
        if(response.status===206){
          const total=Number(response.headers.get('content-range')?.split('/')[1]);
          if(!Number.isSafeInteger(total)||total<=0||total>80*1024*1024)throw new Error('Некоректний розмір презентації.');
          const parts=[blob];let offset=blob.size;
          while(offset<total){const part=await fetch('/assets/presentations/e-transport.pdf',{signal:controller.signal,headers:{Range:`bytes=${offset}-`}});if(part.status!==206||!part.headers.get('content-range')?.startsWith(`bytes ${offset}-`))throw new Error('Не вдалося завантажити частину презентації.');const chunk=await part.blob();if(!chunk.size)throw new Error('Порожня частина презентації.');parts.push(chunk);offset+=chunk.size;}
          if(offset!==total)throw new Error('Розмір презентації не збігається.');blob=new Blob(parts,{type:'application/pdf'});
        }
        if(request!==version)return;
        files=[new File([blob],'E-Transport_UA.pdf',{type:'application/pdf'})];
      }
      incoming=await loadSlideDeck(files);const canvas=await incoming.render(0);
      if(request!==version){await incoming.dispose();return;}
      const old=deck;deck=incoming;savedActive=saved;page=0;display(canvas);busy=false;controls();showSlides();
      old?.dispose().catch(()=>{});status(saved?`E-Transport українською відкрито. Слайдів: ${deck.count}. Презентація збережена у студії.`:`Готово. Слайдів: ${deck.count}. Цей файл відкрито лише до перезавантаження вкладки.`);
    }catch(error){if(incoming&&incoming!==deck)await incoming.dispose().catch(()=>{});if(request===version){busy=false;controls();status(error.message||'Не вдалося додати презентацію.',true);}}
  }
  async function goTo(next){
    if(!deck||busy)return;const target=Math.min(deck.count-1,Math.max(0,Number(next)));
    if(!Number.isInteger(target)||target===page){controls();return;}
    const request=++version;busy=true;controls();
    try{const canvas=await deck.render(target);if(request!==version)return;page=target;display(canvas);status(`Слайд ${page+1} із ${deck.count}`);}
    catch(error){if(request===version)status(error.message||'Не вдалося відкрити слайд.',true);}
    finally{if(request===version){busy=false;controls();}}
  }
  $('slides-file').addEventListener('change',event=>{load([...event.target.files]);event.target.value='';});
  $('load-saved-slides').addEventListener('click',()=>{if(savedActive&&deck)showSlides();else load([],true);});
  $('slide-prev').addEventListener('click',()=>goTo(page-1));$('slide-next').addEventListener('click',()=>goTo(page+1));
  $('slide-number').addEventListener('change',event=>goTo(Number(event.target.value)-1));
  $('slide-number').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();goTo(Number(event.target.value)-1);}});
  $('slides-navigation').addEventListener('keydown',event=>{if(event.target.matches('input'))return;if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();goTo(page+(event.key==='ArrowRight'?1:-1));}});
  document.addEventListener('keydown',event=>{
    if(!deck||busy||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.target.closest?.('input, textarea, select, button, a, [contenteditable=true]'))return;
    const direction=['ArrowRight','PageDown',' '].includes(event.key)?1:['ArrowLeft','PageUp'].includes(event.key)?-1:0;
    if(direction){event.preventDefault();goTo(page+direction);}
  });
  $('show-slides').addEventListener('click',()=>{if(deck)showSlides();});
  $('remove-slides').addEventListener('click',()=>{version++;fetchController?.abort();deck?.dispose().catch(()=>{});deck=null;savedActive=false;page=0;busy=false;$('slide-layer').replaceChildren();controls();removeSlides();status('Презентацію прибрано з перегляду. E-Transport можна знову відкрити кнопкою вище.');});
  $('website-form').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const url=normalizeWebsite($('website-url').value);$('website-url').value=url;
      const link=$('website-link');link.href=url;link.hidden=false;link.textContent=`Відкрити ${new URL(url).hostname} ↗`;
      $('website-guide').hidden=false;status('Посилання готове. Відкрийте сайт, а потім оберіть його вкладку для показу.');
    }catch{status('Вставте коректне посилання на сайт, наприклад https://example.com.',true);}
  });
  $('website-url').addEventListener('input',()=>{$('website-link').hidden=true;$('website-guide').hidden=true;});
  $('share-website').addEventListener('click',()=>shareScreen());
  $('website-link').addEventListener('click',()=>message('Сайт відкривається в окремій вкладці. Поверніться сюди, натисніть «Обрати вкладку або вікно» та оберіть саме цей сайт у запиті браузера.'));
  controls();
  return {get available(){return !!deck;},get busy(){return busy;}};
}
