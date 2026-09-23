import test from 'node:test';
import assert from 'node:assert/strict';
import {setupViewerFullscreen} from '../dist/viewer-fullscreen.js';

class Emitter {
  constructor(){this.listeners=new Map();}
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener);}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
  emit(type,event={}){for(const listener of [...this.listeners.get(type)||[]])listener(event);}
}
class Classes {
  constructor(){this.values=new Set();}
  toggle(name,on){if(on)this.values.add(name);else this.values.delete(name);}
  contains(name){return this.values.has(name);}
}
function element(){
  const target=new Emitter();return Object.assign(target,{classList:new Classes(),attrs:{},dataset:{},hidden:false,textContent:'',focused:0,
    setAttribute(name,value){this.attrs[name]=String(value);},getAttribute(name){return this.attrs[name]??null;},
    closest(){return null;},focus(){this.focused++;},click(){this.emit('click');},
  });
}
function media(matches=false){const value=new Emitter();value.matches=matches;return value;}
function deferred(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});return {promise,resolve,reject};}
function fixture({telegram=null,coarse=false,landscape=false,width=390,height=844,requestFullscreen}={}){
  const player=element(),button=element(),room=element(),notice=element(),win=new Emitter(),doc=new Emitter();doc.body=element();doc.fullscreenElement=null;
  const orientation=media(landscape),pointer=media(coarse);win.innerWidth=width;win.innerHeight=height;win.Telegram=telegram?{WebApp:telegram}:undefined;
  win.matchMedia=query=>query.includes('orientation')?orientation:pointer;
  let browserExit=0;doc.exitFullscreen=()=>{browserExit++;doc.fullscreenElement=null;doc.emit('fullscreenchange');return Promise.resolve();};
  if(requestFullscreen)player.requestFullscreen=requestFullscreen.bind(null,{player,doc});
  const cleanup=setupViewerFullscreen({player,button,room,notice,win,doc});
  return {player,button,room,notice,win,doc,orientation,pointer,cleanup,browserExit:()=>browserExit};
}
function telegram(){
  const handlers=new Map();return {initData:'signed',platform:'android',isFullscreen:false,requests:0,exits:0,unlocks:0,
    isVersionAtLeast:()=>true,requestFullscreen(){this.requests++;},exitFullscreen(){this.exits++;this.isFullscreen=false;},unlockOrientation(){this.unlocks++;},
    onEvent(name,listener){handlers.set(name,listener);},offEvent(name,listener){if(handlers.get(name)===listener)handlers.delete(name);},emit(name,value){handlers.get(name)?.(value);},
  };
}

test('Telegram fullscreen success updates controls and exits only fullscreen owned by the controller',()=>{
  const tg=telegram(),value=fixture({telegram:tg});assert.equal(tg.unlocks,1);
  assert.equal(value.button.textContent,'На весь екран ⛶');value.button.click();assert.equal(value.player.classList.contains('is-expanded'),true);assert.equal(tg.requests,1);assert.equal(value.button.attrs['aria-pressed'],'true');assert.equal(value.button.textContent,'Згорнути ⤡');
  tg.isFullscreen=true;tg.emit('fullscreenChanged');value.button.click();assert.equal(tg.exits,1);assert.equal(value.player.classList.contains('is-expanded'),false);assert.equal(value.button.attrs['aria-label'],'Відкрити відео на весь екран');
  value.cleanup();
});

test('unsupported Telegram fullscreen keeps CSS fallback and reports it',()=>{
  const tg=telegram();tg.requestFullscreen=function(){this.requests++;this.emit('fullscreenFailed',{error:'UNSUPPORTED'});};
  const value=fixture({telegram:tg});value.button.click();
  assert.equal(value.player.classList.contains('is-expanded'),true);assert.match(value.notice.textContent,/недоступний/);assert.equal(value.notice.hidden,false);
  value.cleanup();
});

test('an app that was already fullscreen is preserved when local expansion closes',()=>{
  const tg=telegram();tg.isFullscreen=true;const value=fixture({telegram:tg});
  value.button.click();value.button.click();assert.equal(tg.requests,0);assert.equal(tg.exits,0);assert.equal(tg.isFullscreen,true);
  value.cleanup();
});

test('browser rejection leaves the contained CSS fullscreen usable',async()=>{
  const value=fixture({requestFullscreen:()=>Promise.reject(new Error('denied'))});value.button.click();await Promise.resolve();await Promise.resolve();
  assert.equal(value.player.classList.contains('is-expanded'),true);assert.equal(value.doc.body.classList.contains('viewer-expanded'),true);assert.match(value.notice.textContent,/недоступний/);
  value.cleanup();
});

test('late browser fullscreen completion after cancel is immediately released',async()=>{
  const pending=deferred();const value=fixture({requestFullscreen:({player,doc})=>pending.promise.then(()=>{doc.fullscreenElement=player;doc.emit('fullscreenchange');})});
  value.button.click();value.button.click();assert.equal(value.player.classList.contains('is-expanded'),false);
  pending.resolve();await pending.promise;await Promise.resolve();await Promise.resolve();
  assert.equal(value.browserExit(),1);assert.equal(value.doc.fullscreenElement,null);assert.equal(value.player.classList.contains('is-expanded'),false);
  value.cleanup();
});

test('cleanup also releases a browser fullscreen request that completes late',async()=>{
  const pending=deferred();const value=fixture({requestFullscreen:({player,doc})=>pending.promise.then(()=>{doc.fullscreenElement=player;doc.emit('fullscreenchange');})});
  value.button.click();value.cleanup();pending.resolve();await pending.promise;await Promise.resolve();await Promise.resolve();
  assert.equal(value.browserExit(),1);assert.equal(value.doc.fullscreenElement,null);assert.equal(value.player.classList.contains('is-expanded'),false);
});

test('a resolved browser request without a fullscreen element reports CSS fallback',async()=>{
  const value=fixture({requestFullscreen:()=>Promise.resolve()});value.button.click();await Promise.resolve();await Promise.resolve();
  assert.equal(value.player.classList.contains('is-expanded'),true);assert.match(value.notice.textContent,/недоступний/);
  value.button.click();assert.equal(value.notice.hidden,true);value.cleanup();
});

test('landscape auto mode rotates back, respects manual collapse, and manual mode survives portrait',()=>{
  const value=fixture({coarse:true,landscape:false,width:390,height:844});assert.equal(value.player.classList.contains('is-expanded'),false);
  value.orientation.matches=true;value.win.innerWidth=844;value.win.innerHeight=390;value.orientation.emit('change');assert.equal(value.player.classList.contains('is-expanded'),true);
  value.button.click();assert.equal(value.player.classList.contains('is-expanded'),false);value.win.emit('resize');assert.equal(value.player.classList.contains('is-expanded'),false);
  value.orientation.matches=false;value.win.innerWidth=390;value.win.innerHeight=844;value.orientation.emit('change');
  value.orientation.matches=true;value.win.innerWidth=844;value.win.innerHeight=390;value.orientation.emit('change');assert.equal(value.player.classList.contains('is-expanded'),true);
  value.button.click();value.button.click();assert.equal(value.player.classList.contains('is-expanded'),true);
  value.orientation.matches=false;value.win.innerWidth=390;value.win.innerHeight=844;value.orientation.emit('change');assert.equal(value.player.classList.contains('is-expanded'),true);
  value.doc.emit('keydown',{key:'Escape'});assert.equal(value.player.classList.contains('is-expanded'),false);assert.equal(value.button.focused,1);
  value.cleanup();
});

test('Telegram landscape auto mode requests native fullscreen and exits it on portrait',()=>{
  const tg=telegram(),value=fixture({telegram:tg,coarse:true,landscape:false,width:390,height:844});
  value.orientation.matches=true;value.win.innerWidth=844;value.win.innerHeight=390;value.orientation.emit('change');
  assert.equal(value.player.classList.contains('is-expanded'),true);assert.equal(tg.requests,1);assert.equal(value.player.dataset.fullscreenMode,'auto');
  tg.isFullscreen=true;tg.emit('fullscreenChanged');value.orientation.matches=false;value.win.innerWidth=390;value.win.innerHeight=844;value.orientation.emit('change');
  assert.equal(tg.exits,1);assert.equal(value.player.classList.contains('is-expanded'),false);value.cleanup();
});

test('external native exit suppresses landscape re-entry until portrait',async()=>{
  const value=fixture({coarse:true,landscape:true,width:844,height:390,requestFullscreen:({player,doc})=>{doc.fullscreenElement=player;doc.emit('fullscreenchange');return Promise.resolve();}});
  value.button.click();value.button.click();await Promise.resolve();assert.equal(value.doc.fullscreenElement,value.player);
  value.doc.fullscreenElement=null;value.doc.emit('fullscreenchange');assert.equal(value.player.classList.contains('is-expanded'),false);
  value.win.emit('resize');assert.equal(value.player.classList.contains('is-expanded'),false);
  value.orientation.matches=false;value.win.innerWidth=390;value.win.innerHeight=844;value.orientation.emit('change');
  value.orientation.matches=true;value.win.innerWidth=844;value.win.innerHeight=390;value.orientation.emit('change');assert.equal(value.player.classList.contains('is-expanded'),true);
  value.cleanup();
});

test('hash navigation exits away from the room and restores landscape auto mode on return',async()=>{
  const value=fixture({coarse:true,landscape:true,width:844,height:390});assert.equal(value.player.classList.contains('is-expanded'),true);
  value.room.hidden=true;value.win.emit('hashchange');await Promise.resolve();assert.equal(value.player.classList.contains('is-expanded'),false);
  value.room.hidden=false;value.win.emit('hashchange');await Promise.resolve();assert.equal(value.player.classList.contains('is-expanded'),true);
  value.cleanup();
});
