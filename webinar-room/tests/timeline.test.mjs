import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledState,clampTime,formatTime} from '../dist/timeline.js';
test('scheduled replay remains aligned after a late join or suspended browser',()=>{assert.deepEqual(scheduledState(100000,110500),{phase:'playing',position:10.5,remaining:0});assert.equal(scheduledState(100000,140000).phase,'ended');});
test('start boundary and countdown never become negative',()=>{assert.deepEqual(scheduledState(100000,99999),{phase:'waiting',position:0,remaining:1});assert.deepEqual(scheduledState(100000,100000),{phase:'playing',position:0,remaining:0});assert.equal(scheduledState(100000,130000).phase,'ended');});
test('invalid schedule fails closed and progress is bounded',()=>{assert.equal(scheduledState(null,100).phase,'idle');assert.equal(clampTime(NaN),0);assert.equal(clampTime(-4),0);assert.equal(clampTime(100),30);assert.equal(formatTime(-1),'00:00');assert.equal(formatTime(70),'01:10');});
