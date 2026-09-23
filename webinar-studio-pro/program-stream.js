import {cameraRect} from './camera-position.js';

const DEFAULT_WIDTH=1920;
const DEFAULT_HEIGHT=1080;
const DEFAULT_FPS=24;

function finite(value,fallback=0){return Number.isFinite(value)?value:fallback;}

/** Return source and destination rectangles for a canvas drawImage call. */
export function fitRect(sourceWidth,sourceHeight,destination,mode='contain'){
  const sw=finite(sourceWidth),sh=finite(sourceHeight);
  const dx=finite(destination?.left),dy=finite(destination?.top);
  const boxWidth=Math.max(0,finite(destination?.width));
  const boxHeight=Math.max(0,finite(destination?.height));
  if(sw<=0||sh<=0||boxWidth<=0||boxHeight<=0)return null;
  if(mode==='cover'){
    const scale=Math.max(boxWidth/sw,boxHeight/sh);
    const cropWidth=boxWidth/scale,cropHeight=boxHeight/scale;
    return {sx:(sw-cropWidth)/2,sy:(sh-cropHeight)/2,sw:cropWidth,sh:cropHeight,dx,dy,dw:boxWidth,dh:boxHeight};
  }
  const scale=Math.min(boxWidth/sw,boxHeight/sh);
  const dw=Math.min(boxWidth,sw*scale),dh=Math.min(boxHeight,sh*scale);
  return {sx:0,sy:0,sw,sh,dx:dx+(boxWidth-dw)/2,dy:dy+(boxHeight-dh)/2,dw,dh};
}

/** Scale an element rectangle from the preview stage into the program canvas. */
export function scaleDomRect(stageRect,elementRect,width=DEFAULT_WIDTH,height=DEFAULT_HEIGHT){
  if(!stageRect||!elementRect||stageRect.width<=0||stageRect.height<=0)return null;
  return {
    left:(elementRect.left-stageRect.left)*width/stageRect.width,
    top:(elementRect.top-stageRect.top)*height/stageRect.height,
    width:elementRect.width*width/stageRect.width,
    height:elementRect.height*height/stageRect.height,
  };
}

function dimensions(source){
  if(!source)return null;
  const width=source.videoWidth||source.naturalWidth||source.width;
  const height=source.videoHeight||source.naturalHeight||source.height;
  if(!width||!height)return null;
  if(typeof source.readyState==='number'&&source.readyState<2)return null;
  if('complete' in source&&source.complete===false)return null;
  return {width,height};
}

function hasLiveTrack(stream,kind){
  if(!stream)return false;
  const getter=kind==='audio'?'getAudioTracks':'getVideoTracks';
  const tracks=typeof stream[getter]==='function'?stream[getter]():typeof stream.getTracks==='function'?stream.getTracks().filter(track=>track.kind===kind):[];
  return tracks.some(track=>track.readyState!=='ended'&&track.enabled!==false);
}

function sourceIsActive(source,stream,kind){
  if(stream)return hasLiveTrack(stream,kind);
  // A real video with an empty srcObject must not leak its last decoded frame.
  if(source&&'srcObject' in source)return hasLiveTrack(source.srcObject,kind);
  return !!source;
}

function defaultAudioContext(){
  const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Context)throw new Error('Web Audio API is unavailable.');
  return new Context();
}

function defaultMediaStream(tracks){return new MediaStream(tracks);}

function byId(document,id){return document?.getElementById?.(id)||null;}

export class ProgramStream {
  constructor({
    document=globalThis.document,
    width=DEFAULT_WIDTH,
    height=DEFAULT_HEIGHT,
    fps=DEFAULT_FPS,
    getState=()=>({}),
    createAudioContext=defaultAudioContext,
    createMediaStream=defaultMediaStream,
    setIntervalFn=globalThis.setInterval?.bind(globalThis),
    clearIntervalFn=globalThis.clearInterval?.bind(globalThis),
  }={}){
    if(!document?.createElement)throw new TypeError('ProgramStream requires a document.');
    this.document=document;this.width=width;this.height=height;this.fps=fps;this.getState=getState;
    this.clearIntervalFn=clearIntervalFn;this.stopped=false;this.timer=undefined;this.outputTracks=[];
    this.canvasStream=null;this.audioContext=null;this.audioDestination=null;this.stream=null;
    this.microphoneStream=null;this.microphoneTrack=null;this.microphoneNode=null;
    this.canvas=document.createElement('canvas');this.canvas.width=width;this.canvas.height=height;
    this.context=this.canvas.getContext('2d',{alpha:false});
    if(!this.context||typeof this.canvas.captureStream!=='function')throw new Error('Canvas stream capture is unavailable.');
    this.resume=this.resume.bind(this);
    try{
      this.canvasStream=this.canvas.captureStream(fps);
      const videoTracks=this.canvasStream.getVideoTracks?.()||this.canvasStream.getTracks?.().filter(track=>track.kind==='video')||[];
      this.outputTracks.push(...videoTracks);
      this.audioContext=createAudioContext();this.audioDestination=this.audioContext.createMediaStreamDestination();
      const audioTracks=this.audioDestination.stream.getAudioTracks?.()||[];this.outputTracks.push(...audioTracks);
      this.stream=createMediaStream([...videoTracks,...audioTracks]);
      this.document.addEventListener?.('pointerdown',this.resume,{capture:true});
      this.document.addEventListener?.('keydown',this.resume,{capture:true});
      this.draw();
      // setInterval keeps capture moving when no video frame callback fires. Browsers may
      // still throttle timers in a fully hidden or suspended tab, so the studio should stay visible.
      this.timer=setIntervalFn?.(()=>this.draw(),Math.max(1,Math.round(1000/fps)));
    }catch(error){this.stop();throw error;}
  }

  readState(){
    const stage=byId(this.document,'program-preview');
    const cameraLayer=byId(this.document,'camera-layer');
    const cameraSource=byId(this.document,'camera-preview');
    const blurSource=byId(this.document,'camera-blurred');
    const screenSource=byId(this.document,'screen-preview');
    const slideLayer=byId(this.document,'slide-layer');
    const slideSource=slideLayer?.querySelector?.('canvas, img, video')||slideLayer?.firstElementChild||null;
    const blurToggle=byId(this.document,'blur-toggle');
    const base={
      layout:stage?.dataset?.layout||'camera',
      contentSource:slideLayer&&!slideLayer.hidden&&slideSource?'slides':'screen',
      cameraSource,blurSource,screenSource,slideSource,stage,cameraLayer,
      cameraStream:cameraSource?.srcObject||null,
      screenStream:screenSource?.srcObject||null,
      microphoneStream:null,
      blurEnabled:!!blurToggle?.checked,
      blurState:blurSource&&!blurSource.hidden?'active':'off',
    };
    const supplied=this.getState?.()||{};
    return {...base,...supplied};
  }

  resolveCameraRect(state){
    if(state.cameraPosition)return cameraRect(this.width,this.height,state.cameraPosition);
    if(state.cameraRect)return state.cameraRect;
    const stageRect=state.stage?.getBoundingClientRect?.();
    const layerRect=state.cameraLayer?.getBoundingClientRect?.();
    return scaleDomRect(stageRect,layerRect,this.width,this.height)||cameraRect(this.width,this.height);
  }

  syncMicrophone(state){
    const stream=state.microphoneStream||state.microphone||null;
    const track=stream?.getAudioTracks?.().find(value=>value.readyState!=='ended'&&value.enabled!==false)||null;
    if(stream===this.microphoneStream&&track===this.microphoneTrack)return;
    try{this.microphoneNode?.disconnect();}catch{}
    this.microphoneNode=null;this.microphoneStream=null;this.microphoneTrack=null;
    if(!stream||!track||this.stopped)return;
    try{
      const node=this.audioContext.createMediaStreamSource(stream);node.connect(this.audioDestination);
      this.microphoneNode=node;this.microphoneStream=stream;this.microphoneTrack=track;
    }catch{/* A video-only or concurrently ending stream simply produces silence. */}
  }

  drawSource(source,destination,mode='contain'){
    const size=dimensions(source),rect=size&&fitRect(size.width,size.height,destination,mode);
    if(!rect)return false;
    try{this.context.drawImage(source,rect.sx,rect.sy,rect.sw,rect.sh,rect.dx,rect.dy,rect.dw,rect.dh);return true;}catch{return false;}
  }

  drawCamera(state,destination,mode){
    const blurEnabled=state.blur?.enabled??state.blurEnabled??false;
    const blurState=state.blur?.state??state.blurState??'off';
    if(!sourceIsActive(state.cameraSource,state.cameraStream,'video'))return false;
    // Privacy rule: while blur is requested, raw camera pixels never reach the program stream.
    const source=blurEnabled?(blurState==='active'?state.blurSource:null):state.cameraSource;
    if(!source)return false;
    return this.drawSource(source,destination,mode);
  }

  draw(){
    if(this.stopped)return;
    const state=this.readState();this.syncMicrophone(state);
    const ctx=this.context,full={left:0,top:0,width:this.width,height:this.height};
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='#080e0a';ctx.fillRect(0,0,this.width,this.height);ctx.restore();
    if(state.layout==='camera'){
      this.drawCamera(state,full,'contain');return;
    }
    const content=state.contentSource==='slides'?state.slideSource:state.screenSource;
    const contentStream=state.contentSource==='slides'?null:state.screenStream;
    if(state.contentSource==='slides'||sourceIsActive(content,contentStream,'video'))this.drawSource(content,full,'contain');
    if(state.layout!=='pip')return;
    const rect=this.resolveCameraRect(state);
    const radius=Math.max(0,Math.min(rect.width,rect.height,finite(state.cameraCornerRadius,10)));
    ctx.save();ctx.beginPath();
    if(typeof ctx.roundRect==='function')ctx.roundRect(rect.left,rect.top,rect.width,rect.height,radius);
    else ctx.rect(rect.left,rect.top,rect.width,rect.height);
    ctx.clip();
    this.drawCamera(state,rect,'cover');
    ctx.restore();
  }

  async resume(){
    if(this.stopped||this.audioContext?.state!=='suspended')return;
    try{await this.audioContext.resume();}catch{}
  }

  stop(){
    if(this.stopped)return;this.stopped=true;
    if(this.timer!==undefined)try{this.clearIntervalFn?.(this.timer);}catch{}
    try{this.document.removeEventListener?.('pointerdown',this.resume,{capture:true});}catch{}
    try{this.document.removeEventListener?.('keydown',this.resume,{capture:true});}catch{}
    try{this.microphoneNode?.disconnect();}catch{}
    this.microphoneNode=null;this.microphoneStream=null;this.microphoneTrack=null;
    // Only compositor-owned output tracks are stopped. Camera, screen and mic inputs remain untouched.
    for(const track of new Set(this.outputTracks))try{track.stop();}catch{}
    this.outputTracks.length=0;
    try{const closing=this.audioContext?.close?.();closing?.catch?.(()=>{});}catch{}
  }
}
