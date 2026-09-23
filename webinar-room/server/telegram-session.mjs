import {SignJWT,jwtVerify} from 'jose';
import {verifyTelegramInitData} from './telegram-auth.mjs';
export const SESSION_COOKIE='__Host-ik-viewer';
export function createTelegramSessions({secret,botId='8913943236',verifyTelegram=verifyTelegramInitData,now=()=>Date.now()}={}){
  const key=()=>{if(typeof secret!=='string'||secret.length<32)throw new Error('SESSION_NOT_CONFIGURED');return new TextEncoder().encode(secret);};
  return {
    async create(initData){const user=verifyTelegram(initData,{botId,now:now()});const issued=Math.floor(now()/1000);const token=await new SignJWT({name:user.name,username:user.username||'',languageCode:user.languageCode||''}).setProtectedHeader({alg:'HS256'}).setIssuer('ik-webinar-session').setAudience('ik-private-viewer').setSubject(user.id).setIssuedAt(issued).setExpirationTime(issued+28800).sign(key());return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`;},
    async read(request){try{const cookie=request.headers.get('cookie')||'';const entry=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${SESSION_COOKIE}=`));if(!entry)return null;const token=entry.slice(SESSION_COOKIE.length+1);const {payload}=await jwtVerify(token,key(),{algorithms:['HS256'],issuer:'ik-webinar-session',audience:'ik-private-viewer',currentDate:new Date(now())});return {id:payload.sub,name:payload.name,username:payload.username||'',languageCode:payload.languageCode||''};}catch{return null;}}
  };
}
