import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePosition,cameraRect} from '../dist/camera-position.js';
test('camera remains inside desktop and narrow stages at every size and edge',()=>{
  for(const [w,h] of [[900,506],[343,257],[180,90]])for(const x of [0,.5,1])for(const y of [0,.5,1])for(const size of [18,28,50]){
    const r=cameraRect(w,h,{x,y,size});assert.ok(r.left>=0&&r.top>=0);assert.ok(r.left+r.width<=w+.001);assert.ok(r.top+r.height<=h+.001);assert.ok(Math.abs(r.width/r.height-4/3)<.001);
  }
});
test('invalid persisted coordinates and sizes cannot move the camera outside the stage',()=>{
  assert.deepEqual(normalizePosition({x:-9,y:Infinity,size:800}),{x:0,y:1,size:50});
  assert.deepEqual(normalizePosition({x:'3',y:NaN,size:-4}),{x:1,y:1,size:18});
});
