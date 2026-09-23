import test from 'node:test';
import assert from 'node:assert/strict';
import {ProgramStream,fitRect,scaleDomRect} from '../dist/program-stream.js';

class Track {
  constructor(kind){this.kind=kind;this.readyState='live';this.enabled=true;this.stopCount=0;}
  stop(){this.stopCount++;this.readyState='ended';}
}
function stream(track){return {getTracks:()=>[track],getVideoTracks:()=>track.kind==='video'?[track]:[],getAudioTracks:()=>track.kind==='audio'?[track]:[]};}

function fixture(getState){
  const outputVideo=new Track('video'),outputAudio=new Track('audio');
  const operations=[];const listeners=new Map();let timerCallback,cleared;
  const context={
    fillStyle:'',globalAlpha:1,globalCompositeOperation:'source-over',
    save(){operations.push(['save']);},restore(){operations.push(['restore']);},fillRect(...args){operations.push(['fillRect',...args]);},
    drawImage(source,...args){operations.push(['drawImage',source,...args]);},beginPath(){operations.push(['beginPath']);},
    roundRect(...args){operations.push(['roundRect',...args]);},rect(...args){operations.push(['rect',...args]);},clip(){operations.push(['clip']);},
  };
  const canvas={width:0,height:0,getContext:()=>context,captureStream:()=>stream(outputVideo)};
  const document={
    createElement:tag=>{assert.equal(tag,'canvas');return canvas;},getElementById:()=>null,
    addEventListener:(type,listener)=>listeners.set(type,listener),removeEventListener:type=>listeners.delete(type),
  };
  const nodes=[];
  const audioContext={state:'suspended',resumeCount:0,closeCount:0,
    createMediaStreamDestination:()=>({stream:stream(outputAudio)}),
    createMediaStreamSource:input=>{const node={input,connectCount:0,disconnectCount:0,connect(){this.connectCount++;},disconnect(){this.disconnectCount++;}};nodes.push(node);return node;},
    async resume(){this.resumeCount++;this.state='running';},async close(){this.closeCount++;this.state='closed';},
  };
  const program=new ProgramStream({document,getState,createAudioContext:()=>audioContext,createMediaStream:tracks=>({getTracks:()=>tracks}),setIntervalFn:callback=>{timerCallback=callback;return 7;},clearIntervalFn:id=>{cleared=id;}});
  return {program,operations,listeners,nodes,audioContext,outputVideo,outputAudio,tick:()=>timerCallback(),cleared:()=>cleared};
}

test('fitRect preserves aspect ratio for contain and crops the source for cover',()=>{
  assert.deepEqual(fitRect(1920,1080,{left:0,top:0,width:1000,height:1000},'contain'),{sx:0,sy:0,sw:1920,sh:1080,dx:0,dy:218.75,dw:1000,dh:562.5});
  assert.deepEqual(fitRect(1920,1080,{left:10,top:20,width:400,height:300},'cover'),{sx:240,sy:0,sw:1440,sh:1080,dx:10,dy:20,dw:400,dh:300});
  assert.equal(fitRect(0,1080,{left:0,top:0,width:10,height:10}),null);
});

test('DOM PiP coordinates scale into the fixed 1920 by 1080 program frame',()=>{
  assert.deepEqual(scaleDomRect({left:100,top:50,width:800,height:450},{left:620,top:290,width:240,height:180}),{left:1248,top:576,width:576,height:432});
});

test('blur privacy rule never falls back to raw camera while blur is loading or failed',()=>{
  const raw={videoWidth:640,videoHeight:480,readyState:4};const blurred={width:640,height:480};
  let state={layout:'camera',cameraSource:raw,cameraStream:stream(new Track('video')),blurSource:blurred,blurEnabled:true,blurState:'loading'};
  const value=fixture(()=>state);value.operations.length=0;value.program.draw();
  assert.equal(value.operations.some(op=>op[0]==='drawImage'),false);
  assert.deepEqual(value.operations.find(op=>op[0]==='fillRect'),['fillRect',0,0,1920,1080]);
  state={...state,blurState:'error'};value.program.draw();
  assert.equal(value.operations.some(op=>op[0]==='drawImage'),false);
  state={...state,blurState:'active'};value.program.draw();
  assert.equal(value.operations.filter(op=>op[0]==='drawImage').at(-1)[1],blurred);
  assert.equal(value.operations.some(op=>op[0]==='drawImage'&&op[1]===raw),false);
  value.program.stop();
});

test('PiP draws material with contain, clips camera with cover, and follows supplied geometry',()=>{
  const slide={width:1600,height:900};const camera={videoWidth:640,videoHeight:480,readyState:4};
  const value=fixture(()=>({layout:'pip',contentSource:'slides',slideSource:slide,cameraSource:camera,cameraStream:stream(new Track('video')),blurEnabled:false,cameraRect:{left:900,top:400,width:320,height:240}}));
  value.operations.length=0;value.program.draw();
  const draws=value.operations.filter(op=>op[0]==='drawImage');assert.equal(draws.length,2);assert.equal(draws[0][1],slide);assert.equal(draws[1][1],camera);
  assert.deepEqual(value.operations.find(op=>op[0]==='roundRect'),['roundRect',900,400,320,240,10]);
  assert.deepEqual(draws[1].slice(-4),[900,400,320,240]);
  value.program.stop();
});

test('microphone swaps and shutdown affect only compositor-owned tracks',async()=>{
  const micTrackA=new Track('audio'),micTrackB=new Track('audio');const micA=stream(micTrackA),micB=stream(micTrackB);
  let microphoneStream=micA;const value=fixture(()=>({layout:'camera',microphoneStream}));
  assert.equal(value.nodes.length,1);assert.equal(value.nodes[0].input,micA);assert.equal(value.nodes[0].connectCount,1);
  microphoneStream=micB;value.tick();assert.equal(value.nodes[0].disconnectCount,1);assert.equal(value.nodes[1].input,micB);
  microphoneStream=null;value.tick();assert.equal(value.nodes[1].disconnectCount,1);
  await value.listeners.get('pointerdown')();assert.equal(value.audioContext.resumeCount,1);
  value.program.stop();assert.equal(value.cleared(),7);assert.equal(value.audioContext.closeCount,1);
  assert.equal(value.outputVideo.stopCount,1);assert.equal(value.outputAudio.stopCount,1);
  assert.equal(micTrackA.stopCount,0);assert.equal(micTrackB.stopCount,0);assert.equal(value.listeners.size,0);
  value.program.stop();assert.equal(value.outputVideo.stopCount,1);
});

test('constructor failures release every owned resource before rethrowing',()=>{
  for(const failure of ['audio','draw','timer']){
    const outputVideo=new Track('video'),outputAudio=new Track('audio');const listeners=new Map();let closeCount=0,clearCount=0;
    const canvas={width:0,height:0,getContext:()=>({save(){},restore(){},fillRect(){}}),captureStream:()=>stream(outputVideo)};
    const document={
      createElement:()=>canvas,getElementById:()=>null,
      addEventListener:(type,listener)=>listeners.set(type,listener),removeEventListener:type=>listeners.delete(type),
    };
    const audioContext={
      state:'suspended',createMediaStreamDestination:()=>({stream:stream(outputAudio)}),
      close(){closeCount++;return Promise.resolve();},
    };
    assert.throws(()=>new ProgramStream({
      document,
      createAudioContext:()=>{if(failure==='audio')throw new Error('audio failed');return audioContext;},
      createMediaStream:tracks=>({getTracks:()=>tracks}),
      getState:()=>{if(failure==='draw')throw new Error('draw failed');return {layout:'camera'};},
      setIntervalFn:()=>{if(failure==='timer')throw new Error('timer failed');return 4;},
      clearIntervalFn:()=>{clearCount++;},
    }),new RegExp(`${failure} failed`));
    assert.equal(outputVideo.stopCount,1,`${failure}: canvas track`);
    assert.equal(outputAudio.stopCount,failure==='audio'?0:1,`${failure}: audio track`);
    assert.equal(closeCount,failure==='audio'?0:1,`${failure}: audio context`);
    assert.equal(clearCount,0,`${failure}: no timer was returned`);
    assert.equal(listeners.size,0,`${failure}: gesture listeners`);
  }
});
