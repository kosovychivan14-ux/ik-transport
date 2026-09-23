import {LIVE_API_ORIGIN} from './live-config.js';
export const liveMessages={LIVE_SERVICE_NOT_CONFIGURED:'Відеосервіс ще не підключений. Приватна тестова кнопка вже працює, а прямий ефір потребує завершення підключення.',ACCESS_DENIED:'Цей тест доступний лише власнику. Відкрийте кімнату через особисту кнопку в Telegram. Якщо вона давно відкрита — закрийте й відкрийте знову.',ORIGIN_DENIED:'Ця адреса кімнати ще не підключена до сервера трансляції.'};
export async function liveRequest(path,body){
  let response;
  try{response=await fetch(`${LIVE_API_ORIGIN}/api/live/${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(12000)});}catch{throw new Error('Не вдалося зв’язатися із сервером трансляції. Перевірте інтернет і спробуйте ще раз.');}
  if(response.status===404)throw new Error(liveMessages.LIVE_SERVICE_NOT_CONFIGURED);
  let data;try{data=await response.json();}catch{throw new Error(liveMessages.LIVE_SERVICE_NOT_CONFIGURED);}
  if(!response.ok)throw new Error(liveMessages[data.error]||'Не вдалося підключитися до приватного ефіру.');
  return data;
}
export function telegramData(){return window.Telegram?.WebApp?.initData||'';}
export class LiveConnection {
  constructor({onState=()=>{},onTrack=()=>{},onTrackRemoved=()=>{},onParticipantLeft=()=>{},onParticipants=()=>{}}={}){this.onState=onState;this.onTrack=onTrack;this.onTrackRemoved=onTrackRemoved;this.onParticipantLeft=onParticipantLeft;this.onParticipants=onParticipants;this.room=null;this.generation=0;}
  emitParticipants(room,presenterIdentity){
    if(!room)return;
    const remote=[...(room.remoteParticipants?.values?.()||[])].filter(participant=>participant.identity!==presenterIdentity);
    const local=room.localParticipant&&room.localParticipant.identity!==presenterIdentity?[room.localParticipant]:[];
    const participants=[...local,...remote];
    this.onParticipants({count:participants.length,participants});
  }
  async connect(role,{stream,presenterTicket}={}){
    const generation=++this.generation;
    this.onState('connecting');
    let room;
    try{
      const access=await liveRequest('token',{role,initData:telegramData(),presenterTicket});
      if(generation!==this.generation)return false;
      const {Room,RoomEvent,Track}=window.LivekitClient||{};
      if(!Room)throw new Error('Бібліотеку відеозв’язку не завантажено. Оновіть сторінку.');
      room=new Room({adaptiveStream:false,dynacast:false});this.room=room;
      const emitParticipants=()=>{if(generation===this.generation)this.emitParticipants(room,access.presenterIdentity);};
      room.on(RoomEvent.Reconnecting,()=>{if(generation===this.generation)this.onState('reconnecting');});
      room.on(RoomEvent.Reconnected,()=>{if(generation===this.generation){this.onState(role==='presenter'?'live':'connected');emitParticipants();}});
      room.on(RoomEvent.Disconnected,()=>{if(generation===this.generation){this.room=null;this.onParticipants({count:0,participants:[]});this.onState('disconnected');}});
      room.on(RoomEvent.TrackSubscribed,(track,publication,participant)=>{if(generation===this.generation&&participant.identity===access.presenterIdentity)this.onTrack(track,participant);});
      room.on(RoomEvent.TrackUnsubscribed,(track,publication,participant)=>{if(generation===this.generation&&participant?.identity===access.presenterIdentity)this.onTrackRemoved(track);});
      room.on(RoomEvent.ParticipantConnected,emitParticipants);
      room.on(RoomEvent.ParticipantDisconnected,participant=>{if(generation===this.generation){if(participant.identity===access.presenterIdentity)this.onParticipantLeft();emitParticipants();}});
      await room.connect(access.url,access.token,{autoSubscribe:role==='viewer'});
      if(generation!==this.generation){await room.disconnect();return false;}
      emitParticipants();
      if(role==='presenter'){
        if(!stream?.getVideoTracks().length)throw new Error('Підготуйте кадр перед початком ефіру.');
        for(const track of stream.getTracks()){
          await room.localParticipant.publishTrack(track,{source:track.kind==='video'?Track.Source.Camera:Track.Source.Microphone,name:track.kind==='video'?'ik-program':'ik-microphone',simulcast:false,videoCodec:'vp8',videoEncoding:{maxBitrate:4500000,maxFramerate:24},stopMicTrackOnMute:false});
          if(generation!==this.generation){await room.disconnect();return false;}
        }
      }
      this.onState(role==='presenter'?'live':'connected');return true;
    }catch(error){if(room)await room.disconnect().catch(()=>{});if(generation===this.generation){this.room=null;this.onState('error',error.message);}return false;}
  }
  async startAudio(){await this.room?.startAudio();}
  async disconnect(){this.generation++;const room=this.room;this.room=null;await room?.disconnect();this.onParticipants({count:0,participants:[]});this.onState('idle');}
}
