importScripts('/vendor/mediapipe/vision_bundle.js');
let segmenter,personIndex=-1,maskCanvas,maskContext,foreground,foregroundContext,output,outputContext;
function canvasPair(width,height){const canvas=new OffscreenCanvas(width,height);return [canvas,canvas.getContext('2d')];}
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      const files=await Vision.FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
      segmenter=await Vision.ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:'/vendor/mediapipe/selfie_segmenter.tflite',delegate:'CPU'},runningMode:'VIDEO',outputCategoryMask:false,outputConfidenceMasks:true,canvas:new OffscreenCanvas(1,1)});
      personIndex=segmenter.getLabels().findIndex(label=>/^(person|selfie|foreground)$/i.test(label));
      [maskCanvas,maskContext]=canvasPair(256,256);[foreground,foregroundContext]=canvasPair(1,1);[output,outputContext]=canvasPair(1,1);
      if(!('filter' in outputContext))throw new Error('Canvas blur unavailable');
      self.postMessage({type:'ready'});
    }catch(error){self.postMessage({type:'error',detail:String(error.message)});}
    return;
  }
  if(data.type!=='frame')return;
  const {frame,timestamp,amount}=data;
  try{
    segmenter.segmentForVideo(frame,timestamp,result=>{
      const masks=result.confidenceMasks,index=personIndex>=0?personIndex:masks?.length===1?0:-1;
      if(index<0||!masks[index])throw new Error('Person mask unavailable');
      const mask=masks[index],values=mask.getAsFloat32Array();
      if(maskCanvas.width!==mask.width||maskCanvas.height!==mask.height){maskCanvas.width=mask.width;maskCanvas.height=mask.height;}
      const pixels=maskContext.createImageData(mask.width,mask.height);
      for(let i=0;i<values.length;i++){const t=Math.max(0,Math.min(1,(values[i]-.2)/.6));pixels.data[i*4+3]=Math.round(t*t*(3-2*t)*255);}
      maskContext.putImageData(pixels,0,0);
      const {width,height}=frame;
      if(output.width!==width||output.height!==height){output.width=foreground.width=width;output.height=foreground.height=height;}
      foregroundContext.clearRect(0,0,width,height);foregroundContext.globalCompositeOperation='source-over';foregroundContext.filter='none';foregroundContext.drawImage(frame,0,0,width,height);
      foregroundContext.globalCompositeOperation='destination-in';foregroundContext.filter='blur(1px)';foregroundContext.drawImage(maskCanvas,0,0,width,height);
      foregroundContext.globalCompositeOperation='source-over';foregroundContext.filter='none';
      const radius=Math.max(4,Math.min(24,amount)),bleed=radius*2;
      outputContext.clearRect(0,0,width,height);outputContext.filter=`blur(${radius}px)`;
      outputContext.drawImage(frame,-bleed,-bleed,width+bleed*2,height+bleed*2);outputContext.filter='none';outputContext.drawImage(foreground,0,0);
      const bitmap=output.transferToImageBitmap();self.postMessage({type:'frame',bitmap},[bitmap]);
    });
  }catch(error){self.postMessage({type:'error',detail:String(error.message)});}
  finally{frame.close();}
};
