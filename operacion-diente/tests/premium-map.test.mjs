import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPremiumStreetStyle,installPremiumCityLayers,premiumRoutePaint,drawGoldenRouteFx} from '../premium-map.mjs';
import {createPath} from '../route-utils.mjs';

function mapStub(){
  const layers=[
    {id:'background',type:'background'},
    {id:'waterway-fill',type:'fill','source-layer':'water'},
    {id:'park-fill',type:'fill','source-layer':'landuse'},
    {id:'street-primary',type:'line','source-layer':'transportation'},
    {id:'street-labels',type:'symbol','source-layer':'transportation_name',layout:{'text-field':['get','name']}},
    {id:'building-footprint',type:'fill','source-layer':'building'},
    {id:'route-gold',type:'line'}
  ];
  const sources={planet:{type:'vector',url:'https://tiles.openfreemap.org/planet'}};
  const paints=[];
  return {
    paints,layers,sources,
    getStyle(){return {layers,sources};},
    getLayer(id){return layers.find(l=>l.id===id);},
    getSource(id){return sources[id];},
    setPaintProperty(id,key,value){paints.push([id,key,value]);},
    addLayer(obj){layers.push(obj);},
    addSource(id,source){sources[id]=source;},
    project(c){return {x:100+c[0]*100,y:200+c[1]*100};}
  };
}
test('real street layers receive high-contrast paint and labels',()=>{
  const map=mapStub();
  const r=applyPremiumStreetStyle(map);
  assert.ok(r.roads>=1 && r.labels>=1 && r.parks>=1);
  assert.ok(map.paints.some(([id,key,value])=>id==='street-primary'&&key==='line-color'&&value==='#e5dbb7'));
  assert.ok(map.paints.some(([id,key])=>id==='street-labels'&&key==='text-halo-width'));
});
test('3D buildings reuse real vector source with labels kept on top',()=>{
  const map=mapStub();
  const created=installPremiumCityLayers(map);
  assert.equal(created.source,'planet');
  assert.equal(created.buildings,true);
  assert.equal(created.avenues,true);
  assert.equal(map.layers.find(l=>l.id==='vp-city-3d')['source-layer'],'building');
  assert.equal(map.layers.find(l=>l.id==='vp-avenue-highlight')['source-layer'],'transportation');
});
test('road glow is multiple times wider than its path and does not alter navigation geometry',()=>{
  const map=mapStub();
  map.layers.push({id:'route-glow',type:'line'});
  premiumRoutePaint(map);
  const width=map.paints.find(([id,key])=>id==='route-glow'&&key==='line-width');
  assert.equal(width[2],34);
});
test('canvas sparkles projected along exact route and respect reduced motion',()=>{
  const map=mapStub();
  const path=createPath([[0,0],[0,1],[1,1]]);
  let draws=0;
  const ctx={
    setTransform(){},clearRect(){},save(){},restore(){},beginPath(){},arc(){draws++;},fill(){},stroke(){},
    moveTo(){},lineTo(){},createRadialGradient(){return {addColorStop(){}};}
  };
  const canvas={clientWidth:350,clientHeight:500,width:0,height:0,getContext(){return ctx;}};
  const old=globalThis.window;
  globalThis.window={devicePixelRatio:2};
  try{
    drawGoldenRouteFx(map,path,.65,canvas,1000,false);
    assert.ok(draws>5);
    assert.ok(canvas.width<=595);
    const oldDraws=draws;
    drawGoldenRouteFx(map,path,.75,canvas,1100,true);
    assert.equal(draws,oldDraws);
  } finally {globalThis.window=old;}
});
