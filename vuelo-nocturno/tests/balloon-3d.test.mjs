import test from 'node:test';
import assert from 'node:assert/strict';
import {balloonFlightPose} from '../balloon-3d.mjs';

test('balloon uses actual geographic coordinates with no invented offsets',()=>{
  const c=[-3.68845,40.42016];
  const p=balloonFlightPose({coordinates:c,bearing:92,altitude:112,progress:.45});
  assert.deepEqual(p.coordinates,c);
  assert.notStrictEqual(p.coordinates,c);
  assert.equal(p.bearing,92);
  assert.equal(p.altitude,112);
});
test('balloon keeps safe 3D altitude bounds and progress bounds',()=>{
  assert.equal(balloonFlightPose({coordinates:[-3.7,40.4],altitude:-1,progress:-4}).altitude,32);
  assert.equal(balloonFlightPose({coordinates:[-3.7,40.4],altitude:999,progress:999}).altitude,180);
  assert.equal(balloonFlightPose({coordinates:[-3.7,40.4],altitude:100,progress:2}).progress,1);
});
test('invalid geographic coordinates are rejected',()=>{
  assert.throws(()=>balloonFlightPose({coordinates:[]}));
  assert.throws(()=>balloonFlightPose({coordinates:['Madrid',40]}));
  assert.throws(()=>balloonFlightPose({coordinates:[NaN,0]}));
});
