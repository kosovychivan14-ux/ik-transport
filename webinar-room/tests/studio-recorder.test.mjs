import test from 'node:test';
import assert from 'node:assert/strict';
import {setupStudioRecorder} from '../dist/studio-recorder.js';

class Element{constructor(){this.disabled=false;this.hidden=false;this.value=0;this.textContent='';this.dataset={};this.listeners={};}addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}click(){for(const fn of this.listeners.click||[])fn();}}
class FakeRecorder{
  static isTypeSupported(type){return type.startsWith('video/webm');}
  constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;this.listeners={};}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}emit(type,event={}){for(const fn of this.listeners[type]||[])fn(event);}
  start(){this.emit('dataavailable',{data:new Blob(['video'],{type:this.mimeType})});}
  stop(){this.emit('stop');}
}
class FakeProgram{constructor(){this.stream={};this.stopped=false;}async resume(){}stop(){this.stopped=true;}}

test('studio recorder captures the program stream and publishes after stop',async()=>{
  const ids=['start-recording','stop-recording','quick-start-recording','quick-stop-recording','recording-state','recording-time','recording-upload-progress','recording-result','recording-download','recording-visibility'],elements=new Map(ids.map(id=>[id,new Element()]));const uploads=[],messages=[],changes=[],backups=[];const backup={list:async()=>[],begin:async value=>backups.push(['begin',value]),append:async()=>{},flush:async()=>{},finalize:async()=>backups.push(['finalize']),remove:async()=>backups.push(['remove'])};
  const recorder=setupStudioRecorder({doc:{getElementById:id=>elements.get(id)},MediaRecorderClass:FakeRecorder,ProgramStreamClass:FakeProgram,getState:()=>({videoReady:true}),message:text=>messages.push(text),backup,uploadFile:async value=>{uploads.push(value);value.onProgress(100);return {pathname:value.pathname,url:'https://blob.example/video.webm',downloadUrl:'https://blob.example/video.webm?download=1'};},setVisibility:async value=>changes.push(value),now:(()=>{let value=1000;return()=>value+=1000;})(),setTimer:()=>1,clearTimer:()=>{}});
  await recorder.start();assert.equal(recorder.active,true);assert.equal(elements.get('stop-recording').disabled,false);await recorder.stop();assert.equal(uploads.length,1);assert.match(uploads[0].pathname,/^recordings\/\d+-\d+ms\.webm$/);assert.deepEqual(backups.map(item=>item[0]),['begin','finalize','remove']);assert.equal(elements.get('recording-state').textContent,'Запис опубліковано');assert.equal(elements.get('recording-result').hidden,false);assert.equal(elements.get('recording-download').href,'https://blob.example/video.webm?download=1');await elements.get('recording-visibility').click();await Promise.resolve();assert.equal(changes[0].visible,false);assert.match(messages.at(-2),/доступний клієнтам/);
});

test('studio recorder retries an interrupted cloud upload',async()=>{
  const elements=new Map(['start-recording','stop-recording','quick-start-recording','quick-stop-recording','recording-state','recording-time','recording-upload-progress'].map(id=>[id,new Element()]));let attempts=0;
  const recorder=setupStudioRecorder({doc:{getElementById:id=>elements.get(id)},MediaRecorderClass:FakeRecorder,ProgramStreamClass:FakeProgram,getState:()=>({videoReady:true}),uploadFile:async value=>{attempts++;if(attempts<3)throw new Error('network');return {pathname:value.pathname,url:'https://blob.example/video.webm'};},wait:async()=>{},now:(()=>{let value=1000;return()=>value+=1000;})(),setTimer:()=>1,clearTimer:()=>{}});
  await recorder.start();await recorder.stop();assert.equal(attempts,3);assert.equal(elements.get('recording-state').textContent,'Запис опубліковано');
});

test('studio recorder refuses to start without a visible program source',async()=>{
  const elements=new Map(['start-recording','stop-recording','quick-start-recording','quick-stop-recording','recording-state','recording-time','recording-upload-progress'].map(id=>[id,new Element()])),messages=[];
  const recorder=setupStudioRecorder({doc:{getElementById:id=>elements.get(id)},MediaRecorderClass:FakeRecorder,ProgramStreamClass:FakeProgram,getState:()=>({videoReady:false}),message:text=>messages.push(text)});await recorder.start();assert.equal(recorder.active,false);assert.match(messages[0],/Увімкніть камеру/);
});
