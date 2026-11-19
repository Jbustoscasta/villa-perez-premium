import test from 'node:test';
import assert from 'node:assert/strict';
import {STORY_STARS,NARRATION,earnedStoryStars,nextMorningTime,makeMemento,safeMemento} from '../journey-director.mjs';

test('three passive stars accrue by travel progress with no game controls',()=>{
  assert.equal(STORY_STARS.length,3);
  assert.equal(earnedStoryStars(0).length,0);
  assert.equal(earnedStoryStars(.30).length,1);
  assert.equal(earnedStoryStars(.60).length,2);
  assert.equal(earnedStoryStars(.93).length,3);
  assert.equal(earnedStoryStars(1).length,3);
});
test('opening narration is the approved script, with no game dialogue',()=>{
  assert.equal(NARRATION.intro,'¡Atención! ¡Ha caído un diente! ¡Preparad la mochila!');
  assert.equal(NARRATION.near,'¡Ya casi estoy! Pero hay una regla muy importante: nadie puede verme entrar.');
  assert.ok(!Object.keys(NARRATION).some(key=>/lights|chase|portal/i.test(key)));
});
test('morning unlock occurs at 06:00 the following local calendar day',()=>{
  const d=new Date(2026,10,19,18,35);
  const unlock=new Date(nextMorningTime(d));
  assert.equal(unlock.getFullYear(),2026);assert.equal(unlock.getMonth(),10);
  assert.equal(unlock.getDate(),20);assert.equal(unlock.getHours(),6);assert.equal(unlock.getMinutes(),0);
});
test('morning souvenir never stores home address, coordinates or geometry',()=>{
  const createdAt=new Date(2026,10,19,20,0);
  const m=makeMemento({clinic:'Clínica del Doctor Abreu',distanceMeters:3642,stars:3,now:createdAt});
  const json=JSON.stringify(m);
  assert.equal(m.distanceMeters,3500);
  assert.ok(!json.includes('address')&&!json.includes('coordinate')&&!json.includes('path'));
  assert.deepEqual(Object.keys(m).sort(),['clinic','createdAt','distanceMeters','readyAt','stars','version'].sort());
  assert.ok(safeMemento(m,new Date(2026,10,20,7,0)));
});
test('invalid, stale, or tampered local memories are rejected',()=>{
  const now=new Date(2026,10,20,7,0);
  const m=makeMemento({clinic:'Prueba',distanceMeters:2000,stars:2,now:new Date(2026,10,19,20)});
  assert.equal(safeMemento({...m,readyAt:-1},now),null);
  assert.equal(safeMemento({...m,distanceMeters:-2},now),null);
  assert.equal(safeMemento({...m,stars:4},now),null);
  assert.equal(safeMemento({...m,createdAt:new Date(2026,9,1).getTime()},now),null);
});
