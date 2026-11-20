import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStreetNightPoints,StreetNightScene} from '../street-night-v7.mjs';

const line=[{lat:40.42016,lng:-3.68845},{lat:40.422,lng:-3.690},{lat:40.429,lng:-3.690},{lat:40.436,lng:-3.691}];
const xy=(a,b)=>{
 const cos=Math.cos((a.lat+b.lat)/2*Math.PI/180);
 return Math.hypot((a.lat-b.lat)*111320,(a.lng-b.lng)*111320*cos);
};
test('Geographic night lights follow real route rather than made-up building positions',()=>{
 const {lamps,sparks,distance}=buildStreetNightPoints(line);
 assert.ok(distance>1500);
 assert.ok(lamps.length>=8&&lamps.length<=30);
 assert.ok(sparks.length>0&&sparks.length<=8);
 for(const p of lamps){
  assert.ok(p.altitude>=4&&p.altitude<=8);
  assert.ok(line.some(q=>xy(p,q)<1200),'each light stays near known route');
 }
 for(const p of sparks){
  assert.ok(p.altitude>=1&&p.altitude<=4&&p.mesh===true);
  assert.ok(line.some(q=>xy(p,q)<1200));
 }
});
test('A route with no coordinates produces no imaginary lights',()=>{
 assert.equal(buildStreetNightPoints([]).lamps.length,0);
 assert.equal(buildStreetNightPoints([{lat:40,lng:-3}]).sparks.length,0);
});
test('Numbers stay bounded even for very long journeys',()=>{
 const path=[{lat:40,lng:-3.7},{lat:40.9,lng:-3.7}];
 const result=buildStreetNightPoints(path);
 assert.ok(result.lamps.length<=30);
 assert.ok(result.sparks.length<=8);
});
test('Night / magic toggles preserve scene hierarchy and remove all lights',()=>{
 let count=0;
 const map={append(m){count++;m.isConnected=true}};
 const markers=()=>({isConnected:false,remove(){this.isConnected=false}});
 const lights=new StreetNightScene(map,function(){});
 lights.lamps=[markers(),markers()];lights.sparks=[markers()];
 lights.setNight(true);lights.setMagic(true);
 assert.equal(count,3);
 lights.setMagic(false);
 assert.equal(lights.lamps.filter(x=>x.isConnected).length,2);
 assert.equal(lights.sparks.filter(x=>x.isConnected).length,0);
 lights.setNight(false);
 assert.equal(lights.lamps.filter(x=>x.isConnected).length,0);
 lights.destroy();
 assert.equal(lights.lamps.length,0);
});
