import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudienceActivity} from '../dist/audience-activity.js';

test('audience activity starts near 60, changes gradually, and carries countries',()=>{
  const updates=[];let scheduled;
  const activity=createAudienceActivity({onChange:value=>updates.push(value),random:()=>0,setTimer:fn=>(scheduled=fn,1),clearTimer:()=>{}});
  activity.start();assert.equal(updates[0].count,52);assert.equal(updates[0].participants.length,10);assert.ok(updates[0].participants.every(person=>person.countryCode));
  scheduled();assert.equal(updates[1].count,54);assert.equal(updates[1].participants[0].name,'Олена Коваль');activity.stop();
});
