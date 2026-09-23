import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFunnelEvent} from '../server/premiere-store.mjs';

test('completed SendPulse funnel event creates an eligible UTC premiere assignment',()=>{
  const event=normalizeFunnelEvent({event_type:'funnel_completed',event_key:'finish-contact-42-2026-10-01',telegram_id:'511274530',contact_id:'sp-42',name:'Іван',webinar_at:'2026-10-01T16:00:00Z'});
  assert.equal(event.eligible,true);assert.equal(event.status,'completed');assert.equal(event.webinarAt,'2026-10-01T16:00:00.000Z');
});

test('funnel webhook rejects missing Telegram identity and invalid premiere time',()=>{
  assert.throws(()=>normalizeFunnelEvent({event_type:'funnel_completed',telegram_id:'',webinar_at:'2026-10-01T16:00:00Z'}));
  assert.throws(()=>normalizeFunnelEvent({event_type:'funnel_completed',telegram_id:'511274530',webinar_at:'tomorrow',completed_at:'also-invalid'}));
});

test('completed funnel without an assigned date schedules the personal premiere 48 hours later',()=>{
  const event=normalizeFunnelEvent({event_type:'funnel_completed',telegram_id:'511274530',contact_id:'sp-42',completed_at:'2026-10-01T16:00:00Z'});
  assert.equal(event.webinarAt,'2026-10-03T16:00:00.000Z');
  assert.equal(event.occurredAt,'2026-10-01T16:00:00.000Z');
  assert.match(event.eventKey,/funnel_completed:sp-42:2026-10-03T16:00:00\.000Z/);
});

test('delivery events keep the same premiere and expose their event timestamp',()=>{
  const event=normalizeFunnelEvent({event_type:'room_link_sent',telegram_id:'511274530',contact_id:'sp-42',webinar_at:'2026-10-02T16:00:00Z',occurred_at:'2026-10-02T15:55:00Z'});
  assert.equal(event.webinarAt,'2026-10-02T16:00:00.000Z');
  assert.equal(event.occurredAt,'2026-10-02T15:55:00.000Z');
});

test('duplicate event keys remain deterministic for idempotency',()=>{
  const body={event_type:'funnel_completed',telegram_id:'511274530',contact_id:'sp-42',webinar_at:'2026-10-01T16:00:00Z'};
  assert.equal(normalizeFunnelEvent(body).eventKey,normalizeFunnelEvent(body).eventKey);
});
