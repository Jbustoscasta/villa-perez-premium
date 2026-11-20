import test from 'node:test';
import assert from 'node:assert/strict';
import {planEnchantedRoofs,EnchantedRoofScene} from '../enchanted-roofs-v9.mjs';

const route=[
 {lat:40.42016,lng:-3.68845},
 {lat:40.422,lng:-3.690},
 {lat:40.429,lng:-3.690},
 {lat:40.436,lng:-3.691}
];

test('No route means no fabricated enchanted buildings',()=>{
 assert.deepEqual(planEnchantedRoofs([]),[]);
 assert.deepEqual(planEnchantedRoofs([route[0]]),[]);
});
test('Each miniature stays in the geographic neighborhood of the real route',()=>{
 const items=planEnchantedRoofs(route);
 assert.ok(items.length>=5&&items.length<=12);
 assert.ok(items.some(v=>v.special));
 assert.ok(new Set(items.map(v=>v.type)).size>=4);
 for(const v of items){
  assert.ok(Number.isFinite(v.lat)&&Number.isFinite(v.lng));
  assert.ok(v.lat>40.4&&v.lat<40.45&&v.lng>-3.76&&v.lng<-3.62);
  assert.ok(v.altitude>0&&v.altitude<5);
 }
});
test('Magic decorations are depth-tested by Google mesh and light in mobile',()=>{
 const old=globalThis.document;
 globalThis.document={
  createElementNS:(ns,tag)=>({tag,innerHTML:'',setAttribute(){}}),
  createElement:tag=>({tag,content:{append(x){this.svg=x}}})
 };
 class Marker{
  constructor(options){this.options=options;this.isConnected=false;this.elements=[]}
  append(thing){this.elements.push(thing)}
  remove(){this.isConnected=false}
 }
 const map={append(m){m.isConnected=true}};
 try{
  const scene=new EnchantedRoofScene(map,Marker);
  const n=scene.populate(route);
  assert.ok(n>=5&&n<=12);
  assert.ok(scene.markers.every(m=>m.options.altitudeMode==='RELATIVE_TO_MESH'));
  assert.ok(scene.markers.every(m=>m.options.drawsWhenOccluded===false));
  assert.ok(scene.markers.every(m=>m.elements[0]?.content?.svg?.innerHTML.length>500));
  assert.ok(scene.markers.every(m=>m.isConnected));
  scene.setMagic(false);
  assert.ok(scene.markers.every(m=>!m.isConnected));
  scene.setMagic(true);
  assert.ok(scene.markers.every(m=>m.isConnected));
  scene.setNight(false);
  assert.ok(scene.markers.every(m=>!m.isConnected));
  scene.destroy();
  assert.equal(scene.markers.length,0);
 }finally{globalThis.document=old}
});
test('Very long routes cap enchanted ornaments to reduce iPhone load',()=>{
 const long=[{lat:40,lng:-3.7},{lat:40.9,lng:-3.7}];
 const items=planEnchantedRoofs(long);
 assert.ok(items.length<=12);
});
