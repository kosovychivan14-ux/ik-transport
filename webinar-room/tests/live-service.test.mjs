import test from 'node:test';
import assert from 'node:assert/strict';
import {TokenVerifier} from 'livekit-server-sdk';
import {createLiveService} from '../server/live-service.mjs';
const env={LIVEKIT_URL:'wss://project.livekit.cloud',LIVEKIT_API_KEY:'test-key',LIVEKIT_API_SECRET:'k'.repeat(40),PRESENTER_SESSION_SECRET:'s'.repeat(40),APP_ORIGINS:'https://room.example'};
const request=(action,body,origin='https://room.example')=>new Request(`https://room.example/api/live/${action}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
const verifyTelegram=raw=>{if(raw!=='verified-owner')throw new Error('Denied');return {id:'511274530',name:'Owner'};};
test('Missing service and unauthorized requests fail closed',async()=>{
  const missing=createLiveService({env:{APP_ORIGINS:'https://room.example'}});assert.equal((await missing(request('token',{initData:'anything'}))).status,503);
  const service=createLiveService({env,verifyTelegram});
  assert.equal((await service(request('token',{initData:'forged',role:'presenter'}))).status,403);
  assert.equal((await service(request('token',{initData:'verified-owner'},'https://evil.example'))).status,403);
});
test('Viewer grant is subscribe-only in the fixed private room, presenter grant is publish-only',async()=>{
  const service=createLiveService({env,verifyTelegram});
  const verifier=new TokenVerifier(env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET);
  for(const role of ['viewer','presenter']){
    const response=await service(request('token',{initData:'verified-owner',role,room:'public-room',canPublish:true}));assert.equal(response.status,200);
    const access=await response.json(),claims=await verifier.verify(access.token);
    assert.equal(claims.video.room,'ik-private-test');assert.equal(claims.video.canPublish,role==='presenter');assert.equal(claims.video.canSubscribe,role==='viewer');assert.equal(claims.video.canPublishData,false);assert.equal(claims.video.roomAdmin,false);
  }
});
test('Presenter tickets are short-lived, role scoped, and never issued to an unverified caller',async()=>{
  let clock=Date.now();const service=createLiveService({env,verifyTelegram,now:()=>clock});
  assert.equal((await service(request('presenter-access',{initData:'bad'}))).status,403);
  const {presenterTicket}=await (await service(request('presenter-access',{initData:'verified-owner'}))).json();
  assert.equal((await service(request('token',{role:'presenter',presenterTicket}))).status,200);
  assert.equal((await service(request('token',{role:'viewer',presenterTicket}))).status,403);
  clock+=301000;assert.equal((await service(request('token',{role:'presenter',presenterTicket}))).status,403);
});
