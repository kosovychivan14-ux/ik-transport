const dateFormat=new Intl.DateTimeFormat('uk-UA',{timeZone:'Europe/Kyiv',day:'numeric',month:'long',year:'numeric'});
const timeFormat=new Intl.DateTimeFormat('uk-UA',{timeZone:'Europe/Kyiv',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function formatRoomTime(timestamp){
  return {date:dateFormat.format(timestamp),time:timeFormat.format(timestamp),iso:new Date(timestamp).toISOString()};
}
export function createRoomClock({wallNow=()=>Date.now(),monotonicNow=()=>performance.now()}={}){
  let anchorTime=null,anchorTick=0;
  return {
    synchronize(serverTime,requestStarted){
      const tick=monotonicNow(),roundTrip=tick-requestStarted;
      if(!Number.isFinite(serverTime)||serverTime<=0||roundTrip<0||roundTrip>15000)return false;
      anchorTime=serverTime+roundTrip/2;anchorTick=tick;return true;
    },
    get synchronized(){return anchorTime!==null;},
    now(){return anchorTime===null?wallNow():anchorTime+Math.max(0,monotonicNow()-anchorTick);}
  };
}
