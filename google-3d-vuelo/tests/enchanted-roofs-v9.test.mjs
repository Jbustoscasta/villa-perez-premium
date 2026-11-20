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
  assert.ok(n>=5&&n<=100,'all candidates may span the full route');
  assert.ok(scene.markers.length<=12,'at most 12 mesh markers can be alive at once');
  const firstPositions=scene.markers.map(m=>m.options.position.lng);
  scene.setProgress(1);
  assert.ok(scene.markers.length<=12,'sliding window stays bounded');
  assert.notDeepEqual(scene.markers.map(m=>m.options.position.lng),firstPositions,
   'the enchanted corridor follows the balloon on longer routes');
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


test('Special rooftop landmarks use true GLB meshes and fall back to SVG if Google rejects a model',()=>{
 const previous=globalThis.document;
 globalThis.document={
  createElementNS:(ns,tag)=>({tag,innerHTML:'',setAttribute(){}}),
  createElement:tag=>({tag,content:{append(svg){this.svg=svg}}})
 };
 class Marker{
  constructor(options){this.options=options;this.isConnected=false;this.events={}}
  append(el){this.child=el}
  addEventListener(name,fn){this.events[name]=fn}
  remove(){this.isConnected=false}
 }
 class Model extends Marker{}
 const map={append(x){x.isConnected=true}};
 try{
  const scene=new EnchantedRoofScene(map,Marker,Model);
  scene.populate(route);
  const models=scene.markers.filter(x=>x instanceof Model);
  assert.ok(models.length>=2,'some enchanted buildings must be native 3D');
  for(const model of models){
   assert.equal(model.options.altitudeMode,'RELATIVE_TO_MESH');
   assert.ok(/\.glb$/.test(model.options.src));
   assert.ok(model.options.scale>0);
  }
  const current=models[0];
  current.events['gmp-error']();
  assert.ok(!scene.markers.includes(current),'broken model must be removed');
  assert.ok(scene.markers.some(x=>x instanceof Marker && !(x instanceof Model) && x.isConnected),
   'the illustrated roof appears as the fallback');
  scene.destroy();
 }finally{globalThis.document=previous}
});
