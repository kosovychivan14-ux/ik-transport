export const DEMO_DURATION = 30;
export function clampTime(time,duration=DEMO_DURATION){ return Math.max(0,Math.min(Number.isFinite(time)?time:0,duration)); }
export function formatTime(seconds){ const n=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0)); return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; }
export function scheduledState(startAt,now,duration=DEMO_DURATION){
  if(!Number.isFinite(startAt)||!Number.isFinite(now)) return {phase:'idle',position:0,remaining:0};
  const delta=(now-startAt)/1000;
  if(delta<0)return {phase:'waiting',position:0,remaining:Math.ceil(-delta)};
  if(delta>=duration)return {phase:'ended',position:duration,remaining:0};
  return {phase:'playing',position:delta,remaining:0};
}
