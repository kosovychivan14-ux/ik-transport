import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsCsv,summarizeAnalytics} from '../server/analytics-store.mjs';

test('analytics summary combines Telegram viewers, watch time, slides and engagement',()=>{
  const events=[
    {event_type:'slide_change',actor_role:'presenter',telegram_id:'owner',session_id:'p',slide_number:3,occurred_at:'2026-09-23T10:00:00Z'},
    {event_type:'room_open',actor_role:'viewer',telegram_id:'42',user_name:'Олена',username:'olena',session_id:'v',watch_seconds:0,occurred_at:'2026-09-23T10:00:01Z'},
    {event_type:'heartbeat',actor_role:'viewer',telegram_id:'42',user_name:'Олена',username:'olena',session_id:'v',watch_seconds:120,occurred_at:'2026-09-23T10:02:01Z'},
    {event_type:'recording_progress',actor_role:'viewer',telegram_id:'42',user_name:'Олена',username:'olena',session_id:'v',recording_id:'recordings/1.webm',watch_seconds:150,occurred_at:'2026-09-23T10:03:01Z'},
    {event_type:'question',actor_role:'viewer',telegram_id:'42',user_name:'Олена',session_id:'v',watch_seconds:150,occurred_at:'2026-09-23T10:03:02Z'},
    {event_type:'cta_click',actor_role:'viewer',telegram_id:'42',user_name:'Олена',session_id:'v',watch_seconds:151,occurred_at:'2026-09-23T10:03:03Z'},
  ];
  const summary=summarizeAnalytics(events);assert.equal(summary.totalViewers,1);assert.equal(summary.totalWatchSeconds,151);assert.equal(summary.recordingViewers,1);assert.equal(summary.totalQuestions,1);assert.equal(summary.totalCtaClicks,1);assert.equal(summary.viewers[0].lastSlide,3);assert.match(analyticsCsv(summary),/Олена/);
});
