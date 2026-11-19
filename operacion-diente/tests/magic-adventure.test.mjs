import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,NARRATION,missionAt,starRouteFractions,finalBadges,MagicAdventure} from '../magic-adventure.mjs';
import {createPath,postcardSvg} from '../route-utils.mjs';

test('three optional missions are ordered and never fire twice after completion',()=>{
  assert.equal(MISSIONS.length,3);
  assert.deepEqual(MISSIONS.map(x=>x.key),['lights','chase','portal']);
  assert.equal(missionAt(.1)?.key,undefined);
  assert.equal(missionAt(.2)?.key,'lights');
  assert.equal(missionAt(.5,new Set(['lights']))?.key,'chase');
  assert.equal(missionAt(.9,new Set(['lights','chase']))?.key,'portal');
  assert.equal(missionAt(1,new Set(['lights','chase','portal'])),null);
});
test('stars are anchored to clipped real route fractions, not random fantasy geometry',()=>{
  const spots=starRouteFractions(.17);
  assert.equal(spots.length,3);
  assert.ok(spots.every(f=>f>0&&f<1));
  assert.ok(spots[0]<spots[1]&&spots[1]<spots[2]);
});
test('rewards never require play and may be collected independently',()=>{
  const badges=finalBadges(new Set(['lights','chase','portal']),new Set(['lights']));
  assert.equal(badges.filter(x=>x.completed).length,1);
  assert.ok(badges.every(x=>x.visited));
  assert.ok(Object.values(NARRATION).every(s=>typeof s==='string'&&s.length>10));
});
test('souvenir reports only earned stars and never embeds home coordinates',()=>{
  const secret=[[-3.7,40.123456],[-3.6,40.654321]];
  const svg=postcardSvg({clinicName:'Clínica & Amistad',distanceMeters:1123,points:secret,stars:3});
  assert.ok(svg.includes('Clínica &amp; Amistad'));
  assert.ok(svg.includes('ESTRELLAS CONSEGUIDAS'));
  assert.ok(svg.includes('✦✦✦'));
  assert.ok(!svg.includes('40.654321'));
  assert.ok(!svg.includes('-3.7'));
});
test('three mini games pause, award stars and resume route on real clipped path',()=>{
  const oldDocument=globalThis.document;
  const oldWindow=globalThis.window;
  class FakeElement{
    constructor(){this.children=[];this.style={};this.listeners={};this.textContent='';this.dataset={};this.offsetHeight=155;this.clientWidth=380;this.clientHeight=510;
      this.classList={add(){},remove(){},toggle(){},contains(){return false}};}
    addEventListener(event,fn){this.listeners[event]=fn;}
    removeEventListener(){}
    setAttribute(){}
    appendChild(c){this.children.push(c);}
    replaceChildren(){this.children=[];}
    remove(){}
    getBoundingClientRect(){return {left:0,width:350};}
  }
  const elems=new Map();
  globalThis.document={
    getElementById(id){if(!elems.has(id))elems.set(id,new FakeElement());return elems.get(id);},
    createElement(){return new FakeElement();},
    querySelector(){return new FakeElement();}
  };
  globalThis.window={speechSynthesis:{cancel(){}}};
  const events=[];
  const map={on(){},off(){},easeTo(){},project(p){return {x:165+p[0]*8,y:260+p[1]*4}}};
  const path=createPath([[-3.71,40.414],[-3.70,40.417],[-3.69,40.42]]);
  const director=new MagicAdventure({
    getMap:()=>map,getPath:()=>path,
    onPause:()=>events.push('pause'),onResume:()=>events.push('resume'),
    getAudioUrls:()=>({})
  });
  try{
    assert.equal(director.tick(.17),true);
    assert.equal(director.markers.length,3);
    [0,1,2].forEach(i=>director.collectStar(i));
    director.finish(true);
    assert.equal(director.earned.size,1);
    assert.equal(director.tick(.43),true);
    director.catchStar();director.catchStar();director.catchStar();
    director.finish(true);
    assert.equal(director.tick(.71),true);
    director.portalDone();director.finish(true);
    assert.deepEqual([...director.earned],['lights','chase','portal']);
    assert.deepEqual(events,['pause','resume','pause','resume','pause','resume']);
    assert.equal(director.tick(.99),false);
    director.reset();
    assert.equal(director.earned.size,0);
  }finally{
    director.destroy();globalThis.document=oldDocument;globalThis.window=oldWindow;
  }
});
