import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveConnection} from '../dist/live-connection.js';

test('late events from an old room cannot clear a reconnected viewer',async()=>{
  const originalFetch=globalThis.fetch,originalWindow=globalThis.window;
  const rooms=[];let removed=0,left=0,received=0;
  const RoomEvent={Reconnecting:'reconnecting',Reconnected:'reconnected',Disconnected:'disconnected',TrackSubscribed:'subscribed',TrackUnsubscribed:'unsubscribed',ParticipantConnected:'joined',ParticipantDisconnected:'left'};
  class Room{constructor(){this.events={};this.remoteParticipants=new Map();this.localParticipant={identity:'viewer-self',name:'Справжній глядач'};rooms.push(this);}on(event,cb){this.events[event]=cb;}async connect(){}async disconnect(){}emit(event,...args){this.events[event]?.(...args);}}
  globalThis.window={LivekitClient:{Room,RoomEvent,Track:{}}};
  globalThis.fetch=async()=>Response.json({url:'wss://test.invalid',token:'fixture',presenterIdentity:'ik-presenter'});
  try{
    const client=new LiveConnection({onTrack(){received++;},onTrackRemoved(){removed++;},onParticipantLeft(){left++;}});
    await client.connect('viewer');await client.disconnect();await client.connect('viewer');
    const presenter={identity:'ik-presenter'},track={kind:'video'};
    rooms[0].emit('unsubscribed',track,{},presenter);rooms[0].emit('left',presenter);rooms[0].emit('subscribed',track,{},presenter);
    assert.equal(removed,0);assert.equal(left,0);assert.equal(received,0);
    rooms[1].emit('unsubscribed',track,{}, {identity:'other'});assert.equal(removed,0);
    rooms[1].emit('subscribed',track,{},presenter);rooms[1].emit('unsubscribed',track,{},presenter);rooms[1].emit('left',presenter);
    assert.equal(received,1);assert.equal(removed,1);assert.equal(left,1);await client.disconnect();
  }finally{globalThis.fetch=originalFetch;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('audience reports only real connected viewers and excludes the presenter',async()=>{
  const originalFetch=globalThis.fetch,originalWindow=globalThis.window,updates=[];
  const RoomEvent={Reconnecting:'reconnecting',Reconnected:'reconnected',Disconnected:'disconnected',TrackSubscribed:'subscribed',TrackUnsubscribed:'unsubscribed',ParticipantConnected:'joined',ParticipantDisconnected:'left'};
  let room;class Room{constructor(){room=this;this.events={};this.localParticipant={identity:'viewer-self',name:'Олена'};this.remoteParticipants=new Map([['ik-presenter',{identity:'ik-presenter',name:'Іван'}]]);}on(event,cb){this.events[event]=cb;}async connect(){}async disconnect(){}emit(event,...args){this.events[event]?.(...args);}}
  globalThis.window={LivekitClient:{Room,RoomEvent,Track:{}}};
  globalThis.fetch=async()=>Response.json({url:'wss://test.invalid',token:'fixture',presenterIdentity:'ik-presenter'});
  try{
    const client=new LiveConnection({onParticipants:update=>updates.push(update)});await client.connect('viewer');
    assert.equal(updates.at(-1).count,1);assert.deepEqual(updates.at(-1).participants.map(item=>item.name),['Олена']);
    const real={identity:'viewer-2',name:'Андрій'};room.remoteParticipants.set(real.identity,real);room.emit('joined',real);
    assert.equal(updates.at(-1).count,2);assert.deepEqual(updates.at(-1).participants.map(item=>item.name),['Олена','Андрій']);
    room.remoteParticipants.delete(real.identity);room.emit('left',real);assert.equal(updates.at(-1).count,1);
    await client.disconnect();assert.equal(updates.at(-1).count,0);
  }finally{globalThis.fetch=originalFetch;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});
