const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function normalizePosition(value={}){
  return {x:Number.isFinite(value.x)?clamp(value.x,0,1):1,y:Number.isFinite(value.y)?clamp(value.y,0,1):1,size:Number.isFinite(value.size)?clamp(value.size,18,50):28};
}
export function cameraRect(width,height,value){
  const state=normalizePosition(value),margin=Math.min(8,width/20,height/20);
  const w=Math.max(0,Math.min(width*state.size/100,width-margin*2,(height-margin*2)*4/3)),h=w*3/4;
  const dx=Math.max(0,width-margin*2-w),dy=Math.max(0,height-margin*2-h);
  return {left:margin+dx*state.x,top:margin+dy*state.y,width:w,height:h,dx,dy};
}
export function setupCameraPosition({stage,layer,activate}){
  const key='ik-camera-position-v1';let state=normalizePosition(),drag=null;
  try{state=normalizePosition(JSON.parse(localStorage.getItem(key)||'{}'));}catch{}
  const size=document.getElementById('camera-size');
  function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
  function refresh(){
    const rect=cameraRect(stage.clientWidth,stage.clientHeight,state);
    for(const [name,value] of Object.entries(rect).filter(([name])=>['left','top','width','height'].includes(name)))layer.style.setProperty(`--camera-${name}`,`${value}px`);
    size.value=state.size;document.getElementById('camera-size-value').value=`${state.size}%`;
    layer.tabIndex=stage.dataset.layout==='pip'?0:-1;
  }
  function move(dx,dy){activate();state.x=clamp(state.x+dx,0,1);state.y=clamp(state.y+dy,0,1);refresh();save();}
  layer.addEventListener('pointerdown',event=>{
    if(drag||stage.dataset.layout!=='pip'||(event.pointerType==='mouse'&&event.button!==0))return;
    const rect=cameraRect(stage.clientWidth,stage.clientHeight,state);drag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:state.x,y:state.y,rect};
    layer.setPointerCapture(event.pointerId);layer.classList.add('is-dragging');layer.focus({preventScroll:true});event.preventDefault();
  });
  layer.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointerId)return;state.x=drag.rect.dx?clamp(drag.x+(event.clientX-drag.startX)/drag.rect.dx,0,1):0;state.y=drag.rect.dy?clamp(drag.y+(event.clientY-drag.startY)/drag.rect.dy,0,1):0;refresh();});
  function end(){if(!drag)return;drag=null;layer.classList.remove('is-dragging');save();}
  layer.addEventListener('pointerup',end);layer.addEventListener('pointercancel',end);layer.addEventListener('lostpointercapture',end);
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  layer.addEventListener('keydown',event=>{if(stage.dataset.layout!=='pip'||!directions[event.key])return;event.preventDefault();const [x,y]=directions[event.key],step=event.shiftKey ? 0.1 : 0.03;move(x*step,y*step);});
  document.querySelectorAll('[data-camera-move]').forEach(button=>button.addEventListener('click',()=>{const [x,y]=directions[button.dataset.cameraMove];move(x*.08,y*.08);}));
  document.querySelectorAll('[data-camera-corner]').forEach(button=>button.addEventListener('click',()=>{activate();const [x,y]=button.dataset.cameraCorner.split(',').map(Number);state.x=x;state.y=y;refresh();save();}));
  size.addEventListener('input',()=>{const next=Number(size.value);activate();state.size=next;refresh();save();});
  document.getElementById('reset-camera-position').addEventListener('click',()=>{activate();state=normalizePosition();refresh();save();});
  const observer=new ResizeObserver(refresh);observer.observe(stage);refresh();
  return {refresh};
}
