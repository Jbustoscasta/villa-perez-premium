import {enableRescue} from './rescue.mjs?v=2.0.0';
import {createCinemaCity} from './cinema-city.mjs?v=2.0.1';
import {installPOV} from './look-pnoa.mjs?v=3.0.0';
/**
 * Villa Pérez · Vuelo de cine — prototype v1.
 * Real street geometry: © OpenStreetMap contributors, through OpenFreeMap.
 * Rendering: MapLibre GL JS; preview route: public OSRM demo (non-production).
 * Geocoding: public Photon demo (non-production); local origin setting is optional.
 * Photographic imagery is NOT copied or reprocessed from Google.
 */
const $=id=>document.getElementById(id);
const B=$('app');
const START={lat:40.42016,lng:-3.68845};
const DEST={
 plaza:{label:'Plaza Mayor',lat:40.41536,lng:-3.70737},
 bernabeu:{label:'Santiago Bernabéu',lat:40.45306,lng:-3.68832},
 arroyofresno:{label:'Arroyo Fresno',lat:40.4787,lng:-3.7347}
};
const STYLE={
 dark:'https://tiles.openfreemap.org/styles/dark',
 day:'https://tiles.openfreemap.org/styles/bright'
};
const PNOA_TMS='https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{y}.jpeg';
const emptyCollection=()=>({type:'FeatureCollection',features:[]});
const point=(lng,lat,p={})=>({type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]},properties:p});
const line=coords=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}});
const EARTH=6371000;
const rad=v=>v*Math.PI/180;
const dist=(a,b)=>{
 const p1=rad(a[1]),p2=rad(b[1]),dp=rad(b[1]-a[1]),dl=rad(b[0]-a[0]);
 return 2*EARTH*Math.asin(Math.min(1,Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2)));
};
const interpolate=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const bearing=(a,b)=>{
 const lat1=rad(a[1]),lat2=rad(b[1]),dLon=rad(b[0]-a[0]);
 return (Math.atan2(Math.sin(dLon)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon))*180/Math.PI+360)%360;
};
const deltaBearing=(a,b)=>((b-a+540)%360)-180;
const ctx={
 map:null,ready:false,starting:false,mapRetry:0,loadError:'',selected:'plaza',custom:false,
 rescue:false,MarkerClass:null,rescueDelay:null,initialMap:null,
 clinic:null,clinicAddress:'',originLabel:'Origen de prueba · Puerta de Alcalá',
 origin:[START.lng,START.lat],destination:null,destinationLabel:'',
 route:[],prefix:[],cumulative:[],total:0,routeType:'panorámica',
 balloon:null,originPin:null,homePin:null,
 playing:false,paused:false,overview:false,phase:'idle',
 routeMs:0,orbitMs:0,durationMs:68000,orbitDuration:16000,
 token:0,frame:0,prevTime:0,prevPaint:0,heading:0,
 overviewTimeout:null,toasts:null,magic:true,day:false,viewIndex:-1,
 effectsReady:false,mouseAssetError:false,nightWindowTimer:null,
 city3d:null,cityStats:null,cityRefreshAt:0,cityRefreshCount:0
};
const safeText=s=>String(s||'').slice(0,120);
function toast(message,ms=3900){
 $('toast').textContent=message;$('toast').hidden=false;
 clearTimeout(ctx.toasts);ctx.toasts=setTimeout(()=>$('toast').hidden=true,ms);
}
function fail(message){
 const msg=String(message||'No se ha podido preparar el vuelo.');
 $('setupError').hidden=false;$('setupError').textContent=msg;
 $('start').disabled=false;$('start').textContent='✦ Intentar de nuevo';
 status('REVISAR CONEXIÓN');
 toast(msg,6300);
}
function status(text){$('mapStatus').textContent=text}
function fmt(num){return Math.round(clamp(num,0,1)*100)+'%'}
function select(key){
 if(!DEST[key])return;ctx.selected=key;ctx.custom=false;
 $('address').value='';document.querySelectorAll('.choice').forEach(b=>b.classList.toggle('active',b.dataset.dest===key));
}
document.querySelectorAll('[data-dest]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.dest)));
$('address').addEventListener('input',()=>{
 ctx.custom=$('address').value.trim().length>0;
 if(ctx.custom)document.querySelectorAll('.choice').forEach(b=>b.classList.remove('active'));
});
function loadClinic(){
 try{
  const saved=JSON.parse(localStorage.getItem('vp_cinema_clinic')||localStorage.getItem('vp_clinic_origin')||'null');
  if(saved?.name&&saved?.address){
   $('clinicName').value=safeText(saved.name);
   $('clinicAddress').value=safeText(saved.address);
   $('clinicSummary').textContent=safeText(saved.name);
  }
 }catch(e){}
}
function addPin(coords,label,kind='clinic'){
 const wrap=document.createElement('div');wrap.className='city-pin '+(kind==='destination'?'destination':'clinic');
 const s=document.createElement('div');s.className='city-pin-symbol';
 const icon=document.createElement('span');icon.textContent=kind==='destination'?'⌂':'✚';
 s.append(icon);
 const t=document.createElement('div');t.className='city-pin-label';t.textContent=safeText(label);
 wrap.append(s,t);
 const marker=new ctx.MarkerClass({element:wrap,anchor:'bottom',offset:[0,-6]});
 marker.setLngLat(coords).addTo(ctx.map);return marker;
}
function resetPins(){
 ctx.originPin?.remove();ctx.homePin?.remove();
 ctx.originPin=addPin(ctx.origin,ctx.originLabel);
 if(ctx.destination)ctx.homePin=addPin(ctx.destination,ctx.destinationLabel,'destination');
}
function balloonAsset(){
 if(ctx.balloon)return ctx.balloon;
 const el=$('balloonTemplate').content.firstElementChild.cloneNode(true);
 const mouse=el.querySelector('.official-mouse');
 mouse.addEventListener('error',()=>{
  ctx.mouseAssetError=true;
  console.warn('Official Ratón PNG unavailable; no substitute generated');
 });
 const m=new ctx.MarkerClass({element:el,anchor:'bottom',offset:[0,11],rotationAlignment:'viewport'});
 m.setLngLat(ctx.origin).addTo(ctx.map);
 ctx.balloon=m;
 el.style.display='none';
 return m;
}
function showBalloon(show){
 if(!ctx.balloon)return;
 ctx.balloon.getElement().style.display=show?'':'none';
}
function getSourceId(map){
 const sources=map.getStyle()?.sources||{};
 return Object.keys(sources).find(id=>sources[id]?.type==='vector')||null;
}
function addLayerSafe(layer,before){
 if(ctx.map.getLayer(layer.id))return;
 try{ctx.map.addLayer(layer,before)}catch(e){console.warn('Layer unavailable',layer.id,e)}
}
function makeFacadePattern(map,day){
 if(!map.addImage)return false;
 try{
  if(map.hasImage?.('vp-facade'))return true;
  const canvas=document.createElement('canvas');
  canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d',{willReadFrequently:true});
  if(!c)return false;
  c.fillStyle=day?'#b3aaa1':'#29384e';c.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=16){
   c.strokeStyle=day?'rgba(58,47,37,.23)':'rgba(127,152,182,.20)';
   c.beginPath();c.moveTo(0,y+.5);c.lineTo(128,y+.5);c.stroke();
  }
  for(let row=0;row<4;row++)for(let col=0;col<5;col++){
   const x=7+col*25,y=5+row*30;
   const seed=Math.sin((row+3)*13.7+(col+7)*25.5)*137.8;
   const lit=seed-Math.floor(seed)>.48;
   c.fillStyle=day?'#645a50':'#142033';c.fillRect(x-2,y-1,15,21);
   c.fillStyle=day?'#7997a0':lit?'#f4c67b':'#28415a';c.fillRect(x,y+1,11,17);
   c.fillStyle=lit&&!day?'rgba(255,246,200,.75)':'rgba(163,187,212,.4)';
   c.fillRect(x+5,y+1,1,17);c.fillRect(x,y+9,11,1);
  }
  map.addImage('vp-facade',c.getImageData(0,0,128,128));
  return true;
 }catch(e){console.warn('Facade texture not available',e);return false}
}
function enableCinemaBuildings(map,source,before){
 if(ctx.rescue||typeof map?.getCanvas!=='function'||map.getLayer('vp-cinema-city'))return;
 try{
  const city=createCinemaCity(map,{
   getRoute:()=>ctx.route,
   getSource:()=>getSourceId(ctx.map),
   onStats:stats=>{
    ctx.cityStats=stats;
    if($('cityStatus'))$('cityStatus').textContent=
      stats.real+' edificios reales + '+stats.fantasy+' de cuento';
   }
  });
  city.day=ctx.day;
  map.addLayer(city,before);
  ctx.city3d=city;
 }catch(e){console.warn('3D architectural effects unavailable',e)}
}
function mapLayerSetup(){
 const map=ctx.map;if(!map||!map.getStyle()?.sources)return;
 const source=getSourceId(map);
 const firstLabel=map.getStyle().layers?.find(l=>l.type==='symbol')?.id;
 const dark=!ctx.day;
 // Official PNOA / IGN orthophotography is captured by day. The night is an
 // artistic MapLibre grade over the real aerial imagery (never Google tiles).
 if(!map.getSource('vp-pnoa-aerial')){
  try{map.addSource('vp-pnoa-aerial',{
   type:'raster',tiles:[PNOA_TMS],tileSize:256,scheme:'tms',minzoom:0,maxzoom:19,
   attribution:'© PNOA / Instituto Geográfico Nacional (IGN) · CC BY 4.0'
  })}catch(e){console.warn('PNOA aerial unavailable:',e)}
 }
 if(map.getSource('vp-pnoa-aerial'))addLayerSafe({
  id:'vp-pnoa-photo',type:'raster',source:'vp-pnoa-aerial',
  paint:{'raster-opacity':.96,'raster-brightness-min':dark?.035:0,
   'raster-brightness-max':dark?.47:1,'raster-contrast':dark?.17:.04,
   'raster-saturation':dark?-.73:-.04}
 },firstLabel);
 if(source){
  const textured=false; // avoid identical procedural window patterns on every facade
  const buildings={
   id:'vp-buildings',type:'fill-extrusion',source,'source-layer':'building',minzoom:12,
   paint:{
    ...(textured?{'fill-extrusion-pattern':'vp-facade'}:
      {'fill-extrusion-color':dark?'#344864':'#b0a698'}),
    'fill-extrusion-height':['max',12,['to-number',['get','render_height'],18]],
    'fill-extrusion-base':['max',0,['to-number',['get','render_min_height'],0]],
    'fill-extrusion-opacity':dark?.97:.93,
    'fill-extrusion-vertical-gradient':true
   }
  };
  addLayerSafe(buildings,firstLabel);
  const roads=['motorway','trunk','primary','secondary','tertiary','residential','street','service'];
  const filter=['match',['get','class'],roads,true,false];
  // The amber lights follow the REAL OSM street network, not an image mask.
  if(dark){
   addLayerSafe({
    id:'vp-avenue-halo',type:'line',source,'source-layer':'transportation',
    filter,layout:{'line-cap':'round','line-join':'round'},
    paint:{'line-color':'#f5a34a','line-width':['interpolate',['linear'],['zoom'],12,.35,15,3.5,18,6.8],
     'line-opacity':.46,'line-blur':4.2}
   },firstLabel);
   addLayerSafe({
    id:'vp-avenue-core',type:'line',source,'source-layer':'transportation',
    filter,layout:{'line-cap':'round','line-join':'round'},
    paint:{'line-color':'#ffb864','line-width':['interpolate',['linear'],['zoom'],12,.1,15,.65,18,1.1],
     'line-opacity':.68,'line-blur':.25}
   },firstLabel);
  }
 }
 const ensure=(id,data)=>{if(!map.getSource(id))map.addSource(id,{type:'geojson',data})};
 ensure('vp-route',emptyCollection());ensure('vp-progress',emptyCollection());
 ensure('vp-glints',emptyCollection());ensure('vp-windows',emptyCollection());
 addLayerSafe({id:'vp-route-blur',type:'line',source:'vp-route',
  layout:{'line-join':'round','line-cap':'round'},
  paint:{'line-color':'#faab4e','line-width':17,'line-opacity':.69,'line-blur':7}});
 addLayerSafe({id:'vp-route-mid',type:'line',source:'vp-route',
  layout:{'line-join':'round','line-cap':'round'},
  paint:{'line-color':'#ffbb6a','line-width':7,'line-opacity':.82,'line-blur':2.3}});
 addLayerSafe({id:'vp-route-core',type:'line',source:'vp-route',
  layout:{'line-join':'round','line-cap':'round'},
  paint:{'line-color':'#ffedb0','line-width':2.8,'line-opacity':.98}});
 addLayerSafe({id:'vp-progress',type:'line',source:'vp-progress',
  layout:{'line-cap':'round','line-join':'round'},
  paint:{'line-color':'#fff9df','line-width':4.3,'line-opacity':1,'line-blur':.4}});
 addLayerSafe({id:'vp-glints-halo',type:'circle',source:'vp-glints',
  paint:{'circle-color':'#ffc76c','circle-radius':['interpolate',['linear'],['zoom'],12,2,18,8],
   'circle-opacity':.62,'circle-blur':.82}});
 addLayerSafe({id:'vp-glints-points',type:'circle',source:'vp-glints',
  paint:{'circle-color':'#fff5c7','circle-radius':['interpolate',['linear'],['zoom'],12,.8,18,2.5],
   'circle-opacity':.96,'circle-blur':.1}});
 if(dark){
  addLayerSafe({id:'vp-window-haze',type:'circle',source:'vp-windows',
   paint:{'circle-color':'#ffca6d','circle-radius':3.2,'circle-opacity':.67,'circle-blur':.82}});
  addLayerSafe({id:'vp-window-point',type:'circle',source:'vp-windows',
   paint:{'circle-color':'#ffe1a2','circle-radius':1.1,'circle-opacity':.72}});
 }
 // Disabled the geometric fantasy city: repetitive fabricated buildings were
 // misleading and looked like identical box houses. Real 3D imagery is
 // available as a separate Google photogrammetry experience.
 ctx.city3d=null;
 if($('cityStatus'))$('cityStatus').textContent='Fotografía PNOA/IGN · edificios 3D sobre calles reales';
 try{map.setLight?.({anchor:'viewport',color:dark?'#b1c5ef':'#fff0dd',intensity:dark?.68:.8,position:[1.5,205,40]})}catch(e){}
 try{map.setSky?.(dark?{'sky-color':'#08172c','horizon-color':'#344665','fog-color':'#26334d','sky-horizon-blend':.5,'horizon-fog-blend':.3,'fog-ground-blend':.1}:undefined)}catch(e){}
 ctx.effectsReady=true;
 refreshRouteLayers();scheduleWindows();
}
function setCollection(id,feature){
 if(!ctx.map)return;
 const source=ctx.map.getSource(id);
 if(source)source.setData({type:'FeatureCollection',features:feature?[feature]:[]});
}
function setPoints(id,coords){
 if(!ctx.map)return;
 const source=ctx.map.getSource(id);if(!source)return;
 source.setData({type:'FeatureCollection',features:coords.map(c=>point(c[0],c[1]))});
}
function sampleCoords(coords,count){
 if(!coords.length)return[];
 const cum=[0];for(let i=1;i<coords.length;i++)cum.push(cum.at(-1)+dist(coords[i-1],coords[i]));
 const total=cum.at(-1)||1,output=[];
 let n=0;for(let j=0;j<count;j++){
  const meters=(j+.3)/(count+.5)*total;
  while(n<coords.length-2&&cum[n+1]<meters)n++;
  const d=Math.max(.001,cum[n+1]-cum[n]);
  output.push(interpolate(coords[n],coords[n+1],clamp((meters-cum[n])/d,0,1)));
 }
 return output;
}
function refreshRouteLayers(){
 if(ctx.route.length<2)return;
 setCollection('vp-route',line(ctx.route));
 setPoints('vp-glints',ctx.magic?sampleCoords(ctx.route,Math.min(36,Math.max(8,Math.floor(ctx.total/150)))):[]);
 const t=clamp(ctx.routeMs/Math.max(1,ctx.durationMs),0,1);
 setCollection('vp-progress',line(prefixAt(t)));
}
function scheduleWindows(){
 clearTimeout(ctx.nightWindowTimer);
 if(ctx.day)return;
 ctx.nightWindowTimer=setTimeout(()=>{
  if(!ctx.map||!ctx.map.getStyle()?.sources||ctx.map.getZoom()<14.8){setPoints('vp-windows',[]);return}
  try{
   const b=ctx.map.getBounds();const source=getSourceId(ctx.map);
   const features=ctx.map.querySourceFeatures(source,{sourceLayer:'building'});
   const points=[],seen=new Set();
   for(const f of features){
    if(points.length>=220)break;
    const ring=f.geometry?.type==='Polygon'?f.geometry.coordinates[0]
      :f.geometry?.type==='MultiPolygon'?f.geometry.coordinates[0][0]:null;
    if(!ring||ring.length<4)continue;
    const center=ring.reduce((a,v)=>[a[0]+v[0]/ring.length,a[1]+v[1]/ring.length],[0,0]);
    if(!b.contains(center))continue;
    const ix=Math.floor(center[0]*100000),iy=Math.floor(center[1]*100000);
    const key=ix+','+iy;if(seen.has(key))continue;seen.add(key);
    const seed=Math.abs(Math.sin(ix*1.7+iy*2.7));
    if(seed<.55)continue;
    points.push(center);
    if(seed>.89&&ring[1])points.push(interpolate(center,ring[1],.55));
   }
   setPoints('vp-windows',points);
  }catch(e){console.warn('Window light effect unavailable',e)}
 },420);
}
function activateRescue(reason=''){
 if(ctx.rescue&&ctx.ready)return;
 console.warn('Map backup activated:',reason);
 clearTimeout(ctx.rescueDelay);
 const old=ctx.initialMap;
 ctx.rescue=true;ctx.ready=true;
 try{old?.remove?.()}catch(e){console.warn('Could not close stalled MapLibre map',e)}
 // Remove any markers created on a different engine before switching.
 try{ctx.balloon?.remove()}catch(e){}
 try{ctx.originPin?.remove()}catch(e){}
 try{ctx.homePin?.remove()}catch(e){}
 ctx.balloon=null;ctx.originPin=null;ctx.homePin=null;
 try{
  const backup=enableRescue($('map'),ctx.origin,ctx.day);
  ctx.map=backup.map;ctx.MarkerClass=backup.Marker;
  mapLayerSetup();resetPins();
  $('start').disabled=false;
  $('setupError').hidden=true;
  status('CIUDAD DE CUENTO 2,5D · DESPEGUE DISPONIBLE');
  if($('cityStatus'))$('cityStatus').textContent='Mapa de apoyo 2D · abre la vista fotográfica 3D para edificios reales';
  toast('Mapa compatible activado. Puedes comenzar el vuelo; las calles reales se cargarán si hay conexión.',4700);
 }catch(e){
  console.error('Emergency map renderer unavailable:',e);
  ctx.ready=false;
  fail('No se ha podido cargar el mapa simplificado: '+(e?.message||String(e)));
 }
}
function loadMap(){
 if(ctx.rescue||ctx.phase!=='idle')return;
 // Give the cinematic 3D engine a short chance to load before reverting
 // to the permanently functional 2.5D Safari rescue renderer.
 $('start').disabled=false;
 status('PREPARANDO EDIFICIOS 3D · PUEDES DESPEGAR');
 if(!window.maplibregl){
  if(ctx.mapRetry++<12){
   setTimeout(loadMap,220);
   return;
  }
  activateRescue('MapLibre external JS not loaded after retry');
  return;
 }
 try{
  if(!window.maplibregl.supported()){activateRescue('WebGL unsupported');return}
 }catch(e){activateRescue('MapLibre support check failed');return}
 let map;
 try{
  map=new window.maplibregl.Map({
   container:'map',style:STYLE.dark,center:[START.lng,START.lat],
   zoom:16.35,pitch:70,bearing:-28,antialias:true,
   attributionControl:false,cooperativeGestures:false,
   preserveDrawingBuffer:false,maxPitch:85
  });
 }catch(e){activateRescue('Cannot construct MapLibre map: '+String(e));return}
 map.addControl(new window.maplibregl.AttributionControl({compact:false}),'bottom-right');
 ctx.initialMap=map;ctx.map=map;ctx.MarkerClass=window.maplibregl.Marker;
 function ready(){
  if(ctx.rescue||ctx.ready)return;
  clearTimeout(ctx.rescueDelay);
  ctx.ready=true;ctx.loadError='';
  $('setupError').hidden=true;$('start').disabled=false;
  status('NOCHE DE CINE · CALLES REALES');
  try{mapLayerSetup();resetPins()}catch(e){console.warn('Optional cinema layers unavailable:',e)}
 }
 map.on('load',ready);
 map.on('style.load',()=>{
  if(ctx.rescue)return;
  if(!ctx.ready)ready();
  ctx.effectsReady=false;
  try{mapLayerSetup()}catch(e){console.warn('Map style layers skipped:',e)}
 });
 map.on('idle',()=>{if(!ctx.rescue&&!ctx.ready&&map.isStyleLoaded())ready()});
 map.on('moveend',()=>{if(!ctx.rescue)scheduleWindows()});
 map.on('sourcedata',e=>{
  // The first frame can precede real OSM footprint tiles. Upgrade the
  // fictional infill with actual 3D buildings as data arrives.
  if(ctx.rescue||!ctx.city3d||!e?.isSourceLoaded||ctx.cityRefreshCount>=6)return;
  if(e.sourceId!==getSourceId(map))return;
  const now=Date.now();
  if(now-ctx.cityRefreshAt<2800)return;
  ctx.cityRefreshAt=now;ctx.cityRefreshCount++;
  ctx.city3d.ready=false;
  map.triggerRepaint?.();
 });
 map.on('error',e=>{
  console.warn('MapLibre map loading problem:',e?.error||e);
  if(!ctx.ready)status('PROVEEDOR DE MAPAS LENTO · PUEDES DESPEGAR');
 });
 ctx.rescueDelay=setTimeout(()=>{
  if(!ctx.ready&&!ctx.rescue)activateRescue('Vector style load timed out');
 },5000);
}
async function waitForMap(){
 if(ctx.ready&&ctx.map)return;
 activateRescue('User started before map was ready');
 if(!ctx.ready)throw new Error('No se ha podido activar el motor de mapas, ni siquiera en modo compatible.');
}
async function requestJson(url,timeout=9500){
 const ctl=new AbortController(),tid=setTimeout(()=>ctl.abort(),timeout);
 try{
  const response=await fetch(url,{signal:ctl.signal,headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('HTTP '+response.status);
  return await response.json();
 }finally{clearTimeout(tid)}
}
async function lookupAddress(query){
 const text=query.trim();if(!text)throw new Error('Introduce una dirección');
 const url='https://photon.komoot.io/api/?q='+encodeURIComponent(text)+'&limit=4&lat=40.42&lon=-3.69';
 const json=await requestJson(url,4700);
 const f=json.features?.find(x=>x.geometry?.coordinates?.length===2&&x.properties?.countrycode?.toUpperCase()==='ES')
  ||json.features?.[0];
 if(!f||!f.geometry||f.geometry.coordinates.length!==2)throw new Error('No se ha encontrado la dirección. Añade calle, número y municipio.');
 const [lng,lat]=f.geometry.coordinates;
 if(!Number.isFinite(lng)||!Number.isFinite(lat))throw new Error('Coordenadas incorrectas');
 return [lng,lat];
}
async function getPositions(){
 const clinicAddress=$('clinicAddress').value.trim();
 const clinicName=$('clinicName').value.trim()||'Clínica del Doctor Abreu';
 if(clinicAddress){
  try{
   ctx.origin=await lookupAddress(clinicAddress);
   ctx.originLabel=clinicName;
   $('clinicSummary').textContent=clinicName;
   try{localStorage.setItem('vp_cinema_clinic',JSON.stringify({name:clinicName,address:clinicAddress}))}catch(e){}
  }catch(e){
   // A saved clinic must NEVER be silently placed at a false address.
   // In demo mode, make the flight work with an explicitly labelled trial origin.
   ctx.origin=[START.lng,START.lat];
   ctx.originLabel='Origen de prueba · Puerta de Alcalá';
   $('clinicSummary').textContent='Puerta de Alcalá · prueba';
   toast('No he localizado la clínica. Para esta prueba salimos de Puerta de Alcalá.',5500);
  }
 }else{
  ctx.origin=[START.lng,START.lat];
  ctx.originLabel='Origen de prueba · Puerta de Alcalá';
  $('clinicSummary').textContent='Puerta de Alcalá · prueba';
 }
 const custom=$('address').value.trim();
 if(custom){
  ctx.destination=await lookupAddress(custom);
  ctx.destinationLabel='Cerca del destino';
  ctx.custom=true;
 }else{
  const d=DEST[ctx.selected];
  ctx.destination=[d.lng,d.lat];ctx.destinationLabel=d.label;ctx.custom=false;
 }
 if(dist(ctx.origin,ctx.destination)>72000)throw new Error('Prueba destinos a menos de 72 km de Madrid.');
 if(dist(ctx.origin,ctx.destination)<70)throw new Error('El origen y el destino están demasiado cerca.');
 resetPins();
}
function truncateHome(coords,meters=170){
 const out=coords.slice();if(out.length<2)return coords;
 let remain=meters;
 for(let i=out.length-1;i>0;i--){
  const length=dist(out[i],out[i-1]);
  if(length>remain){
   return [...out.slice(0,i),interpolate(out[i-1],out[i],(length-remain)/length)];
  }
  remain-=length;
 }
 return [out[0],out[1]];
}
async function computeRoute(){
 const u='https://router.project-osrm.org/route/v1/driving/'+
  ctx.origin.join(',')+';'+ctx.destination.join(',')+
  '?geometries=geojson&overview=full&steps=false';
 try{
  const data=await requestJson(u,2600);
  const coords=data.routes?.[0]?.geometry?.coordinates;
  if(!Array.isArray(coords)||coords.length<2)throw new Error('Empty route');
  ctx.route=coords.filter(c=>c.length===2&&c.every(Number.isFinite));
  ctx.routeType='callejero real';
 }catch(e){
  console.warn('OSRM routing demo unavailable; using illustrative connecting line',e);
  // Explicitly labelled approximate: NEVER claim this connects via actual streets.
  ctx.route=[ctx.origin];
  for(let i=1;i<24;i++)ctx.route.push(interpolate(ctx.origin,ctx.destination,i/24));
  ctx.route.push(ctx.destination);
  ctx.routeType='aproximada';
 }
 if(ctx.custom)ctx.route=truncateHome(ctx.route,170);
 // Keep marker and final panorama aligned with the privacy-truncated route.
 ctx.destination=ctx.route.at(-1);
 resetPins();
 const cum=[0];
 for(let i=1;i<ctx.route.length;i++)cum.push(cum.at(-1)+Math.max(.1,dist(ctx.route[i-1],ctx.route[i])));
 ctx.cumulative=cum;ctx.total=cum.at(-1)||1;
 refreshRouteLayers();
}
function coordAt(progress){
 const p=clamp(progress,0,1),meters=p*ctx.total,cs=ctx.cumulative;
 if(p===0)return ctx.route[0];if(p===1)return ctx.route.at(-1);
 let i=0;while(i<cs.length-2&&cs[i+1]<meters)i++;
 return interpolate(ctx.route[i],ctx.route[i+1],clamp((meters-cs[i])/(cs[i+1]-cs[i]),0,1));
}
function prefixAt(progress){
 const p=clamp(progress,0,1),meters=p*ctx.total,cs=ctx.cumulative;
 let i=0;while(i<cs.length-2&&cs[i+1]<meters)i++;
 return [...ctx.route.slice(0,i+1),interpolate(ctx.route[i],ctx.route[i+1],clamp((meters-cs[i])/(cs[i+1]-cs[i]),0,1))];
}
function fullOverview(){
 if(!ctx.route.length||!ctx.map)return;
 const lons=ctx.route.map(c=>c[0]),lats=ctx.route.map(c=>c[1]);
 const bounds=[[Math.min(...lons),Math.min(...lats)],[Math.max(...lons),Math.max(...lats)]];
 const mob=innerWidth<700;
 ctx.map.fitBounds(bounds,{padding:{top:mob?180:140,bottom:mob?245:185,left:mob?38:95,right:mob?38:95},pitch:38,bearing:-12,maxZoom:16,duration:1100});
}
function setOverview(auto=false){
 cancelAnimationFrame(ctx.frame);ctx.frame=0;ctx.overview=true;
 $('overview').textContent='▶ '+(auto?'Despegar':'Continuar vuelo');
 $('overview').setAttribute('aria-pressed','true');
 $('phaseLabel').textContent='Vista general del mapa';
 $('chapterTitle').textContent='Tu ciudad desde el cielo';
 showBalloon(false);fullOverview();
 clearTimeout(ctx.overviewTimeout);
 if(auto)ctx.overviewTimeout=setTimeout(()=>{if(ctx.overview&&ctx.phase==='preview')exitOverview()},4800);
}
function exitOverview(){
 if(!ctx.overview)return;
 ctx.overview=false;clearTimeout(ctx.overviewTimeout);
 $('overview').textContent='◉ Ver ruta completa';
 $('overview').setAttribute('aria-pressed','false');
 if(ctx.phase==='preview'){
  startFlight();return;
 }
 showBalloon(true);ctx.prevTime=performance.now();ctx.prevPaint=0;
 render(ctx.phase==='route'?ctx.routeMs/ctx.durationMs:ctx.orbitMs/ctx.orbitDuration);
 if(ctx.playing&&!ctx.paused)ctx.frame=requestAnimationFrame(tick);
}
function setHUDTitle(index){
 const names=['¡Despegamos!','Por encima de los tejados','Siguiendo las luces','¿Reconoces estas calles?','Ya casi llegamos'];
 $('chapterTitle').textContent=names[clamp(index,0,names.length-1)];
}
function progress(t){
 $('progressLabel').textContent=fmt(t);
 $('progressFill').style.width=fmt(t);
}
function showGlints(progress){
 if(!ctx.magic||ctx.route.length<2)return;
 const tail=sampleCoords(prefixAt(progress),6);
 const source=ctx.map?.getSource('vp-glints');
 // Static full-route glints remain on: parents can see the complete journey.
 if(source&&tail.length)source.setData({type:'FeatureCollection',features:[
  ...sampleCoords(ctx.route,Math.min(30,Math.max(8,Math.floor(ctx.total/250)))).map(x=>point(...x)),
  ...tail.map(x=>point(...x))
 ]});
}
function render(t){
 const p=clamp(t,0,1);
 if(ctx.overview)return;
 if(ctx.phase==='route'){
  const here=coordAt(p),a=coordAt(Math.max(0,p-.002)),b=coordAt(Math.min(1,p+.003));
  const desired=bearing(a,b);
  ctx.heading=(ctx.heading+deltaBearing(ctx.heading,desired)*.13+360)%360;
  ctx.balloon?.setLngLat(here);
  // Keep the globo on screen near the center, never magnified or occluded.
  const ahead=coordAt(Math.min(1,p+.006));
  const focus=interpolate(here,ahead,.13);
  if(pov.isActive())pov.draw(here);
   else ctx.map.jumpTo({center:focus,zoom:17.0,pitch:71,bearing:ctx.heading-16});
  ctx.city3d?.setFocus?.(focus);
  $('phaseLabel').textContent='Vuelo bajo · ciudad real';
  progress(.82*p);
  setHUDTitle(Math.min(4,Math.floor(p*5)));
  if(ctx.map.getSource('vp-progress'))setCollection('vp-progress',line(prefixAt(p)));
  if(ctx.magic)showGlints(p);
 }else if(ctx.phase==='orbit'){
  const dest=ctx.destination;
  const angle=(ctx.heading+p*360)*Math.PI/180,radM=44,lat=dest[1];
  const c=[dest[0]+Math.sin(angle)*radM/(111320*Math.max(.15,Math.cos(rad(lat)))),
           dest[1]+Math.cos(angle)*radM/111320];
  ctx.balloon?.setLngLat(c);
  if(pov.isActive())pov.draw(c);
   else ctx.map.jumpTo({center:dest,pitch:71,bearing:ctx.heading+p*360,zoom:16.8});
  ctx.city3d?.setFocus?.(dest);
  const q=Math.min(3,Math.floor(p*4));
  if(q!==ctx.viewIndex){ctx.viewIndex=q;$('chapterTitle').textContent=['Sobre el destino','La ciudad desde otro ángulo','Los tejados de cerca','Última panorámica'][q]}
  $('phaseLabel').textContent='Panorámica '+(q+1)+' de 4';
  progress(.82+.18*p);
 }
}
function tick(now){
 ctx.frame=0;if(!ctx.playing||ctx.paused||ctx.overview)return;
 const d=Math.min(90,Math.max(0,now-ctx.prevTime));ctx.prevTime=now;
 if(ctx.phase==='route'){
  ctx.routeMs=Math.min(ctx.durationMs,ctx.routeMs+d);
  if(ctx.routeMs>=ctx.durationMs){
   ctx.phase='orbit';ctx.orbitMs=0;ctx.viewIndex=-1;
   render(0);
  }else if(now-ctx.prevPaint>=55){
   ctx.prevPaint=now;render(ctx.routeMs/ctx.durationMs);
  }
 }else if(ctx.phase==='orbit'){
  ctx.orbitMs=Math.min(ctx.orbitDuration,ctx.orbitMs+d);
  if(ctx.orbitMs>=ctx.orbitDuration){render(1);finish();return}
  if(now-ctx.prevPaint>=55){ctx.prevPaint=now;render(ctx.orbitMs/ctx.orbitDuration)}
 }
 if(ctx.playing&&!ctx.paused)ctx.frame=requestAnimationFrame(tick);
}
function startFlight(){
 ctx.phase='route';ctx.playing=true;ctx.paused=false;ctx.routeMs=0;ctx.orbitMs=0;ctx.viewIndex=-1;
 ctx.durationMs=clamp(ctx.total/36*1000,35000,92000);
 ctx.orbitDuration=15500;
 ctx.heading=bearing(ctx.route[0],ctx.route[Math.min(8,ctx.route.length-1)]);
 ctx.balloon?.setLngLat(ctx.origin);showBalloon(true);
 $('pause').textContent='Ⅱ Pausar';$('phaseLabel').textContent='Comienza el vuelo';
 ctx.prevTime=performance.now();ctx.prevPaint=0;
 render(0);
 ctx.frame=requestAnimationFrame(tick);
}
async function start(){
 if(ctx.phase!=='idle'||ctx.starting)return;
 ctx.starting=true;ctx.token++;
 status('PREPARANDO DESPEGUE');
 const btn=$('start');btn.disabled=true;btn.textContent='Preparando el vuelo…';
 $('setupError').hidden=true;
 try{
  await waitForMap();
  btn.textContent='Localizando origen y destino…';
  await getPositions();
  btn.textContent='Dibujando las calles…';
  await computeRoute();
  btn.textContent='Despegando…';
  balloonAsset();resetPins();
  $('setup').classList.add('leaving');$('flightInterface').hidden=false;
  $('arrival').hidden=true;
  $('fromLabel').textContent=safeText(ctx.originLabel).toUpperCase();
  $('routeType').textContent=ctx.rescue
   ?(ctx.routeType==='callejero real'?'CALLES REALES · MAPA COMPATIBLE':'RUTA APROXIMADA · MAPA COMPATIBLE')
   :(ctx.routeType==='callejero real'?'CALLES REALES · EDIFICIOS SIMPLIFICADOS':'RUTA APROXIMADA · MAPA ILUSTRADO');
  status(ctx.rescue?'MODO COMPATIBLE · RUTA ANIMADA':(ctx.day?'RECORRIDO REAL · DÍA':'NOCHE DE CINE · CALLES REALES'));
  ctx.phase='preview';ctx.playing=true;
  progress(0);setOverview(true);
 }catch(e){
  console.warn('Cannot start Villa Pérez flight',e);
  fail(e?.message||'No se ha podido preparar la ruta');
 }finally{
  ctx.starting=false;btn.disabled=false;
  if(ctx.phase==='idle'&&$('setupError').hidden)btn.textContent='✦ Comenzar vuelo mágico';
 }
}
function pause(){
 if(!ctx.playing||ctx.overview)return;
 if(!ctx.paused){ctx.paused=true;cancelAnimationFrame(ctx.frame);ctx.frame=0;$('pause').textContent='▶ Continuar';$('phaseLabel').textContent='Vuelo en pausa'}
 else{ctx.paused=false;ctx.prevTime=performance.now();ctx.prevPaint=0;$('pause').textContent='Ⅱ Pausar';ctx.frame=requestAnimationFrame(tick)}
}
function finish(){
 cancelAnimationFrame(ctx.frame);ctx.frame=0;ctx.phase='done';ctx.playing=false;
 pov.exit();showBalloon(false);progress(1);
 $('flightInterface').hidden=true;$('arrival').hidden=false;status('MISIÓN COMPLETADA');
}
function restart(){
 pov.exit();
 clearTimeout(ctx.overviewTimeout);clearTimeout(ctx.nightWindowTimer);
 cancelAnimationFrame(ctx.frame);ctx.frame=0;
 ctx.phase='idle';ctx.playing=false;ctx.paused=false;ctx.overview=false;
 ctx.routeMs=0;ctx.orbitMs=0;ctx.viewIndex=-1;ctx.destination=null;
 ctx.route=[];ctx.prefix=[];ctx.cumulative=[];ctx.total=0;
 ctx.city3d?.setFocus?.([START.lng,START.lat]);
 showBalloon(false);ctx.homePin?.remove();ctx.homePin=null;
 ctx.origin=[START.lng,START.lat];
 if(ctx.map){ctx.map.easeTo({center:ctx.origin,zoom:14.5,pitch:58,bearing:-27,duration:650})}
 $('setup').classList.remove('leaving');$('start').textContent='✦ Comenzar vuelo mágico';
 $('flightInterface').hidden=true;$('arrival').hidden=true;
 $('overview').textContent='◉ Ver ruta completa';
 $('setupError').hidden=true;
 setCollection('vp-route',null);setCollection('vp-progress',null);setPoints('vp-glints',[]);
 status(ctx.day?'CIUDAD REAL · DÍA':'NOCHE DE CINE · CALLES REALES');
}
function setStyle(day){
 ctx.day=day;document.body.classList.toggle('day',day);
 $('night').textContent=day?'☾ Ver noche':'☀ Ver día';
 status(day?'CALLES REALES · DÍA':'NOCHE DE CINE · CALLES REALES');
 ctx.city3d?.setDay?.(day);
 const map=ctx.map;if(!map)return;
 map.setStyle(day?STYLE.day:STYLE.dark);
 if(ctx.rescue)mapLayerSetup();
 toast(day?'Fotografía aérea PNOA a plena luz.':'PNOA/IGN: iluminación nocturna artística sobre fotografía real.');
}
function toggleMagic(){
 ctx.magic=!ctx.magic;
 $('magic').textContent=ctx.magic?'✧ Magia ON':'✧ Magia OFF';
 const source=ctx.map?.getSource('vp-glints');
 if(source)ctx.magic?refreshRouteLayers():setPoints('vp-glints',[]);
}
const pov=installPOV({
 ctx,$,
 position:()=>{
  if(ctx.phase==='route')return coordAt(clamp(ctx.routeMs/Math.max(1,ctx.durationMs),0,1));
  if(ctx.phase==='orbit'){
   const p=clamp(ctx.orbitMs/Math.max(1,ctx.orbitDuration),0,1),dest=ctx.destination;
   const angle=(ctx.heading+p*360)*Math.PI/180,radM=44;
   return [dest[0]+Math.sin(angle)*radM/(111320*Math.max(.15,Math.cos(rad(dest[1])))),
     dest[1]+Math.cos(angle)*radM/111320];
  }
  return ctx.origin;
 },
 heading:()=>ctx.heading,
 paused:()=>ctx.paused,
 renderNormal:()=>{
  if(ctx.map&&ctx.playing&&!ctx.overview&&['route','orbit'].includes(ctx.phase)){
   render(ctx.phase==='route'?ctx.routeMs/ctx.durationMs:ctx.orbitMs/ctx.orbitDuration);
  }
 },
 notify:toast
});

$('start').addEventListener('click',start);
$('pause').addEventListener('click',pause);
$('restart').addEventListener('click',restart);
$('flyAgain').addEventListener('click',restart);
$('overview').addEventListener('click',()=>{
 if(!ctx.playing)return;
 if(ctx.overview)exitOverview();else setOverview(false);
});
$('night').addEventListener('click',()=>setStyle(!ctx.day));
$('magic').addEventListener('click',toggleMagic);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&ctx.playing&&!ctx.paused&&!ctx.overview)pause();
});
// Robust, immediate interaction: the user can launch before map assets arrive.
$('start').disabled=false;
loadClinic();select('plaza');loadMap();
