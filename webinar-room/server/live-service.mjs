import {randomUUID} from 'node:crypto';
import {AccessToken,TrackSource} from 'livekit-server-sdk';
import {SignJWT,jwtVerify} from 'jose';
import {verifyTelegramInitData} from './telegram-auth.mjs';

const encoder=new TextEncoder();
const defaults={TELEGRAM_BOT_ID:'8913943236',OWNER_TELEGRAM_ID:'511274530',LIVEKIT_ROOM:'ik-private-test'};
export function createLiveService({env=process.env,verifyTelegram=verifyTelegramInitData,authenticate,now=()=>Date.now()}={}){
  const config={...defaults,...env};
  const origins=(config.APP_ORIGINS||'https://ik-webinar-room.kosovychivan14.chatgpt.site').split(',').map(x=>x.trim()).filter(Boolean);
  const configured=()=>{
    try{return new URL(config.LIVEKIT_URL).protocol==='wss:'&&!!config.LIVEKIT_API_KEY&&config.LIVEKIT_API_SECRET?.length>=32&&config.PRESENTER_SESSION_SECRET?.length>=32;}catch{return false;}
  };
  const secret=()=>encoder.encode(config.PRESENTER_SESSION_SECRET);
  return async function handle(request){
    const path=new URL(request.url).pathname,origin=request.headers.get('origin');
    const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','vary':'Origin','x-content-type-options':'nosniff'};
    if(origin&&origins.includes(origin))headers['access-control-allow-origin']=origin;
    const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(origin&&!origins.includes(origin))return response({error:'ORIGIN_DENIED'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Content-Type','access-control-max-age':'600'}});
    if(path==='/api/live/status'&&request.method==='GET')return response({configured:configured(),presenterAuthorized:!!(authenticate&&await authenticate(request,{role:'presenter'})),privateTest:true,recording:false,serverTime:now()});
    if(!['/api/live/token','/api/live/presenter-access'].includes(path))return response({error:'NOT_FOUND'},404);
    if(request.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return response({error:'JSON_REQUIRED'},415);
    if(!configured())return response({error:'LIVE_SERVICE_NOT_CONFIGURED'},503);
    if(Number(request.headers.get('content-length'))>24000)return response({error:'REQUEST_TOO_LARGE'},413);
    let body;try{const raw=await request.text();if(raw.length>24000)return response({error:'REQUEST_TOO_LARGE'},413);body=JSON.parse(raw);}catch{return response({error:'INVALID_JSON'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'INVALID_JSON'},400);
    try{
      const role=body.role||'viewer';
      if(!['viewer','presenter'].includes(role))return response({error:'INVALID_ROLE'},400);
      let user;
      if(path==='/api/live/token'&&role==='presenter'&&body.presenterTicket){
        const {payload}=await jwtVerify(body.presenterTicket,secret(),{algorithms:['HS256'],issuer:'ik-webinar-access',audience:'ik-presenter',currentDate:new Date(now())});
        if(payload.sub!==String(config.OWNER_TELEGRAM_ID)||payload.scope!=='presenter')throw new Error('Denied');
        user={id:payload.sub,name:'Іван Косович'};
      }else user=(authenticate&&await authenticate(request,{role}))||verifyTelegram(body.initData,{botId:config.TELEGRAM_BOT_ID,ownerId:config.OWNER_TELEGRAM_ID,now:now()});
      if(path==='/api/live/presenter-access'){
        if(user.id!==String(config.OWNER_TELEGRAM_ID))throw new Error('Denied');
        const expiresAt=Math.floor(now()/1000)+300;
        const presenterTicket=await new SignJWT({scope:'presenter'}).setProtectedHeader({alg:'HS256'}).setIssuer('ik-webinar-access').setAudience('ik-presenter').setSubject(user.id).setIssuedAt(Math.floor(now()/1000)).setExpirationTime(expiresAt).sign(secret());
        return response({presenterTicket,expiresAt});
      }
      const identity=role==='presenter'?'ik-presenter':`viewer-${user.id}-${randomUUID()}`;
      const token=new AccessToken(config.LIVEKIT_API_KEY,config.LIVEKIT_API_SECRET,{identity,name:user.name||'Іван',ttl:300});
      token.addGrant({roomJoin:true,room:config.LIVEKIT_ROOM,canPublish:role==='presenter',canSubscribe:role==='viewer',canPublishData:false,canUpdateOwnMetadata:false,roomAdmin:false,roomRecord:false,...(role==='presenter'?{canPublishSources:[TrackSource.CAMERA,TrackSource.MICROPHONE]}: {})});
      return response({url:config.LIVEKIT_URL,token:await token.toJwt(),identity,presenterIdentity:'ik-presenter',room:config.LIVEKIT_ROOM,role});
    }catch{return response({error:'ACCESS_DENIED'},403);}
  };
}
