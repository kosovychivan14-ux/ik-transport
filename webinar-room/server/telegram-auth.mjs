import {createPublicKey, verify} from 'node:crypto';

const productionKey='e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';
const spkiPrefix='302a300506032b6570032100';
export function telegramPublicKey(hex=productionKey){
  return createPublicKey({key:Buffer.from(spkiPrefix+hex,'hex'),format:'der',type:'spki'});
}

// Only the caller in server code can replace the verification key (used by tests).
export function verifyTelegramInitData(raw,{botId,ownerId,now=Date.now(),publicKey=telegramPublicKey(),maxAgeSeconds=3600}={}){
  const denied=()=>{throw new Error('TELEGRAM_ACCESS_DENIED');};
  if(typeof raw!=='string'||raw.length>16384||!/^\d+$/.test(String(botId))||(ownerId!=null&&!/^\d+$/.test(String(ownerId))))return denied();
  const params=new URLSearchParams(raw),seen=new Set();
  for(const [key] of params){if(seen.has(key))return denied();seen.add(key);}
  const signature=params.get('signature')||'',date=params.get('auth_date')||'';
  if(!/^[\w-]{86}(==)?$/.test(signature)||!/^\d{10,}$/.test(date))return denied();
  const age=now/1000-Number(date);
  if(!Number.isFinite(age)||age < -60||age>maxAgeSeconds)return denied();
  const data=[...params].filter(([key])=>key!=='hash'&&key!=='signature').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>`${key}=${value}`).join('\n');
  const signed=Buffer.from(`${botId}:WebAppData\n${data}`);
  if(!verify(null,signed,publicKey,Buffer.from(signature,'base64url')))return denied();
  let user;try{user=JSON.parse(params.get('user'));}catch{return denied();}
  if(!Number.isSafeInteger(user?.id)||user.id<=0||(ownerId!=null&&String(user.id)!==String(ownerId))||user.is_bot)return denied();
  return {id:String(user.id),name:[user.first_name,user.last_name].filter(x=>typeof x==='string').join(' ').slice(0,80),username:typeof user.username==='string'?user.username.slice(0,64):'',languageCode:typeof user.language_code==='string'?user.language_code.slice(0,16):''};
}
