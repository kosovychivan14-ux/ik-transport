import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomClock,formatRoomTime} from '../dist/room-clock.js';
import {createLiveService} from '../server/live-service.mjs';
test('Kyiv clock updates date at local midnight and observes daylight saving time',()=>{
  const before=formatRoomTime(Date.parse('2026-09-21T20:59:59Z'));
  const after=formatRoomTime(Date.parse('2026-09-21T21:00:00Z'));
  assert.equal(before.time,'23:59:59');assert.equal(after.time,'00:00:00');assert.notEqual(before.date,after.date);
  assert.equal(formatRoomTime(Date.parse('2026-01-15T00:00:00Z')).time,'02:00:00');
});
test('server time corrects a wrong device clock and ignores later device clock jumps',()=>{
  let wall=0,tick=200;const clock=createRoomClock({wallNow:()=>wall,monotonicNow:()=>tick});
  assert.equal(clock.now(),0);assert.equal(clock.synchronize(100000,0),true);assert.equal(clock.now(),100100);
  wall=999999999;tick+=1000;assert.equal(clock.now(),101100);assert.equal(clock.synchronize(NaN,1000),false);
});
test('status supplies uncached server time even before video service setup',async()=>{
  const service=createLiveService({env:{},now:()=>1234567890000});
  const response=await service(new Request('https://room.example/api/live/status'));
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).serverTime,1234567890000);
});
