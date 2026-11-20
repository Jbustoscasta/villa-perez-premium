/**
 * Villa Pérez · Luces de calle y destellos mágicos (Google Maps 3D)
 *
 * Important limitation: Google SATELLITE photogrammetry cannot be re-lit
 * or accessed as editable building meshes. These are individual light
 * sources in geographic 3D space following Google Routes, not fake
 * textured windows or rebuilt architecture.
 *
 * Each object is depth-tested by Google and uses its own map coordinates.
 * Bounded count for Safari iPhone. No geocoding, remote API or telemetry.
 */
const R=Math.PI/180,EARTH=6371000;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const metreDistance=(a,b)=>{
 const p1=a.lat*R,p2=b.lat*R,dp=(b.lat-a.lat)*R,dl=(b.lng-a.lng)*R;
 const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
 return 2*EARTH*Math.asin(Math.min(1,Math.sqrt(h)));
};
const lerp=(a,b,t)=>({lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t});
function preparePath(points){
 const valid=(points||[]).filter(p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lng));
 const cum=[0];
 for(let i=1;i<valid.length;i++)cum.push(cum.at(-1)+metreDistance(valid[i-1],valid[i]));
 return {valid,cum,total:cum.at(-1)||0};
}
function pathAt(prepared,metres){
 const {valid,cum,total}=prepared;if(valid.length<2)return null;
 const d=clamp(metres,0,total);
 let i=0;while(i<cum.length-2&&cum[i+1]<d)i++;
 const part=(d-cum[i])/Math.max(.01,cum[i+1]-cum[i]);
 const point=lerp(valid[i],valid[i+1],part);
 const next=valid[i+1];
 const latScale=111320,lngScale=latScale*Math.cos(point.lat*R);
 const dx=(next.lng-valid[i].lng)*lngScale,dy=(next.lat-valid[i].lat)*latScale;
 const length=Math.max(0.001,Math.hypot(dx,dy));
 return {...point,right:[dy/length,-dx/length]};
}
function lateralOffset(position,side,metres){
 const east=position.right[0]*side*metres,north=position.right[1]*side*metres;
 return {lat:position.lat+north/111320,
  lng:position.lng+east/(111320*Math.max(.2,Math.cos(position.lat*R)))};
}
export function buildStreetNightPoints(path,{maxRoad=30,maxSparkles=8}={}){
 const prepared=preparePath(path);
 if(prepared.total<65)return {lamps:[],sparks:[],distance:prepared.total};
 // evenly spaced along the real street route, not based on screen coordinates
 const n=Math.min(maxRoad,Math.max(5,Math.floor(prepared.total/74)));
 const lamps=[],sparks=[];
 for(let i=0;i<n;i++){
  const along=(i+.5)/(n+1)*prepared.total,position=pathAt(prepared,along);
  if(!position)continue;
  const side=i%2===0?1:-1;
  const offset=lateralOffset(position,side,6.5);
  lamps.push({...offset,altitude:5.1+(i%4)*.45,index:i});
 }
 const m=Math.min(maxSparkles,Math.floor(prepared.total/230));
 for(let i=0;i<m;i++){
  const along=(i+1)/(m+1)*prepared.total,position=pathAt(prepared,along);
  if(!position)continue;
  // These are sparse magical lights above the city, not alleged
  // authentic windows/roof objects whose surfaces we cannot inspect.
  const p=lateralOffset(position,i%2?1:-1,17);
  // Google's RELATIVE_TO_MESH anchors a magical glint to the 3D
  // surface (roof, terrain or tree) rather than floating at a fake height.
  sparks.push({...p,altitude:1.5+(i%3)*.8,mesh:true,index:i});
 }
 return {lamps,sparks,distance:prepared.total};
}
function svgLamp(i){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('xmlns',ns);svg.setAttribute('viewBox','0 0 40 40');
 svg.setAttribute('width','32');svg.setAttribute('height','32');
 const defs=document.createElementNS(ns,'defs'),g=document.createElementNS(ns,'radialGradient');
 g.setAttribute('id','halo');g.setAttribute('cx','.5');g.setAttribute('cy','.5');g.setAttribute('r','.5');
 for(const [at,color,opacity] of [
  ['0%','#fff7c5','1'],['14%','#fbe0a3','.84'],['46%','#f3ac58','.24'],['100%','#e1a24a','0']]){
  const stop=document.createElementNS(ns,'stop');
  stop.setAttribute('offset',at);stop.setAttribute('stop-color',color);
  stop.setAttribute('stop-opacity',opacity);g.append(stop);
 }
 defs.append(g);svg.append(defs);
 const halo=document.createElementNS(ns,'circle');halo.setAttribute('cx','20');halo.setAttribute('cy','20');
 halo.setAttribute('r',i%5===0?'19':'17');halo.setAttribute('fill','url(#halo)');svg.append(halo);
 const core=document.createElementNS(ns,'circle');core.setAttribute('cx','20');core.setAttribute('cy','20');
 core.setAttribute('r','2.15');core.setAttribute('fill','#fff1c4');core.setAttribute('opacity','.9');
 svg.append(core);
 return svg;
}
function svgSpark(i){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('xmlns',ns);svg.setAttribute('width','25');svg.setAttribute('height','25');
 svg.setAttribute('viewBox','0 0 32 32');
 const halo=document.createElementNS(ns,'circle');halo.setAttribute('cx','16');halo.setAttribute('cy','16');
 halo.setAttribute('r','12');halo.setAttribute('fill','#f5c67a');halo.setAttribute('opacity','.15');
 const star=document.createElementNS(ns,'path');
 star.setAttribute('d','M16 3 L18 13.5 L29 16 L18 18.5 L16 29 L14 18.5 L3 16 L14 13.5 Z');
 star.setAttribute('fill',i%2?'#ffe8b2':'#fff6d6');star.setAttribute('opacity','.76');
 svg.append(halo,star);return svg;
}
export class StreetNightScene{
 constructor(map,Marker3DElement){
  this.map=map;this.Marker3DElement=Marker3DElement;
  this.lamps=[];this.sparks=[];this.night=true;this.magic=true;
 }
 marker(point,icon){
  if(!this.map||!this.Marker3DElement)return null;
  const marker=new this.Marker3DElement({
   position:{lat:point.lat,lng:point.lng,altitude:point.altitude},
   altitudeMode:point.mesh?'RELATIVE_TO_MESH':'RELATIVE_TO_GROUND',
   drawsWhenOccluded:false,
   sizePreserved:true,zIndex:2
  });
  const template=document.createElement('template');
  template.content.append(icon);marker.append(template);
  return marker;
 }
 clear(){
  for(const marker of [...this.lamps,...this.sparks]){
   try{marker.remove()}catch(e){}
  }
  this.lamps=[];this.sparks=[];
 }
 populate(points){
  this.clear();
  if(!this.map||!this.Marker3DElement)return {lamps:0,sparks:0};
  const {lamps,sparks}=buildStreetNightPoints(points);
  for(const [i,p] of lamps.entries())try{
   const marker=this.marker(p,svgLamp(i));if(marker)this.lamps.push(marker);
  }catch(e){console.warn('Night street light skipped:',e);break}
  for(const [i,p] of sparks.entries())try{
   const marker=this.marker(p,svgSpark(i));if(marker)this.sparks.push(marker);
  }catch(e){console.warn('Night roof-adjacent sparkle skipped:',e);break}
  this.sync();
  return {lamps:this.lamps.length,sparks:this.sparks.length};
 }
 sync(){
  for(const [group,visible] of [[this.lamps,this.night],[this.sparks,this.night&&this.magic]]){
   for(const marker of group)try{
    if(visible&&!marker.isConnected)this.map?.append(marker);
    if(!visible&&marker.isConnected)marker.remove();
   }catch(e){console.warn('Night light visibility skipped:',e)}
  }
 }
 setNight(v){this.night=Boolean(v);this.sync()}
 setMagic(v){this.magic=Boolean(v);this.sync()}
 destroy(){this.clear();this.map=null}
}
