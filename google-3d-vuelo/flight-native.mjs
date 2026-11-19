/**
 * Villa Pérez: georeferenced 3D balloon and magical route effects.
 * Uses Google Maps JavaScript API Model3DElement / Marker3DElement /
 * Polyline3DElement. All visible effects are placed IN the 3D world.
 * Mouse identity: official ../perez.png as image marker, never redrawn.
 */
const METERS=111320;
export const BALLOON_ALTITUDE=58; // above natural ground, not sea level
const MODEL_SRC=new URL('./assets/globo-villa-perez-v3.glb',import.meta.url).href;
// The official mouse is intentionally NOT rendered as a map marker: Safari
// could magnify it to building size. Its untouched PNG appears in the HUD.
export const geoDistance=(a,b)=>{
 const r=Math.PI/180,x=(b.lng-a.lng)*Math.cos((a.lat+b.lat)*r/2),y=b.lat-a.lat;
 return Math.hypot(x,y)*METERS;
};
export const interpolate=(a,b,t)=>({lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t});
export function cutPrivateTail(points,meters=180){
 if(!Array.isArray(points)||points.length<2)return points||[];
 let traversed=0;
 for(let i=points.length-1;i>0;i--){
  const d=geoDistance(points[i],points[i-1]);
  if(traversed+d>=meters){
   const fraction=Math.max(0,Math.min(1,(d-(meters-traversed))/Math.max(d,.001)));
   const result=points.slice(0,i);
   result.push(interpolate(points[i-1],points[i],fraction));
   return result.length>=2?result:[points[0],points[1]];
  }
  traversed+=d;
 }
 return [points[0],points[1]];
}
export function compactPath(points,maxPoints=230){
 if(points.length<=maxPoints)return points;
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+geoDistance(points[i-1],points[i]));
 const total=lengths.at(-1),out=[],N=Math.max(2,maxPoints);
 let at=0;
 for(let j=0;j<N;j++){
  const dist=j/(N-1)*total;
  while(at<points.length-2&&lengths[at+1]<dist)at++;
  const step=Math.max(1e-9,lengths[at+1]-lengths[at]);
  out.push(interpolate(points[at],points[at+1],(dist-lengths[at])/step));
 }
 return out;
}
export async function calculateStreetRoute(start,end,privateHome=false){
 // A single call on explicit launch; no address sent to OSM/other third parties.
 const {Route}=await google.maps.importLibrary('routes');
 const result=await Route.computeRoutes({
  origin:start,destination:end,travelMode:'WALKING',
  fields:['path'],polylineQuality:'HIGH_QUALITY'
 });
 if(!result?.routes?.length||!result.routes[0]?.path?.length)throw new Error('No route');
 const points=result.routes[0].path.map(p=>({lat:typeof p.lat==='function'?p.lat():p.lat,lng:typeof p.lng==='function'?p.lng():p.lng})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
 if(points.length<2)throw new Error('Empty route');
 const safe=privateHome?cutPrivateTail(points,180):points;
 if(safe.length<2)throw new Error('Insufficient safe path');
 return compactPath(safe,220);
}
function makeStarSvg(color='#ffe7b1',size=34){
 const n='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(n,'svg');
 svg.setAttribute('xmlns',n);svg.setAttribute('width',String(size));svg.setAttribute('height',String(size));
 svg.setAttribute('viewBox','0 0 32 32');
 const circle=document.createElementNS(n,'circle');
 circle.setAttribute('cx','16');circle.setAttribute('cy','16');circle.setAttribute('r','7');
 circle.setAttribute('fill',color);circle.setAttribute('opacity','.28');
 const shape=document.createElementNS(n,'path');
 shape.setAttribute('d','M16 3L18.7 13.3L29 16L18.7 18.7L16 29L13.3 18.7L3 16L13.3 13.3Z');
 shape.setAttribute('fill',color);shape.setAttribute('opacity','.94');
 svg.append(circle,shape);return svg;
}
function templateWith(el){
 const template=document.createElement('template');template.content.append(el);return template;
}
export class NativeFlightScene{
 constructor(map,lib,onError=null,origin={lat:40.42016,lng:-3.68845}){
  this.map=map;this.lib=lib;this.origin=origin;this.onError=onError;this.model=null;this.trace=null;
  this.stars=[];this.lastTrailAt=0;this.lastStarAt=0;this.points=[];this.active=false;
  this.modelActive=false;this.pathTrail=[];this.muted=false;this.modelLoadError=false;
 }
 create(){
  if(this.active)return this.modelActive;
  this.active=true;
  const {Model3DElement,Marker3DElement,Polyline3DElement}=this.lib;
  if(!Model3DElement)throw Error('Esta versión de Google Maps no admite GLB');
  const p={lat:this.origin.lat,lng:this.origin.lng,altitude:BALLOON_ALTITUDE};
  try{
   this.model=new Model3DElement({
     src:MODEL_SRC,position:p,orientation:{heading:0,tilt:0,roll:0},
     scale:2.75,altitudeMode:'RELATIVE_TO_GROUND'
   });
   const reportModelError=event=>{
     this.modelLoadError=true;
     console.warn('Native GLB scene problem:',event);
     try{this.onError?.(event)}catch(e){console.warn('Unable to switch to fallback',e)}
   };
   this.model.addEventListener('error',reportModelError);
   this.model.addEventListener('gmp-error',reportModelError);
   this.map.append(this.model);
   this.modelActive=true;
  }catch(e){this.modelActive=false;this.modelLoadError=true;throw e}
  // Do not add a photo of Ratón as Marker3DElement: on mobile the
  // original PNG could be displayed at enormous and incorrect scale.
  if(Polyline3DElement){
   try{
    this.trace=new Polyline3DElement({
      path:[p,p],strokeColor:'#ffe7af',strokeWidth:8,
      outerColor:'#c8893f',outerWidth:.55,
      drawsOccludedSegments:false,altitudeMode:'RELATIVE_TO_GROUND'
    });
    this.map.append(this.trace);
   }catch(e){console.warn('Golden trail not supported:',e)}
  }
  if(Marker3DElement){
   for(let i=0;i<7;i++)try{
    const m=new Marker3DElement({
      position:{...p,altitude:BALLOON_ALTITUDE+1},
      altitudeMode:'RELATIVE_TO_GROUND',drawsWhenOccluded:false,
      sizePreserved:true,collisionBehavior:'REQUIRED'
    });
    m.append(templateWith(makeStarSvg(i%2?'#f7bd66':'#ffedb5',i%3?28:38)));
    this.map.append(m);this.stars.push(m);
   }catch(e){console.warn('Particles disabled:',e);break}
  }
  return true;
 }
 setEffects(enabled){
  this.muted=!enabled;
  // Preserve model and Ratón; toggle only optional GPU overlays.
  for(const el of [this.trace,...this.stars])try{
    if(enabled&&!el.isConnected)this.map.append(el);
    if(!enabled&&el.isConnected)el.remove();
  }catch(e){console.warn('Unable to toggle flight particles',e)}
 }
 hideNative(){
  for(const el of [this.model,this.trace,...this.stars])try{el?.remove()}catch(e){}
  this.model=null;this.trace=null;this.stars=[];
  this.modelActive=false;this.active=false;
 }
 pose(coord,bearing,progress,pointAt,t=performance.now()){
  if(!this.modelActive||!this.model)return;
  const latLng={lat:coord.lat,lng:coord.lng};
  this.model.position={...latLng,altitude:BALLOON_ALTITUDE};
  this.model.orientation={heading:bearing,tilt:0,roll:Math.sin(t/3000)*.75};
  if(!this.muted&&t-this.lastTrailAt>270){
   this.lastTrailAt=t;
   const last=this.pathTrail.at(-1);
   if(!last||geoDistance(last,latLng)>8){
    this.pathTrail.push({...latLng,altitude:BALLOON_ALTITUDE+.5});
    if(this.pathTrail.length>75)this.pathTrail.shift();
   }
   if(this.trace&&this.pathTrail.length>1)this.trace.path=this.pathTrail;
  }
  if(!this.muted&&t-this.lastStarAt>190){
   this.lastStarAt=t;
   for(let i=0;i<this.stars.length;i++){
    const lag=(i+1)*.003;
    const p=pointAt(Math.max(0,progress-lag));
    this.stars[i].position={
      ...p,altitude:BALLOON_ALTITUDE+1.3+
      Math.sin(i*1.7+t/700)*1.15
    };
   }
  }
 }
 orbit(center,phase,bearing,t=performance.now()){
  const radius=38;
  const a=phase*Math.PI*2,phi=Math.cos(center.lat*Math.PI/180);
  const p={
    lat:center.lat+radius*Math.cos(a)/METERS,
    lng:center.lng+radius*Math.sin(a)/(METERS*Math.max(phi,.15))
  };
  this.pose(p,bearing,1,()=>center,t);
  if(!this.muted&&this.stars.length){
   for(let i=0;i<this.stars.length;i++){
    const angle=a+i*2*Math.PI/this.stars.length;
    this.stars[i].position={
      lat:center.lat+(radius+16)*Math.cos(angle)/METERS,
      lng:center.lng+(radius+16)*Math.sin(angle)/(METERS*Math.max(phi,.15)),
      altitude:BALLOON_ALTITUDE+Math.sin(t/800+i)*2
    };
   }
  }
 }
 reset(){
  this.hideNative();this.pathTrail=[];this.lastTrailAt=0;this.lastStarAt=0;this.modelLoadError=false;
 }
}
