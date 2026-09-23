import express from 'express';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {extname,resolve,sep} from 'node:path';
import {createTelegramSessions} from './server/telegram-session.mjs';
import {createLiveService} from './server/live-service.mjs';
import {createPresenterSessions} from './server/presenter-session.mjs';
import {analyticsCsv,createAnalyticsStore,summarizeAnalytics} from './server/analytics-store.mjs';
import {createPremiereStore,normalizeFunnelEvent} from './server/premiere-store.mjs';
import {timingSafeEqual} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {del,list,put} from '@vercel/blob';
import {handleUpload} from '@vercel/blob/client';
const app=express();app.disable('x-powered-by');
const root=fileURLToPath(new URL('.',import.meta.url)),views=resolve(root,'views');
const sessions=createTelegramSessions({secret:process.env.PRESENTER_SESSION_SECRET});
const presenters=createPresenterSessions({secret:process.env.PRESENTER_SESSION_SECRET});
const studio=resolve(root,'studio');
const live=createLiveService({authenticate:(request,{role}={})=>role==='presenter'?presenters.read(request):sessions.read(request)});
const analytics=createAnalyticsStore();
const premieres=createPremiereStore();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.png':'image/png'};
const recordingIndexPath='recordings/index.json';
const recordingCatalogPath='recordings/catalog.json';
async function recordingVisibility(){
  const result=await list({prefix:recordingIndexPath,limit:1}),entry=result.blobs.find(blob=>blob.pathname===recordingIndexPath);if(!entry)return {};
  try{const url=new URL(entry.url);url.searchParams.set('v',String(new Date(entry.uploadedAt).getTime()));const response=await fetch(url,{cache:'no-store'});if(!response.ok)return {};const value=await response.json();return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
}
async function saveRecordingVisibility(value){await put(recordingIndexPath,JSON.stringify(value),{access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60});}
async function recordingCatalog(){
  const result=await list({prefix:recordingCatalogPath,limit:1}),entry=result.blobs.find(blob=>blob.pathname===recordingCatalogPath);if(!entry)return {folders:[],recordings:{}};
  try{const url=new URL(entry.url);url.searchParams.set('v',String(new Date(entry.uploadedAt).getTime()));const response=await fetch(url,{cache:'no-store'}),value=await response.json();return {folders:Array.isArray(value?.folders)?value.folders:[],recordings:value?.recordings&&typeof value.recordings==='object'?value.recordings:{},premiereId:typeof value?.premiereId==='string'?value.premiereId:''};}catch{return {folders:[],recordings:{},premiereId:''};}
}
async function saveRecordingCatalog(value){await put(recordingCatalogPath,JSON.stringify(value),{access:'public',contentType:'application/json',addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:60});}
function validRecordingId(id){return /^recordings\/\d{10,}-\d+ms\.(webm|mp4)$/.test(id);}
function sameSecret(actual,expected){const a=Buffer.from(String(actual||'')),b=Buffer.from(String(expected||''));return !!expected&&a.length===b.length&&timingSafeEqual(a,b);}
const premiereZones={ukraine:'Europe/Kyiv',dubai:'Asia/Dubai',europe:'Europe/Berlin',london:'Europe/London',newYork:'America/New_York',losAngeles:'America/Los_Angeles'};
function premiereTimes(value){const date=new Date(value);return Object.fromEntries(Object.entries(premiereZones).map(([key,timeZone])=>[key,new Intl.DateTimeFormat('uk-UA',{dateStyle:'medium',timeStyle:'short',timeZone}).format(date)]));}
app.use((req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Permissions-Policy':'camera=(), microphone=()'});next();});
app.use(express.text({type:'application/json',limit:'24kb'}));
function requestFor(req){return new Request(`https://${req.headers.host}${req.originalUrl}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:req.body||''});}
app.post('/api/studio/session',async(req,res)=>{
  if(req.get('origin')!==`https://${req.headers.host}`)return res.status(403).json({error:'ORIGIN_DENIED'});
  try{const body=JSON.parse(req.body||'{}');res.set('Set-Cookie',await presenters.create(body.presenterTicket)).json({ok:true});}catch{res.status(403).json({error:'ACCESS_DENIED'});}
});
app.get('/studio-gate.js',async(_req,res)=>res.type('js').send(await readFile(resolve(root,'studio-gate.js'))));
app.get(['/studio.webmanifest','/studio-service-worker.js','/ik-studio-icon.svg'],async(req,res)=>{const file=resolve(studio,'.'+req.path);try{res.type(mime[extname(file)]).send(await readFile(file));}catch{res.status(404).end();}});
app.get(['/studio','/studio.html'],async(req,res)=>{
  if(!await presenters.read(requestFor(req)))return res.type('html').send(await readFile(resolve(root,'studio-gate.html')));
  res.set('Permissions-Policy','camera=(self), microphone=(self), display-capture=(self)');
  res.type('html').send(await readFile(resolve(studio,'studio.html')));
});
app.post('/api/telegram/session',async(req,res)=>{
  const origin=req.get('origin');if(!origin||origin!==`https://${req.headers.host}`){res.status(403).json({error:'ORIGIN_DENIED'});return;}
  try{const body=JSON.parse(req.body||'{}');const cookie=await sessions.create(body.initData);res.set('Set-Cookie',cookie).json({ok:true});}catch{res.status(403).json({error:'ACCESS_DENIED'});}
});
app.all('/api/live/:action',async(req,res)=>{try{const response=await live(requestFor(req));res.status(response.status);response.headers.forEach((v,k)=>res.set(k,v));res.send(Buffer.from(await response.arrayBuffer()));}catch{res.status(503).json({error:'LIVE_SERVICE_NOT_CONFIGURED'});}});
const analyticsTypes=new Set(['room_open','heartbeat','room_close','section_view','recording_start','recording_progress','recording_pause','recording_end','slide_change','question','cta_click']);
app.post('/api/analytics/events',async(req,res)=>{
  if(req.get('origin')!==`https://${req.headers.host}`)return res.status(403).json({error:'ORIGIN_DENIED'});
  const request=requestFor(req),viewer=await sessions.read(request),presenter=await presenters.read(request);if(!viewer&&!presenter)return res.status(403).json({error:'ACCESS_DENIED'});if(!analytics.configured)return res.status(503).json({error:'ANALYTICS_NOT_CONFIGURED'});
  try{const body=JSON.parse(req.body||'{}'),eventType=String(body.eventType||''),sessionId=String(body.sessionId||'');if(!analyticsTypes.has(eventType)||!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(sessionId))throw new Error('INVALID_EVENT');if(eventType==='slide_change'&&!presenter)throw new Error('PRESENTER_REQUIRED');const actor=presenter||viewer,payload={};if(typeof body.section==='string')payload.section=body.section.slice(0,40);if(typeof body.label==='string')payload.label=body.label.slice(0,120);await analytics.insert({event_type:eventType,actor_role:presenter?'presenter':'viewer',telegram_id:String(actor.id),user_name:String(actor.name||'').slice(0,80),username:String(actor.username||'').slice(0,64),session_id:sessionId,webinar_id:'main',recording_id:typeof body.recordingId==='string'?body.recordingId.slice(0,160):null,slide_number:Number.isInteger(body.slideNumber)&&body.slideNumber>0?body.slideNumber:null,watch_seconds:Math.max(0,Math.min(86400,Math.floor(Number(body.watchSeconds)||0))),position_seconds:Number.isFinite(Number(body.positionSeconds))?Math.max(0,Math.floor(Number(body.positionSeconds))):null,payload});res.status(202).json({ok:true});}catch(error){console.error('[analytics/events] failed',{message:error?.message});res.status(400).json({error:'INVALID_ANALYTICS_EVENT'});}
});
app.get('/api/analytics/summary',async(req,res)=>{if(!await presenters.read(requestFor(req)))return res.status(403).json({error:'ACCESS_DENIED'});if(!analytics.configured)return res.json({configured:false,totalViewers:0,totalWatchSeconds:0,recordingViewers:0,totalQuestions:0,totalCtaClicks:0,viewers:[]});try{res.json(summarizeAnalytics(await analytics.list()));}catch(error){console.error('[analytics/summary] failed',{message:error?.message});res.status(503).json({error:'ANALYTICS_UNAVAILABLE'});}});
app.get('/api/analytics/export.csv',async(req,res)=>{if(!await presenters.read(requestFor(req)))return res.status(403).end();if(!analytics.configured)return res.status(503).end();try{const csv=analyticsCsv(summarizeAnalytics(await analytics.list()));res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="webinar-analytics.csv"'}).send(csv);}catch{res.status(503).end();}});
app.post('/api/sendpulse/funnel',async(req,res)=>{
  if(!sameSecret(req.get('x-sendpulse-secret'),process.env.SENDPULSE_WEBHOOK_SECRET))return res.status(403).json({error:'ACCESS_DENIED'});
  if(!premieres.configured)return res.status(503).json({error:'PREMIERE_STORE_NOT_CONFIGURED'});
  try{const event=normalizeFunnelEvent(JSON.parse(req.body||'{}')),result=await premieres.ingest(event);res.status(result.duplicate?200:202).json({ok:true,duplicate:result.duplicate,eligible:event.eligible,webinarAt:event.webinarAt,times:event.webinarAt?premiereTimes(event.webinarAt):null});}catch(error){console.error('[sendpulse/funnel] failed',{message:error?.message});res.status(400).json({error:'INVALID_FUNNEL_EVENT'});}
});
app.get('/api/premiere/access',async(req,res)=>{
  const viewer=await sessions.read(requestFor(req));if(!viewer)return res.status(403).json({error:'ACCESS_DENIED'});if(!premieres.configured)return res.json({mode:'live'});
  try{const catalog=await recordingCatalog();if(!catalog.premiereId)return res.json({mode:'live'});const contact=await premieres.getContact(String(viewer.id));if(!contact||!contact.eligible||contact.unsubscribed||!contact.webinar_at)return res.status(403).json({mode:'premiere',eligible:false,error:'FUNNEL_NOT_COMPLETED'});const result=await list({prefix:catalog.premiereId,limit:1}),blob=result.blobs.find(item=>item.pathname===catalog.premiereId);if(!blob)return res.status(503).json({error:'PREMIERE_RECORDING_MISSING'});await premieres.markOpened(String(viewer.id));res.json({mode:'premiere',eligible:true,startsAt:contact.webinar_at,serverTime:Date.now(),recording:{id:blob.pathname,url:blob.url,duration:Number(/-(\d+)ms\./.exec(blob.pathname)?.[1]||0)}});}catch(error){console.error('[premiere/access] failed',{message:error?.message});res.status(503).json({error:'PREMIERE_UNAVAILABLE'});}
});
app.get('/api/premiere/admin',async(req,res)=>{if(!await presenters.read(requestFor(req)))return res.status(403).json({error:'ACCESS_DENIED'});if(!premieres.configured)return res.json({configured:false,contacts:[]});try{const [contacts,catalog]=await Promise.all([premieres.listContacts(),recordingCatalog()]);res.json({configured:true,premiereId:catalog.premiereId||'',contacts,total:contacts.length,eligible:contacts.filter(item=>item.eligible&&!item.unsubscribed).length,opened:contacts.filter(item=>item.room_opened_at).length});}catch{res.status(503).json({error:'PREMIERE_UNAVAILABLE'});}});
app.post('/api/recordings/upload',async(req,res)=>{
  if(req.get('origin')!==`https://${req.headers.host}`||!await presenters.read(requestFor(req)))return res.status(403).json({error:'ACCESS_DENIED'});
  try{
    const result=await handleUpload({request:req,body:JSON.parse(req.body||'{}'),token:process.env.BLOB_READ_WRITE_TOKEN,onBeforeGenerateToken:async pathname=>{
      if(!/^recordings\/\d{10,}-\d+ms\.(webm|mp4)$/.test(pathname))throw new Error('INVALID_RECORDING_PATH');
      console.log('[recordings/upload] token issued',{pathname});return {allowedContentTypes:['video/webm','video/mp4'],maximumSizeInBytes:5*1024*1024*1024,addRandomSuffix:false,allowOverwrite:true,cacheControlMaxAge:3600};
    },onUploadCompleted:async({blob})=>{console.log('[recordings/upload] completed',{pathname:blob.pathname,size:blob.size,uploadedAt:blob.uploadedAt});}});res.json(result);
  }catch(error){console.error('[recordings/upload] failed',{message:error?.message,stack:error?.stack});res.status(400).json({error:error?.message||'UPLOAD_DENIED'});}
});
app.get('/api/recordings',async(req,res)=>{
  const request=requestFor(req),viewer=await sessions.read(request),presenter=await presenters.read(request);if(!viewer&&!presenter)return res.status(403).json({error:'ACCESS_DENIED'});
  try{const [result,visibility,catalog]=await Promise.all([list({prefix:'recordings/',limit:100}),recordingVisibility(),recordingCatalog()]);const recordings=result.blobs.map(blob=>{const match=/\/(\d+)-(\d+)ms\.(webm|mp4)$/.exec(blob.pathname);if(!match)return null;const visible=visibility[blob.pathname]!==false,premiere=blob.pathname===catalog.premiereId;return {id:blob.pathname,url:blob.url,downloadUrl:blob.downloadUrl||`${blob.url}?download=1`,size:blob.size,recordedAt:new Date(Number(match[1])).toISOString(),duration:Number(match[2]),contentType:match[3]==='mp4'?'video/mp4':'video/webm',visible,premiere,folderId:catalog.recordings[blob.pathname]?.folderId||''};}).filter(recording=>recording&&(presenter||recording.visible&&!recording.premiere)).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt));res.json({recordings,owner:!!presenter,folders:presenter?catalog.folders:[],premiereId:presenter?catalog.premiereId:''});}catch{res.status(503).json({error:'RECORDING_STORAGE_UNAVAILABLE'});}
});
app.post('/api/recordings/visibility',async(req,res)=>{
  if(req.get('origin')!==`https://${req.headers.host}`||!await presenters.read(requestFor(req)))return res.status(403).json({error:'ACCESS_DENIED'});
  try{const body=JSON.parse(req.body||'{}'),id=String(body.id||'');if(!/^recordings\/\d{10,}-\d+ms\.(webm|mp4)$/.test(id)||typeof body.visible!=='boolean')throw new Error('INVALID_RECORDING');const visibility=await recordingVisibility();visibility[id]=body.visible;await saveRecordingVisibility(visibility);res.json({ok:true,id,visible:body.visible});}catch{res.status(400).json({error:'VISIBILITY_UPDATE_FAILED'});}
});
app.post('/api/recordings/delete',async(req,res)=>{
  if(req.get('origin')!==`https://${req.headers.host}`||!await presenters.read(requestFor(req)))return res.status(403).json({error:'ACCESS_DENIED'});
  try{const body=JSON.parse(req.body||'{}'),id=String(body.id||'');if(!validRecordingId(id))throw new Error('INVALID_RECORDING');const result=await list({prefix:id,limit:1}),entry=result.blobs.find(blob=>blob.pathname===id);if(!entry)return res.status(404).json({error:'RECORDING_NOT_FOUND'});await del(entry.url);const [visibility,catalog]=await Promise.all([recordingVisibility(),recordingCatalog()]);delete visibility[id];delete catalog.recordings[id];if(catalog.premiereId===id)catalog.premiereId='';await Promise.all([saveRecordingVisibility(visibility),saveRecordingCatalog(catalog)]);res.json({ok:true,id});}catch{if(!res.headersSent)res.status(400).json({error:'RECORDING_DELETE_FAILED'});}
});
app.post('/api/recordings/manage',async(req,res)=>{
  if(req.get('origin')!==`https://${req.headers.host}`||!await presenters.read(requestFor(req)))return res.status(403).json({error:'ACCESS_DENIED'});
  try{const body=JSON.parse(req.body||'{}'),action=String(body.action||''),catalog=await recordingCatalog();
    if(action==='createFolder'){const name=String(body.name||'').trim().slice(0,60);if(!name)throw new Error('INVALID_FOLDER_NAME');const folder={id:`folder-${Date.now()}-${crypto.randomUUID().slice(0,8)}`,name,createdAt:new Date().toISOString()};catalog.folders.push(folder);await saveRecordingCatalog(catalog);return res.json({ok:true,folder});}
    const folderId=String(body.folderId||''),folder=catalog.folders.find(item=>item.id===folderId);
    if(action==='renameFolder'){const name=String(body.name||'').trim().slice(0,60);if(!folder||!name)throw new Error('INVALID_FOLDER');folder.name=name;await saveRecordingCatalog(catalog);return res.json({ok:true,folder});}
    if(action==='deleteFolder'){if(!folder)throw new Error('INVALID_FOLDER');catalog.folders=catalog.folders.filter(item=>item.id!==folderId);for(const item of Object.values(catalog.recordings))if(item.folderId===folderId)item.folderId='';await saveRecordingCatalog(catalog);return res.json({ok:true});}
    if(action==='moveRecording'){const id=String(body.id||''),destination=String(body.destination||'');if(!validRecordingId(id)||(destination&&!catalog.folders.some(item=>item.id===destination)))throw new Error('INVALID_MOVE');catalog.recordings[id]={...(catalog.recordings[id]||{}),folderId:destination};await saveRecordingCatalog(catalog);return res.json({ok:true,id,folderId:destination});}
    if(action==='setPremiere'){const id=String(body.id||'');if(id&&!validRecordingId(id))throw new Error('INVALID_PREMIERE');if(id){const result=await list({prefix:id,limit:1});if(!result.blobs.some(blob=>blob.pathname===id))throw new Error('RECORDING_NOT_FOUND');}catalog.premiereId=id;await saveRecordingCatalog(catalog);return res.json({ok:true,premiereId:id});}
    throw new Error('INVALID_ACTION');
  }catch(error){console.error('[recordings/manage] failed',{message:error?.message});res.status(400).json({error:'RECORDING_MANAGE_FAILED'});}
});
app.get('/gate.js',async(_req,res)=>res.type('js').send(await readFile(resolve(root,'gate.js'))));
app.get('/{*path}',async(req,res)=>{
  const presenter=await presenters.read(requestFor(req));
  if(presenter){
    const file=resolve(studio,'.'+req.path),type={...mime,'.wasm':'application/wasm','.tflite':'application/octet-stream','.pdf':'application/pdf'}[extname(file)];
    if(file.startsWith(studio+sep)&&type){try{
      const data=await readFile(file);res.type(type);
      if(extname(file)==='.pdf'){
        const match=/^bytes=(\d+)-(\d*)$/.exec(req.get('range')||'bytes=0-');
        if(!match||Number(match[1])>=data.length)return res.status(416).set('Content-Range',`bytes */${data.length}`).end();
        const start=Number(match[1]),end=Math.min(match[2]?Number(match[2]):data.length-1,start+2*1024*1024-1,data.length-1);
        if(end<start)return res.status(416).end();
        return res.status(206).set({'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${data.length}`}).send(data.subarray(start,end+1));
      }
      if(extname(file)==='.wasm'&&req.acceptsEncodings('gzip'))return res.set({'Content-Encoding':'gzip','Vary':'Accept-Encoding'}).send(gzipSync(data));
      return res.send(data);
    }catch(error){if(error.code!=='ENOENT')throw error;}}
  }
  const user=await sessions.read(requestFor(req));
  if(!user&&!presenter){if(!extname(req.path)||extname(req.path)==='.html')return res.type('html').send(await readFile(resolve(root,'gate.html')));return res.status(403).end();}
  const pathname=req.path==='/'?'/index.html':req.path;
  const file=resolve(views,'.'+pathname);
  if(!file.startsWith(views+sep)||!mime[extname(file)])return res.status(404).end();
  try{res.type(mime[extname(file)]).send(await readFile(file));}catch{res.status(404).end();}
});
app.use((error,_req,res,_next)=>res.status(error.status===413?413:500).json({error:'REQUEST_FAILED'}));
export default app;
