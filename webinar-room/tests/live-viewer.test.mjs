import test from 'node:test';
import assert from 'node:assert/strict';

test('viewer waits for actual video, distinguishes reconnect/end, and respects manual exit',async()=>{
  const saved={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch};
  const elements=new Map(),windowEvents={},documentEvents={},rooms=[];
  const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',dataset:{},children:[],events:{},classList:{toggle(){}},addEventListener(type,fn){this.events[type]=fn;},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},async play(){}});return elements.get(id);};
  const RoomEvent={Reconnecting:'reconnecting',Reconnected:'reconnected',Disconnected:'disconnected',TrackSubscribed:'subscribed',TrackUnsubscribed:'unsubscribed',ParticipantConnected:'joined',ParticipantDisconnected:'left'};
  class Room{constructor(){this.events={};this.localParticipant={identity:'viewer-self',name:'Олена'};this.remoteParticipants=new Map();rooms.push(this);}on(event,fn){this.events[event]=fn;}async connect(){}async disconnect(){}emit(event,...args){this.events[event]?.(...args);}}
  globalThis.document={hidden:false,getElementById:element,querySelector:element,createElement:()=>element(Symbol()),addEventListener(type,fn){documentEvents[type]=fn;}};
  globalThis.window={LivekitClient:{Room,RoomEvent,Track:{}},addEventListener(type,fn){windowEvents[type]=fn;}};
  globalThis.fetch=async url=>Response.json(String(url).endsWith('/status')?{configured:true,serverTime:Date.now()}:{url:'wss://test.invalid',token:'fixture',presenterIdentity:'ik-presenter'});
  try{
    await import('../dist/live-viewer.js');await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(rooms.length,1);assert.equal(element('.viewer-stage').dataset.state,'waiting');assert.equal(element('live-audience-count').textContent,'52');assert.equal(element('viewer-stage-audience-count').textContent,'52');
    const track={kind:'video',attach(){},detach(){return[];}},presenter={identity:'ik-presenter'};
    rooms[0].emit('subscribed',track,{},presenter);assert.equal(element('.viewer-stage').dataset.state,'live');
    rooms[0].emit('reconnecting');assert.equal(element('.viewer-stage').dataset.state,'reconnecting');
    rooms[0].emit('reconnected');assert.equal(element('.viewer-stage').dataset.state,'live');
    rooms[0].emit('left',presenter);assert.equal(element('.viewer-stage').dataset.state,'ended');
    await element('leave-live').events.click();assert.equal(element('.viewer-stage').dataset.state,'paused');
    documentEvents.visibilitychange();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(rooms.length,1);
  }finally{windowEvents.pagehide?.();await new Promise(resolve=>setTimeout(resolve,0));for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
