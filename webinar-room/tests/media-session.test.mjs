import test from 'node:test';
import assert from 'node:assert/strict';
import {MediaSession,mediaErrorMessage} from '../dist/media-session.js';
class Track extends EventTarget {
  constructor(kind){super();this.kind=kind;this.readyState='live';this.stopCount=0;}
  stop(){this.readyState='ended';this.stopCount++;}
  end(){this.readyState='ended';this.dispatchEvent(new Event('ended'));}
}
function stream(kind){const track=new Track(kind);return {getTracks:()=>[track],track};}
function deferred(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});return {promise,resolve,reject};}
test('opening the studio does not acquire devices and HTTPS failures do not call capture',async()=>{
  let called=0;
  const session=new MediaSession({mediaDevices:{getUserMedia:()=>{called++;}},secureContext:false});
  assert.equal(called,0);assert.equal(session.supported('camera'),false);
  await assert.rejects(session.start('camera'),{name:'InsecureContextError'});assert.equal(called,0);
});
test('stopping during a pending permission request disposes a late stream',async()=>{
  const request=deferred(),camera=stream('video');
  const session=new MediaSession({mediaDevices:{getUserMedia:()=>request.promise}});
  const pending=session.start('camera');assert.equal(session.pending.camera,true);
  session.stopAll();request.resolve(camera);
  assert.equal(await pending,null);assert.equal(camera.track.readyState,'ended');assert.equal(session.active('camera'),false);assert.equal(session.pending.camera,false);
});
test('a stale camera request cannot replace a newer device',async()=>{
  const older=deferred(),newer=deferred(),oldCamera=stream('video'),newCamera=stream('video');let calls=0;
  const session=new MediaSession({mediaDevices:{getUserMedia:()=>++calls===1?older.promise:newer.promise}});
  const first=session.start('camera','first'),second=session.start('camera','second');
  newer.resolve(newCamera);await second;older.resolve(oldCamera);await first;
  assert.equal(session.streams.camera,newCamera);assert.equal(oldCamera.track.readyState,'ended');assert.equal(newCamera.track.readyState,'live');
});
test('microphone denial does not interrupt an active camera',async()=>{
  const camera=stream('video');
  const session=new MediaSession({mediaDevices:{getUserMedia:async options=>{if(options.audio)throw Object.assign(new Error('denied'),{name:'NotAllowedError'});return camera;}}});
  await session.start('camera');await assert.rejects(session.start('microphone'),{name:'NotAllowedError'});
  assert.equal(session.active('camera'),true);assert.equal(session.active('microphone'),false);assert.equal(session.pending.microphone,false);
});
test('screen capture requests no system audio and browser Stop sharing releases source',async()=>{
  let options;const screen=stream('video');
  const session=new MediaSession({mediaDevices:{getDisplayMedia:async value=>{options=value;return screen;}}});
  await session.start('screen');assert.equal(options.audio,false);assert.equal(session.active('screen'),true);
  screen.track.end();assert.equal(session.streams.screen,null);assert.equal(session.active('screen'),false);
});
test('switching devices releases old hardware and Stop all releases every source',async()=>{
  const camera1=stream('video'),camera2=stream('video'),mic=stream('audio'),screen=stream('video');let cameras=0;
  const session=new MediaSession({mediaDevices:{getUserMedia:async options=>{if(options.audio)return mic;if(cameras++)assert.equal(camera1.track.readyState,'ended');return cameras===1?camera1:camera2;},getDisplayMedia:async()=>screen}});
  await session.start('camera');await session.start('camera','new-camera');await session.start('microphone');await session.start('screen');session.stopAll();
  for(const value of [camera1,camera2,mic,screen])assert.equal(value.track.readyState,'ended');
  for(const kind of ['camera','microphone','screen'])assert.equal(session.active(kind),false);
});
test('unsupported screen capture and malformed streams fail cleanly',async()=>{
  const wrong=stream('audio');const session=new MediaSession({mediaDevices:{getUserMedia:async()=>wrong}});
  await assert.rejects(session.start('screen'),{name:'UnsupportedError'});
  await assert.rejects(session.start('camera'),{name:'NotFoundError'});
  assert.equal(wrong.track.readyState,'ended');assert.equal(session.pending.camera,false);
  assert.match(mediaErrorMessage({name:'NotAllowedError'},'camera'),/не надано/);
});
