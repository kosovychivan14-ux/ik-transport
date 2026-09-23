export class BackgroundBlur {
  constructor({video,canvas,onState=()=>{}}){this.video=video;this.canvas=canvas;this.onState=onState;this.enabled=false;this.amount=14;this.stream=null;this.worker=null;this.state='off';this.generation=0;this.frameId=0;this.timeout=0;this.busy=false;this.lastTime=-1;this.lastTick=0;}
  setState(state){this.state=state;this.onState(state);}
  setEnabled(value){if(this.enabled===value)return;this.enabled=value;this.restart();}
  setStream(stream){if(this.stream===stream)return;this.stream=stream;this.restart();}
  setAmount(value){this.amount=Math.max(4,Math.min(24,Number(value)||14));}
  stop(){this.generation++;cancelAnimationFrame(this.frameId);clearTimeout(this.timeout);this.worker?.terminate();this.worker=null;this.busy=false;this.lastTime=-1;this.canvas.getContext('2d')?.clearRect(0,0,this.canvas.width,this.canvas.height);}
  restart(){
    this.stop();
    if(!this.enabled){this.setState('off');return;}
    if(!this.stream){this.setState('waiting');return;}
    if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap!=='function'){this.setState('unsupported');return;}
    this.setState('loading');const generation=this.generation;
    try{
      const worker=new Worker(new URL('./blur-worker.js',import.meta.url));this.worker=worker;
      const fail=()=>{if(this.generation!==generation)return;this.stop();this.setState('error');};
      this.timeout=setTimeout(fail,25000);worker.onerror=fail;
      worker.onmessage=({data})=>{
        if(this.generation!==generation){data.bitmap?.close();return;}
        clearTimeout(this.timeout);
        if(data.type==='error'){fail();return;}
        if(data.type==='ready'){this.timeout=setTimeout(fail,10000);this.schedule(generation);return;}
        if(data.type==='frame'){
          const bitmap=data.bitmap;
          if(this.canvas.width!==bitmap.width||this.canvas.height!==bitmap.height){this.canvas.width=bitmap.width;this.canvas.height=bitmap.height;}
          this.canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();this.busy=false;
          if(this.state!=='active')this.setState('active');this.schedule(generation);
        }
      };
      worker.postMessage({type:'init'});
    }catch{this.stop();this.setState('error');}
  }
  schedule(generation){
    this.frameId=requestAnimationFrame(async timestamp=>{
      if(this.generation!==generation)return;
      const video=this.video;
      if(this.busy||video.readyState<2||!video.videoWidth||video.currentTime===this.lastTime||timestamp-this.lastTick<50){this.schedule(generation);return;}
      this.busy=true;this.lastTime=video.currentTime;this.lastTick=timestamp;
      try{
        const scale=Math.min(960/video.videoWidth,720/video.videoHeight,1);
        const frame=await createImageBitmap(video,{resizeWidth:Math.max(1,Math.round(video.videoWidth*scale)),resizeHeight:Math.max(1,Math.round(video.videoHeight*scale))});
        if(this.generation!==generation){frame.close();return;}
        clearTimeout(this.timeout);this.timeout=setTimeout(()=>{if(this.generation===generation){this.stop();this.setState('error');}},5000);
        this.worker.postMessage({type:'frame',frame,timestamp,amount:this.amount},[frame]);
      }catch{if(this.generation===generation){this.stop();this.setState('error');}}
    });
  }
}
