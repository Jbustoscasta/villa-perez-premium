import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CinemaNight} from '../night-cinema-v9-1.mjs';

test('Moonlight overlay remains translucent, preserving real 3D aerial detail',()=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 const win={devicePixelRatio:3,matchMedia:()=>({matches:true}),addEventListener(){},removeEventListener(){}};
 const doc={hidden:false,documentElement:{classList:{toggle(){},remove(){}}},addEventListener(){},removeEventListener(){}};
 const stops=[];
 const ctx={
  clearRect(){},save(){},restore(){},fillRect(){},
  createLinearGradient(){return {addColorStop(t,color){stops.push([t,color])}}},
  createRadialGradient(){return {addColorStop(t,color){stops.push([t,color])}}}
 };
 const canvas={
  width:0,height:0,hidden:true,
  getContext:()=>ctx,
  getBoundingClientRect:()=>({width:390,height:700})
 };
 globalThis.window=win;globalThis.document=doc;
 try{
  const scene=new CinemaNight(canvas);
  scene.setNight(true);
  assert.equal(scene.level,1);
  assert.equal(canvas.hidden,false);
  assert.ok(stops.length>=4);
  const base=stops.slice(0,5).map(([,rgba])=>Number(rgba.match(/,(\d?\.?\d+)\)$/)?.[1]));
  assert.ok(base.every(a=>a>=.28&&a<=.45),
   'night must never obscure more than 45% of the photographic map');
  scene.setNight(false);
  assert.equal(canvas.hidden,true);
  scene.destroy();
 }finally{globalThis.window=previousWindow;globalThis.document=previousDocument}
});
test('No duplicate dark overlay, and prevent focus-zoom on mobile inputs',()=>{
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.ok(css.includes('html.night-active:not(.night-css-fallback) .cinema-grade'));
 assert.ok(css.includes('display:none!important'));
 assert.ok(css.includes('font-size:16px!important'));
 assert.ok(css.includes('max-width:47vw!important'));
});
