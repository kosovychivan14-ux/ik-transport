import test from 'node:test';
import assert from 'node:assert/strict';
import {setupStudioPreviewFullscreen} from '../dist/studio-preview-fullscreen.js';

class Emitter{constructor(){this.events=new Map();}addEventListener(type,fn){this.events.set(type,fn);}removeEventListener(type){this.events.delete(type);}emit(type,event={}){this.events.get(type)?.(event);}}
function element(){const value=new Emitter();value.classes=new Set();value.classList={toggle:(name,on)=>on?value.classes.add(name):value.classes.delete(name)};value.attrs={};value.setAttribute=(name,next)=>value.attrs[name]=String(next);value.click=()=>value.emit('click');return value;}

test('studio preview opens, supports arrow navigation, and closes from its visible control',async()=>{
  const shell=element(),button=element(),previous=element(),next=element(),doc=new Emitter();previous.disabled=false;next.disabled=false;let left=0,right=0;previous.click=()=>left++;next.click=()=>right++;doc.fullscreenElement=null;
  shell.requestFullscreen=async()=>{doc.fullscreenElement=shell;doc.emit('fullscreenchange');};doc.exitFullscreen=async()=>{doc.fullscreenElement=null;doc.emit('fullscreenchange');};
  const cleanup=setupStudioPreviewFullscreen({shell,button,previous,next,doc});button.click();await Promise.resolve();assert.equal(shell.classes.has('is-fullscreen'),true);assert.equal(button.textContent,'Згорнути ⤡');
  doc.emit('keydown',{key:'ArrowLeft',target:{tagName:'BODY'},preventDefault(){}});doc.emit('keydown',{key:'ArrowRight',target:{tagName:'BODY'},preventDefault(){}});assert.equal(left,1);assert.equal(right,1);
  button.click();await Promise.resolve();assert.equal(shell.classes.has('is-fullscreen'),false);cleanup();
});

test('studio preview keeps a CSS fullscreen fallback when browser fullscreen is denied',async()=>{
  const shell=element(),button=element(),doc=new Emitter();doc.fullscreenElement=null;shell.requestFullscreen=()=>Promise.reject(new Error('denied'));
  const cleanup=setupStudioPreviewFullscreen({shell,button,doc});button.click();await Promise.resolve();await Promise.resolve();assert.equal(shell.classes.has('is-fullscreen'),true);doc.emit('keydown',{key:'Escape',target:{tagName:'BODY'},preventDefault(){}});assert.equal(shell.classes.has('is-fullscreen'),false);cleanup();
});
