import test from 'node:test';
import assert from 'node:assert/strict';
import {createCinemaCity} from '../cinema-city.mjs';
import {createMagicAtmosphere} from '../magic-atmosphere.mjs';

const rectangle=[[-3.6890,40.4200],[-3.6888,40.4200],[-3.6888,40.4202],[-3.6890,40.4202],[-3.6890,40.4200]];
function scene(features=[]){
 const map={
  getCenter(){return {lng:-3.6889,lat:40.4201}},
  querySourceFeatures(source,{sourceLayer}){assert.equal(sourceLayer,'building');return features},
  triggerRepaint(){}
 };
 const captured={};
 const gl={
  VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,
  ARRAY_BUFFER:34962,DYNAMIC_DRAW:35048,
  createShader(){return {}},shaderSource(){},compileShader(){},getShaderParameter(){return true},
  getShaderInfoLog(){return ''},deleteShader(){},createProgram(){return {}},attachShader(){},
  linkProgram(){},getProgramParameter(){return true},deleteProgram(){},createBuffer(){return {}},
  bindBuffer(){},bufferData(type,array){captured.buffer=array},getAttribLocation(){return 0},
  getUniformLocation(){return {}},useProgram(){},uniformMatrix4fv(){},uniform1f(){},
  enableVertexAttribArray(){},disableVertexAttribArray(){},vertexAttribPointer(){},enable(){},
  disable(){},blendFunc(){},depthMask(){},drawArrays(){}
 };
 const layer=createCinemaCity(map,{getSource:()=> 'osm',onStats:stats=>{captured.stats=stats}});
 layer.onAdd(map,gl);layer.rebuild();return {layer,captured};
}
test('A city without mapped buildings must never create made-up architecture',()=>{
 const {layer,captured}=scene();
 assert.equal(layer.count,0);
 assert.equal(captured.stats.real,0);
 assert.equal(captured.stats.fantasy,0);
});
test('Existing OSM footprints support finite 3D luminous facade geometry',()=>{
 const feature={geometry:{type:'Polygon',coordinates:[rectangle]},properties:{height:21}};
 const {layer,captured}=scene([feature]);
 assert.equal(captured.stats.real,1);
 assert.equal(captured.stats.fantasy,0);
 assert.ok(layer.count>0);
 assert.equal(captured.buffer.length,layer.count*7);
 assert.ok([...captured.buffer].every(Number.isFinite));
});
test('Reduced-capability browsers can keep the map functional without a canvas',()=>{
 const fx=createMagicAtmosphere({canvas:null});
 assert.doesNotThrow(()=>{fx.setActive(true);fx.setActive(false);fx.destroy()});
});
