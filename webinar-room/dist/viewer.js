import {setupViewerFullscreen} from './viewer-fullscreen.js';
const pages=[...document.querySelectorAll('[data-page]')];
const tabs=[...document.querySelectorAll('[data-tab]')];

function setPage(){
  const requested=location.hash.slice(1);
  const name=pages.some(page=>page.dataset.page===requested)?requested:'room';
  if(!location.hash)history.replaceState(null,'','#room');
  for(const page of pages)page.hidden=page.dataset.page!==name;
  for(const tab of tabs){
    const active=tab.dataset.tab===name;
    if(active)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');
  }
  const titles={room:'Кімната',schedule:'Розклад',records:'Записи',lessons:'Закриті уроки',tools:'Готові інструменти',strategies:'Стратегії',insights:'VIP-розбори'};
  document.title=`${titles[name]||'Кімната'} — Іван Косович`;
}

window.addEventListener('hashchange',setPage);
setPage();

setupViewerFullscreen({player:document.querySelector('.viewer-player'),button:document.querySelector('[data-fullscreen]'),room:document.getElementById('room'),notice:document.getElementById('fullscreen-notice')});

try{
  const app=window.Telegram?.WebApp;
  if(app?.initData){app.ready();app.expand();app.setHeaderColor?.('#101513');app.setBackgroundColor?.('#101513');
    const updateInsets=()=>{document.documentElement.style.setProperty('--safe-top',Math.max(app.safeAreaInset?.top||0,app.contentSafeAreaInset?.top||0)+'px');document.documentElement.style.setProperty('--safe-bottom',Math.max(app.safeAreaInset?.bottom||0,app.contentSafeAreaInset?.bottom||0)+'px');for(const edge of ['left','right'])document.documentElement.style.setProperty('--safe-'+edge,Math.max(app.safeAreaInset?.[edge]||0,app.contentSafeAreaInset?.[edge]||0)+'px');};
    updateInsets();app.onEvent?.('safeAreaChanged',updateInsets);app.onEvent?.('contentSafeAreaChanged',updateInsets);
  }
}catch{}
