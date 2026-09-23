import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyTelegramInitData} from '../server/telegram-auth.mjs';
import {createTelegramSessions} from '../server/telegram-session.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519'),botId='8913943236',ownerId='511274530';
const now=Date.now();
function fixture({id=Number(ownerId),bot=botId,date=Math.floor(now/1000)}={}){const fields={auth_date:String(date),query_id:'test',user:JSON.stringify({id,first_name:'Owner'})};const data=Object.entries(fields).sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${k}=${v}`).join('\n');return new URLSearchParams({...fields,signature:sign(null,Buffer.from(`${bot}:WebAppData\n${data}`),privateKey).toString('base64url')}).toString();}
const verifyInit=raw=>verifyTelegramInitData(raw,{botId,ownerId,now,publicKey});
test('Telegram allows only a signed, fresh owner for the configured bot',()=>{
  assert.equal(verifyInit(fixture()).id,ownerId);
  for(const raw of [fixture({id:4}),fixture({bot:'9'}),fixture({date:Math.floor(now/1000)-3601}),fixture({date:Math.floor(now/1000)+61}),fixture().replace('Owner','Changed'),fixture()+'&user=%7B%22id%22%3A511274530%7D','user={"id":511274530}'])assert.throws(()=>verifyInit(raw));
});
test('Telegram viewer verification accepts another signed human user',()=>{
  const user=verifyTelegramInitData(fixture({id:42}),{botId,now,publicKey});assert.equal(user.id,'42');assert.equal(user.name,'Owner');
});
test('Viewer session expires, cannot be forged, and uses a separate audience',async()=>{
  let clock=now;const sessions=createTelegramSessions({secret:'s'.repeat(40),ownerId,now:()=>clock,verifyTelegram:verifyInit});
  const cookie=await sessions.create(fixture());assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);
  const request=new Request('https://room.example/',{headers:{cookie:cookie.split(';')[0]}});
  assert.equal((await sessions.read(request)).id,ownerId);
  assert.equal(await sessions.read(new Request('https://room.example/',{headers:{cookie:cookie.replace('eyJ','bad')}})),null);
  clock+=28801000;assert.equal(await sessions.read(request),null);
});
