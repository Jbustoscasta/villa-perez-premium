import test from 'node:test';
import assert from 'node:assert/strict';
import {extractMappedBuildings,buildArchitectureGeometry} from '../architecture-v2.mjs';

const focus=[-3.703,40.418];
const dx=1/(111320*Math.cos(focus[1]*Math.PI/180)),dy=1/111320;
const rectangle=(x,y,w,h,properties={})=>{
 const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,-h/2]]
  .map(([a,b])=>[focus[0]+(x+a)*dx,focus[1]+(y+b)*dy]);
 return {type:'Feature',geometry:{type:'Polygon',coordinates:[corners]},properties};
};
test('The 3D city cannot invent buildings when map data are empty',()=>{
 const map={querySourceFeatures:()=>[]};
 const buildings=extractMappedBuildings(map,'source','building',focus);
 assert.equal(buildings.length,0);
 const scene=buildArchitectureGeometry(buildings,focus);
 assert.equal(scene.real,0);assert.equal(scene.roofAccents,0);assert.equal(scene.vertices,0);
});
test('Roof cornices and warm windows attach to actual real footprint',()=>{
 const feature=rectangle(0,0,23,17,{'render_height':22,'roof:shape':'hipped'});
 const map={querySourceFeatures:()=>[feature,feature]};
 const buildings=extractMappedBuildings(map,'source','building',focus);
 assert.equal(buildings.length,1,'duplicate vector tiles must not duplicate buildings');
 assert.equal(buildings[0].height,22);
 const scene=buildArchitectureGeometry(buildings,focus);
 assert.ok(scene.windows>0);assert.ok(scene.roofAccents>0);assert.ok(scene.facades>=4);
 assert.equal(scene.data.length,scene.vertices*7);
 assert.ok([...scene.data].every(Number.isFinite),'all 3D coordinates are finite');
});
test('Safari-size geometry stays under a bounded WebGL buffer',()=>{
 const buildings=Array.from({length:90},(_,i)=>
  rectangle((i%10-5)*35,(Math.floor(i/10)-4)*38,13,16,{'height':9+(i%8)*3}));
 const map={querySourceFeatures:()=>buildings};
 const shapes=extractMappedBuildings(map,'source','building',focus,{max:90,radius:550});
 const scene=buildArchitectureGeometry(shapes,focus,{maxVertices:85000});
 assert.ok(scene.real>40);
 assert.ok(scene.vertices<=85000);
 assert.ok(scene.data.byteLength<3*1024*1024);
});
test('Non-map geometries or distant buildings are ignored',()=>{
 const outside=rectangle(10000,0,25,25);
 const invalid={geometry:{type:'Point',coordinates:focus},properties:{}};
 const map={querySourceFeatures:()=>[outside,invalid]};
 assert.equal(extractMappedBuildings(map,'source','building',focus).length,0);
});
