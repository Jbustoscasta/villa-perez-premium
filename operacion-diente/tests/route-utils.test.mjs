import test from 'node:test';
import assert from 'node:assert/strict';
import {validCoordinate, haversineMeters,createPath,pointAt,compactAddress,postcardSvg,escapeXml,trailParticles,routeBearing,cinematicProgress,cinematicPhase,publicFacingRoute,nearestPublicLandmark} from '../route-utils.mjs';
test('coordinate validation',()=>{ assert.equal(validCoordinate([-3.69,40.42]),true);assert.equal(validCoordinate([200,40]),false);assert.equal(validCoordinate([null,40]),false); });
test('distance zero and nonzero',()=>{ assert.equal(haversineMeters([-3,40],[-3,40]),0);assert.ok(haversineMeters([-3,40],[-3.01,40])>800); });
test('route interpolation follows line, not straight endpoints',()=>{let p=createPath([[0,0],[0,1],[1,1]]);let m=pointAt(p,.5);assert.ok(m.coordinate[0]<.1);assert.ok(m.coordinate[1]>.9);assert.deepEqual(pointAt(p,1).coordinate,[1,1]);});
test('invalid paths fail and zero-length fail',()=>{ assert.throws(()=>createPath([[0,0]]));assert.throws(()=>createPath([[0,0],[0,0]])); });
test('postcard does not reveal private destination address',()=>{const s=postcardSvg({clinicName:'Dentista <b>',distanceMeters:3000,points:[[-3.6,40.4],[-3.7,40.5]]});assert.ok(s.includes('Dentista &lt;b&gt;'));assert.ok(!s.includes('Calle'));assert.ok(!s.includes('40.5'));assert.ok(!s.includes('<b>'));});
test('compact Photon address',()=>{assert.match(compactAddress({properties:{street:'Gran Vía',housenumber:'4',city:'Madrid'}}),/Madrid/);});
test('xml escape',()=>{assert.equal(escapeXml('a&<b>'),'a&amp;&lt;b&gt;');});
test('sparkle tail always follows REAL route geometry',()=>{
 const path=createPath([[0,0],[0,1],[1,1]]);
 const tail=trailParticles(path,.75,8);
 assert.equal(tail.features.length,8);
 assert.ok(tail.features.every(f=>Math.abs(f.geometry.coordinates[1]-1)<.00001));
 assert.equal(trailParticles(path,0).features.length,0);
 assert.equal(trailParticles(null,.5).features.length,0);
});
test('camera bearing is based on local route section, not endpoints',()=>{
 const p=createPath([[0,0],[0,1],[1,1]]);
 const north=routeBearing(p,.2), east=routeBearing(p,.85);
 assert.ok(Math.abs(north)<1);assert.ok(east>80&&east<100);
});
test('souvenir never encodes route geometry in SVG even when points are supplied',()=>{
 const date=new Date('2026-11-19T12:00:00Z');
 const a=postcardSvg({clinicName:'Clínica',distanceMeters:2000,date,points:[[12.345678,40.456789],[12.3466,40.459]]});
 const b=postcardSvg({clinicName:'Clínica',distanceMeters:2000,date,points:[[-3.5,41.1],[-3.6,41.12]]});
 assert.equal(a,b);assert.ok(!a.includes('12.345678'));assert.ok(!a.includes('40.456789'));
});

test('cinematic time curve is monotone and pauses/resumes without jumps',()=>{
 let last=0;
 for(let i=0;i<=100;i++){const x=i/100,f=cinematicProgress(x);assert.ok(f+1e-10>=last);assert.ok(f>=0&&f<=1);assert.ok(Math.abs(cinematicPhase(f)-x)<.000001);last=f;}
 assert.equal(cinematicProgress(0),0);assert.equal(cinematicProgress(1),1);
});
test('a child's map truncates actual home street while demo keeps full route',()=>{
 const route=createPath([[-3.7,40.41],[-3.69,40.42],[-3.68,40.43]]);
 const privatePath=publicFacingRoute(route);
 assert.ok(privatePath.total<route.total-100);
 assert.notDeepEqual(privatePath.points.at(-1),route.points.at(-1));
 assert.deepEqual(publicFacingRoute(route,{demo:true}).points,route.points);
 assert.deepEqual(publicFacingRoute(route,{demo:false}).points[0],route.points[0]);
});
test('landmarks are only named after actual nearby road points, never guessed from city',()=>{
 const p=createPath([[0,0],[0,.005],[.005,.005],[.01,.005],[.01,.01]]);
 const yes=nearestPublicLandmark(p,[{name:'Punto público',coordinate:[.005,.005]}],180);
 assert.equal(yes.name,'Punto público');
 assert.ok(yes.progress>.18&&yes.progress<.8);
 const no=nearestPublicLandmark(p,[{name:'Monumento lejano',coordinate:[9,9]}],180);
 assert.equal(no,null);
});
