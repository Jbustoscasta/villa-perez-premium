import {createArchitecture3D} from './architecture-v2.mjs?v=2.0.0';
import {createMagicAtmosphere} from './magic-atmosphere-v2.mjs?v=2.0.0';

/* Villa Pérez · Vuelo real mágico v1
 * Real aerial tiles PNOA/IGN and REAL OSM building footprints.
 * No houses or streets are invented. Architectural detailing is an artistic interpretation.
 * Public OSRM / Photon endpoints are for demonstration, not commercial SLA.
 */
const $=id=>document.getElementById(id);
const ORIGIN=[-3.68845,40.42016]; // Puerta de Alcalá, explicitly a demo origin
const DEST={
 plaza:{name:'Plaza Mayor',coords:[-3.70737,40.41536]},
 bernabeu:{name:'Santiago Bernabéu',coords:[-3.68832,40.45306]},
 arroyofresno:{name:'Arroyo Fresno',coords:[-3.7347,40.4787]}
};
const PNOA='https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{y}.jpeg';
const MAP_STYLE={night:'https://tiles.openfreemap.org/styles/dark',day:'https://tiles.openfreemap.org/styles/bright'};
/* In-browser fallback: real PNOA raster and OSM vector buildings,
   no synthetic architecture, even if the provider's style JSON fails. */
function local3DStyle(isDay=false){
 return {version:8,name:'Villa Pérez · 3D real (VersaTiles)',
  sources:{
   openmaptiles:{type:'vector',url:'https://tiles.versatiles.org/tiles/osm/tiles.json'},
   'magic-pnoa':{type:'raster',tiles:[PNOA],tileSize:256,scheme:'tms',maxzoom:19,
    attribution:'PNOA © Instituto Geográfico Nacional · CC BY 4.0 scne.es · © OpenStreetMap contributors'}
  },
  layers:[
   {id:'vp-base',type:'background',paint:{'background-color':isDay?'#7d939b':'#08192d'}},
   {id:'magic-pnoa-photo',type:'raster',source:'magic-pnoa',paint:{
    'raster-opacity':.98,'raster-brightness-min':isDay?0:.025,
    'raster-brightness-max':isDay?1:.48,'raster-contrast':isDay?.03:.16,
    'raster-saturation':isDay?0:-.7
   }}
  ]};
}
const rad=d=>d*Math.PI/180;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const lerpCoord=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
const EARTH=6371000;
function distance(a,b){
 const p=rad(a[1]),q=rad(b[1]),dl=rad(b[0]-a[0]),dp=q-p;
 return 2*EARTH*Math.asin(Math.min(1,Math.sqrt(Math.sin(dp/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2)));
}
function heading(a,b){
 const p=rad(a[1]),q=rad(b[1]),d=rad(b[0]-a[0]);
 return (Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))*180/Math.PI+360)%360;
}
const deltaAngle=(a,b)=>((b-a+540)%360)-180;
const empty=()=>({type:'FeatureCollection',features:[]});
const point=p=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:p}});
const geoLine=coords=>({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}]});
let chosen='plaza',map=null,city=null,styleLoaded=false,styleVersion=0,rooftops=[],windowTimer=0,toastTimer=0,ready=false,cityTilesRefresh=0,cityRefreshAt=0,styleWatchdog=0,styleFallback=false,cityLampTimer=0,buildingCheckTimer=0;
let day=false,magic=true,playing=false,paused=false,overview=false,pov=false,phase='idle',mode='Ruta por calles',frame=0,lastFrame=0,elapsed=0,duration=68000,orbitTime=0,progress=0,currentHeading=280;
let origin=[...ORIGIN],originName='Puerta de Alcalá · demo',destination=[...DEST.plaza.coords],destinationName=DEST.plaza.name,route=[],lengths=[],routeLength=0,privacyClipped=false;
const message=(s,ms=3400)=>{clearTimeout(toastTimer);$('message').textContent=s;$('message').hidden=false;toastTimer=setTimeout(()=>$('message').hidden=true,ms)};
const status=s=>$('status').textContent=s;

const fx=createMagicAtmosphere({
 canvas:$('magicCanvas'),
 getBalloon:()=>$('balloon'),
 getRoofs:()=>[], // rooftop stars are now placed at roof altitude in WebGL
 getMap:()=>map,
 getFlying:()=>playing&&!paused&&!overview&&!pov&&['route','orbit'].includes(phase)
});
function currentVectorSource(){
 if(!map?.getStyle)return null;
 const s=map.getStyle().sources||{};
 return Object.keys(s).find(k=>s[k].type==='vector')||null;
}
function buildingSourceLayer(){return styleFallback?'buildings':'building'}
function streetsSourceLayer(){return styleFallback?'streets':'transportation'}
function safeLayer(config,before){
 if(map.getLayer(config.id))return true;
 try{map.addLayer(config,before);return true}catch(e){console.warn('Optional map layer skipped',config.id,e);return false}
}
function cityHeight(){
 // Vector data are generated from real buildings; use measured height if present.
 // When absent, use declared levels. Otherwise display a neutral estimated volume.
 return ['let','h',['to-number',['coalesce',['get','render_height'],['get','height']],0],
  'levels',['to-number',['coalesce',['get','building:levels'],['get','levels']],0],
  ['case',['>', ['var','h'],2],['var','h'],['>', ['var','levels'],0],['*',3.2,['var','levels']],16]];
}
function addMapFeatures(){
 if(!map||!map.getStyle()?.sources)return;
 const vec=currentVectorSource(),s=map.getStyle(),firstSymbol=s.layers?.find(l=>l.type==='symbol')?.id;
 const dark=!day,ver=++styleVersion;
 cityTilesRefresh=0;cityRefreshAt=0;
 // Real PNOA aerials always remain the ground. Darkness is artistic color grading.
 if(!map.getSource('magic-pnoa'))map.addSource('magic-pnoa',{type:'raster',tiles:[PNOA],tileSize:256,scheme:'tms',maxzoom:19,
 attribution:'PNOA © Instituto Geográfico Nacional · CC BY 4.0 scne.es'});
 safeLayer({id:'magic-pnoa-photo',type:'raster',source:'magic-pnoa',paint:{
  'raster-opacity':dark?.96:.98,'raster-brightness-min':dark?.046:0,
  'raster-brightness-max':dark?.58:1,'raster-contrast':dark?.14:.03,'raster-saturation':dark?-.57:-.03
 }},firstSymbol);
 // Stable 3D geometry source independent of the decorative vector style.
 // This is the official OpenFreeMap source used by MapLibre's 3D building example.
 if(!map.getSource('vp-3d-buildings'))map.addSource('vp-3d-buildings',{
  type:'vector',url:'https://tiles.openfreemap.org/planet',
  attribution:'© OpenStreetMap contributors / OpenFreeMap'
 });
 if(vec){
  safeLayer({id:'magic-real-buildings',type:'fill-extrusion',source:'vp-3d-buildings','source-layer':'building',minzoom:13,
   paint:{
    'fill-extrusion-color':dark?['interpolate',['linear'],cityHeight(),2,'#61728a',16,'#6f819b',35,'#7589a3',60,'#879bb5']:
     ['interpolate',['linear'],cityHeight(),2,'#aaa99f',16,'#b6b0a6',35,'#a5a5a2',60,'#a3a9ac'],
    'fill-extrusion-height':cityHeight(),
    'fill-extrusion-base':['max',0,['to-number',['get','render_min_height'],0]],
    'fill-extrusion-opacity':1,
    'fill-extrusion-vertical-gradient':true
   }},firstSymbol);
   // Real footprint cap: a slate / copper / terracotta accent, 40 cm thick.
   safeLayer({id:'magic-real-roof-caps',type:'fill-extrusion',source:'vp-3d-buildings',
    'source-layer':'building',minzoom:14,
    paint:{
     'fill-extrusion-color':dark?
      ['match',['to-string',['coalesce',['get','roof:colour'],['get','roof:color'],'']],
       'red','#77525d','terracotta','#855d57','green','#466e69','blue','#4c6683','#63718a']:
      '#beb9af',
     'fill-extrusion-base':['max',0,['-',cityHeight(),.40]],
     'fill-extrusion-height':['+',cityHeight(),.20],
     'fill-extrusion-opacity':dark?.83:.58,
     'fill-extrusion-vertical-gradient':false
    }},firstSymbol);
   // Golden road light follows the actual OSM transportation geometry.
  if(dark){
   const roads=['motorway','trunk','primary','secondary','tertiary','residential','street','service'];
   const filter=['match',['get','class'],roads,true,false];
   safeLayer({id:'magic-street-halo',type:'line',source:vec,'source-layer':streetsSourceLayer(),filter,
    layout:{'line-join':'round','line-cap':'round'},
    paint:{'line-color':'#e0a05d','line-width':['interpolate',['linear'],['zoom'],12,.2,16,3.0,18,6],
     'line-opacity':.32,'line-blur':5}},firstSymbol);
   safeLayer({id:'magic-street-light',type:'line',source:vec,'source-layer':streetsSourceLayer(),filter,
    layout:{'line-join':'round','line-cap':'round'},
    paint:{'line-color':'#f7c98a','line-width':['interpolate',['linear'],['zoom'],12,.1,16,.7,18,1.25],
     'line-opacity':.66,'line-blur':.35}},firstSymbol);
  }
   // Decorative geometry anchored strictly to actual OSM building footprints.
   // Delayed so MapLibre can paint the real aerial base first on iPhone.
   clearTimeout(cityLampTimer);
   if(dark)cityLampTimer=setTimeout(()=>{
    if(!map||day||map.getLayer('vp-architecture-v2')||!map.getLayer('magic-real-buildings'))return;
    let features=[];try{features=map.querySourceFeatures('vp-3d-buildings',{sourceLayer:'building'})||[]}catch(e){}
    if(!features.length)return; // Asynchronous vector tiles are not ready yet.
    try{
     const architecture=createArchitecture3D(map,{
      getSource:()=>map?.getSource('vp-3d-buildings')?'vp-3d-buildings':null,
      getSourceLayer:()=> 'building',
      onStats:info=>{
       if(info.real>0&&phase==='idle')status('CIUDAD REAL · ARQUITECTURA MÁGICA 3D');
      }
     });
     architecture.active=magic;
     map.addLayer(architecture,map.getStyle()?.layers?.find(l=>l.type==='symbol')?.id);
     city=architecture;
    }catch(e){console.warn('Optional architecture unavailable; the real 3D buildings remain',e);city=null}
   },1150);
 }
 for(const name of ['magic-route','magic-done','magic-sparks','magic-roofs']){
  if(!map.getSource(name))map.addSource(name,{type:'geojson',data:empty()});
 }
  // Rooftop lanterns are now positioned in 3D at real building heights.
 safeLayer({id:'magic-route-glow',type:'line',source:'magic-route',
  layout:{'line-cap':'round','line-join':'round'},
  paint:{'line-color':'#a570e6','line-width':9,'line-blur':5,'line-opacity':.72}},firstSymbol);
 safeLayer({id:'magic-route-core',type:'line',source:'magic-route',
  layout:{'line-cap':'round','line-join':'round'},
  paint:{'line-color':'#e8b2f6','line-width':3.3,'line-opacity':.93}},firstSymbol);
 safeLayer({id:'magic-route-traveled',type:'line',source:'magic-done',
  layout:{'line-cap':'round','line-join':'round'},
  paint:{'line-color':'#fff0bd','line-width':3.6,'line-blur':.3,'line-opacity':.95}},firstSymbol);
 safeLayer({id:'magic-spark-halo',type:'circle',source:'magic-sparks',
  paint:{'circle-color':'#f9cc86','circle-radius':6,'circle-blur':.85,'circle-opacity':.60}},firstSymbol);
 safeLayer({id:'magic-spark-core',type:'circle',source:'magic-sparks',
  paint:{'circle-color':'#fff8cc','circle-radius':1.6,'circle-blur':.2,'circle-opacity':.92}},firstSymbol);
 try{map.setLight?.({anchor:'viewport',color:dark?'#afc5ed':'#fff3dd',intensity:dark?.7:.85,position:[1.3,195,45]})}catch(e){}
 try{if(dark)map.setSky?.({'sky-color':'#091930','horizon-color':'#233951','fog-color':'#1c2c47','sky-horizon-blend':.5,'horizon-fog-blend':.2,'fog-ground-blend':.12})}catch(e){}
 // Ensure real 3D sits above aerial rasters and vector fills, even if
  // some styles insert opaque layers above the first label layer.
  for(const id of ['magic-real-buildings','magic-real-roof-caps']){
   if(map.getLayer(id))try{map.moveLayer(id)}catch(e){console.warn('3D priority layer failed',id,e)}
  }
  // Avoid rendering intrusive street labels on top of cinematic rooftops.
  // Map attributions remain untouched.
  for(const layer of map.getStyle()?.layers||[]){
   if(layer.type!=='symbol')continue;
   if(/road.*label|road.*name|street.*label|street.*name|poi.*label/i.test(layer.id)){
    try{map.setLayoutProperty(layer.id,'visibility',dark?'none':'visible')}catch(e){}
   }
  }
  if(ver===styleVersion){updateLayers();scheduleWindows()}
 fx.setActive(dark&&magic);
  city?.setMagic?.(magic);
 status(dark?'EDIFICIOS 3D · CAPAS ACTIVAS':'FOTOGRAFÍA REAL · DÍA');
}
function setSource(id,data){
 const s=map?.getSource(id);
 if(s)try{s.setData(data)}catch(e){}
}
function setPoints(id,coords){setSource(id,{type:'FeatureCollection',features:coords.map(point)})}
function updateLayers(){
 if(!map||!route.length)return;
 setSource('magic-route',geoLine(route));
 setSource('magic-done',geoLine(prefix(progress)));
 setPoints('magic-sparks',magic?sample(route,Math.min(34,Math.max(6,Math.round(routeLength/220)))):[]);
}
function scheduleWindows(){
 clearTimeout(windowTimer);
 if(day||!magic||!map)return;
 windowTimer=setTimeout(()=>{
  if(!map||!map.getStyle()?.sources||map.getZoom()<14.3){rooftops=[];setPoints('magic-roofs',[]);return}
  const vec=currentVectorSource();if(!vec)return;
  try{
   const features=map.querySourceFeatures(vec,{sourceLayer:buildingSourceLayer()});
   const roofs=[],seen=new Set(),bounds=map.getBounds();
   for(const f of features){
    if(roofs.length>=42)break;
    const ring=f.geometry?.type==='Polygon'?f.geometry.coordinates[0]:
     f.geometry?.type==='MultiPolygon'?f.geometry.coordinates[0][0]:null;
    if(!ring||ring.length<4)continue;
    const center=ring.reduce((a,c)=>[a[0]+c[0]/ring.length,a[1]+c[1]/ring.length],[0,0]);
    if(!bounds.contains(center))continue;
    const key=Math.floor(center[0]*9e4)+':'+Math.floor(center[1]*9e4);
    if(seen.has(key))continue;seen.add(key);
    if(Math.abs(Math.sin(center[0]*4563+center[1]*6879))>.76)roofs.push(center);
   }
   rooftops=roofs;setPoints('magic-roofs',roofs);
  }catch(e){console.warn('Rooftop lights optional',e)}
 },550);
}
async function ensureMapLibre(){
 if(window.maplibregl)return true;
 const begun=Date.now();
 while(!window.maplibregl&&Date.now()-begun<3500)await new Promise(r=>setTimeout(r,100));
 if(window.maplibregl)return true;
 status('RECUPERANDO MOTOR 3D');
 await new Promise(resolve=>{
  const script=document.createElement('script');script.async=true;
  script.src='https://unpkg.com/maplibre-gl@5.7.0/dist/maplibre-gl.js';
  let done=false;const complete=()=>{if(done)return;done=true;resolve()};
  script.onload=complete;script.onerror=complete;
  document.head.appendChild(script);setTimeout(complete,7000);
 });
 return Boolean(window.maplibregl);
}
function showMapError(info){
 status('MAPA 3D NO DISPONIBLE');
 $('error').textContent=info;$('error').hidden=false;
 $('launch').disabled=true;
}
function check3DData(){
 clearTimeout(buildingCheckTimer);
 buildingCheckTimer=setTimeout(()=>{
  if(!map||!ready||day)return;
  let count=0;
  try{count=(map.querySourceFeatures('vp-3d-buildings',{sourceLayer:'building'})||[]).length}catch(e){}
  if(count===0){
   if(!styleFallback){
    status('ESPERANDO DATOS DE EDIFICIOS');
    message('La fotografía ha cargado, pero los edificios 3D siguen descargándose. Mantengo el mapa sin sustituirlo.',5200);
    if(!map.getLayer('magic-real-buildings'))try{addMapFeatures()}catch(e){}
   }else{
    status('NO SE RECIBEN EDIFICIOS 3D');
    $('error').textContent='La fotografía puede estar disponible, pero no han llegado los datos 3D. No se sustituirán por edificios planos. Prueba de nuevo con Safari y conexión estable.';
    $('error').hidden=false;
    message('El proveedor alternativo tampoco ha entregado edificios 3D. Comprueba Internet y vuelve a intentarlo.',9000);
   }
  }
 },9200);
}
function armStyleWatchdog(){
 clearTimeout(styleWatchdog);
 styleWatchdog=setTimeout(()=>{
  if(ready)return;
  if(!styleFallback){
   styleFallback=true;
   status('RECUPERANDO MAPA 3D');
   message('El proveedor original no respondió; probando fotografía PNOA y edificios reales con VersaTiles.',4600);
   try{map?.setStyle(local3DStyle(day));armStyleWatchdog()}
   catch(e){showMapError('No se pudo recuperar el mapa: '+String(e?.message||e))}
  }else{
   showMapError('El mapa 3D no responde. Ábrelo en Safari directamente, fuera del navegador integrado de otra app.');
  }
 },9500);
}
async function initMap(){
 status('CONECTANDO CARTOGRAFÍA 3D');
 if(!await ensureMapLibre()){
  showMapError('El motor MapLibre 3D no se ha descargado desde ninguno de los servidores. Comprueba la conexión.');
  return;
 }
 // MapLibre GL JS 5.x may not expose the old supported() API.
 // Validate the constructor and let MapLibre initialize WebGL itself.
 if(typeof window.maplibregl.Map!=='function'){
  showMapError('Se ha descargado el motor de mapas, pero no ofrece un constructor 3D válido.');
  return;
 }
 try{
  map=new window.maplibregl.Map({
   container:'map',style:MAP_STYLE.night,center:ORIGIN,zoom:17.0,pitch:74,bearing:-24,
   maxPitch:85,antialias:false,attributionControl:true,cooperativeGestures:false,
   preserveDrawingBuffer:false,renderWorldCopies:false
  });
  const onStyleReady=()=>{
   ready=true;styleLoaded=true;
   clearTimeout(styleWatchdog);$('error').hidden=true;$('launch').disabled=false;
   status('INICIANDO EDIFICIOS 3D');
   setTimeout(()=>{
    try{addMapFeatures();map?.resize()}
    catch(e){console.warn('Some optional map layers unavailable',e);
     message('Mapa activo, pero una capa no se ha cargado: '+String(e?.message||e),4700)}
    check3DData();
   },170);
  };
  map.on('style.load',onStyleReady);
  map.on('load',()=>{if(!ready)onStyleReady()});
  map.on('moveend',scheduleWindows);
  map.on('sourcedata',e=>{
   if(e.sourceId!=='vp-3d-buildings'||!e.isSourceLoaded)return;
   const now=Date.now();
   if(!city&&!day&&map.getLayer('magic-real-buildings')){
    clearTimeout(cityLampTimer);
    cityLampTimer=setTimeout(()=>{
     if(city||day||!map?.getLayer('magic-real-buildings'))return;
     let fs=[];try{fs=map.querySourceFeatures('vp-3d-buildings',{sourceLayer:'building'})||[]}catch(e){}
     if(!fs.length)return;
     try{
      const layer=createArchitecture3D(map,{
       getSource:()=>map?.getSource('vp-3d-buildings')?'vp-3d-buildings':null,
       getSourceLayer:()=> 'building',
       onStats:info=>{if(info.real>0&&phase==='idle')status('EDIFICIOS REALES · FACHADAS MÁGICAS')}
      });
      layer.active=magic;map.addLayer(layer);city=layer;
     }catch(e){console.warn('Decorative 3D shader optional',e)}
    },600);
   }
   if(city&&cityTilesRefresh<10&&now-cityRefreshAt>1700){
    cityRefreshAt=now;cityTilesRefresh++;city.ready=false;map.triggerRepaint?.();
   }
  });
  map.on('error',e=>{
   const error=String(e?.error?.message||e?.error||e||'unknown');
   console.warn('MapLibre loading error:',error);
   if(!ready&&/Failed|403|404|CORS|network|timeout/i.test(error))
    status('PROVEEDOR DE MAPAS LENTO');
  });
  map.on('webglcontextlost',()=>{
   status('GRÁFICOS 3D INTERRUMPIDOS');
   message('Safari ha interrumpido WebGL. Recarga la página.',7600);
  });
  window.addEventListener('resize',()=>map?.resize(),{passive:true});
  armStyleWatchdog();
 }catch(e){showMapError('No se pudo iniciar la vista 3D: '+String(e?.message||e))}
}
function buildDistances(){
 lengths=[0];for(let i=1;i<route.length;i++)lengths.push(lengths.at(-1)+distance(route[i-1],route[i]));
 routeLength=lengths.at(-1)||1;
}
function coordAt(t){
 if(!route.length)return origin;
 const m=clamp(t,0,1)*routeLength;
 let i=0;while(i<lengths.length-2&&lengths[i+1]<m)i++;
 const denom=Math.max(0.001,lengths[i+1]-lengths[i]);
 return lerpCoord(route[i],route[i+1],clamp((m-lengths[i])/denom,0,1));
}
function prefix(t){
 if(route.length<2)return[];
 const m=clamp(t,0,1)*routeLength;
 let i=0;while(i<lengths.length-2&&lengths[i+1]<m)i++;
 const denom=Math.max(0.001,lengths[i+1]-lengths[i]);
 return [...route.slice(0,i+1),lerpCoord(route[i],route[i+1],clamp((m-lengths[i])/denom,0,1))];
}
function sample(cs,num){
 if(cs.length<2)return[];
 const d=[0];for(let i=1;i<cs.length;i++)d.push(d.at(-1)+distance(cs[i-1],cs[i]));
 const total=d.at(-1)||1,output=[];let i=0;
 for(let j=0;j<num;j++){
  const m=(j+.35)/(num+.6)*total;
  while(i<cs.length-2&&d[i+1]<m)i++;
  output.push(lerpCoord(cs[i],cs[i+1],clamp((m-d[i])/Math.max(.001,d[i+1]-d[i]),0,1)));
 }
 return output;
}
function shortenHome(cs,meters=180){
 const c=cs.slice(),d=[0];for(let i=1;i<c.length;i++)d.push(d.at(-1)+distance(c[i-1],c[i]));
 if(d.at(-1)<=meters+120){
  // Short flights must not show the exact entrance either.
  const total=d.at(-1),keep=Math.max(0.01,total-meters);
  let i=0;while(i<d.length-2&&d[i+1]<keep)i++;
  const t=clamp((keep-d[i])/Math.max(.001,d[i+1]-d[i]),0,1);
  return [...c.slice(0,i+1),lerpCoord(c[i],c[i+1],t)];
 }
 let j=c.length-1;while(j>1&&d.at(-1)-d[j-1]<meters)j--;
 const pos=d.at(-1)-meters,den=Math.max(.001,d[j]-d[j-1]);
 return [...c.slice(0,j),lerpCoord(c[j-1],c[j],clamp((pos-d[j-1])/den,0,1))];
}
async function requestJSON(url,timeout=12000){
 const ctrl=new AbortController(),id=setTimeout(()=>ctrl.abort(),timeout);
 try{const r=await fetch(url,{signal:ctrl.signal,headers:{'Accept':'application/json'}});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}
 finally{clearTimeout(id)}
}
async function geocode(address){
 const q=address.trim();if(q.length<5)throw Error('Introduce una dirección más completa.');
 const url='https://photon.komoot.io/api/?limit=5&lang=es&lat=40.42&lon=-3.70&q='+encodeURIComponent(q);
 const data=await requestJSON(url,14000);
 if(!data.features?.length)throw Error('No se ha encontrado esa dirección. Añade localidad y número.');
 const f=data.features[0],c=f.geometry.coordinates;
 return {coords:[c[0],c[1]],name:[f.properties.name,f.properties.city||f.properties.county].filter(Boolean).join(', ')||q};
}
async function calculateRoute(){
 const url='https://router.project-osrm.org/route/v1/driving/'+origin.join(',')+';'+destination.join(',')+'?overview=full&geometries=geojson&steps=false';
 try{
  const data=await requestJSON(url,15000),coords=data.routes?.[0]?.geometry?.coordinates;
  if(!Array.isArray(coords)||coords.length<2)throw Error('Ruta vacía');
  route=coords.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  mode='Ruta real por calles';
 }catch(e){
  console.warn('OSRM demo offline: clearly labeled approximate line',e);
  mode='Recorrido panorámico aproximado (sin ruta vial calculada)';
  route=[origin,destination];
  message('El servicio de rutas está limitado: se mostrará una conexión panorámica aproximada.',6000);
 }
 privacyClipped=!!$('destination').value.trim();
 if(privacyClipped){route=shortenHome(route,180);destination=[...route.at(-1)]}
 buildDistances();
}
function drawMini(t=0){
 const canvas=$('miniRoute'),g=canvas.getContext('2d');if(!g)return;
 const W=canvas.width,H=canvas.height;g.clearRect(0,0,W,H);
 g.fillStyle='#273e5c';g.fillRect(0,0,W,H);
 g.strokeStyle='rgba(148,171,196,.24)';g.lineWidth=1;
 for(let i=0;i<20;i++){const x=((i*47)%280)-10;g.beginPath();g.moveTo(x,0);g.lineTo(x+58,H);g.stroke()}
 if(route.length<2)return;
 const xs=route.map(p=>p[0]),ys=route.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const rangeX=Math.max(.001,maxX-minX),rangeY=Math.max(.001,maxY-minY);
 const scale=Math.min((W-38)/rangeX,(H-36)/rangeY);
 const p=c=>[(c[0]-(minX+maxX)/2)*scale+W/2,((minY+maxY)/2-c[1])*scale+H/2];
 g.beginPath();route.forEach((c,i)=>{const [x,y]=p(c);if(i===0)g.moveTo(x,y);else g.lineTo(x,y)});
 g.lineWidth=4;g.lineCap='round';g.lineJoin='round';g.strokeStyle='#e8c785';g.shadowColor='#f7e4a3';g.shadowBlur=6;g.stroke();g.shadowBlur=0;
 const [x,y]=p(coordAt(t));g.beginPath();g.arc(x,y,6,0,Math.PI*2);g.fillStyle='#fff0b3';g.fill();g.lineWidth=2;g.strokeStyle='#745b39';g.stroke();
}
function showProgress(p){
 progress=clamp(p,0,1);$('progress').textContent=Math.round(progress*100)+'%';$('barFill').style.width=(progress*100)+'%';
 drawMini(progress);
}
function overhead(){
 if(route.length<2||!map)return;
 const lo=route.map(p=>p[0]),la=route.map(p=>p[1]);
 const pad={top:Math.round(innerHeight*.24),bottom:Math.round(innerHeight*.31),left:30,right:30};
 map.fitBounds([[Math.min(...lo),Math.min(...la)],[Math.max(...lo),Math.max(...la)]],{padding:pad,pitch:45,bearing:-18,duration:1100,maxZoom:15.4});
}
function render(){
 if(!map||route.length<2||overview)return;
 if(phase==='route'){
  const here=coordAt(progress),a=coordAt(Math.max(0,progress-.003)),b=coordAt(Math.min(1,progress+.004));
  const h=heading(a,b);currentHeading=(currentHeading+deltaAngle(currentHeading,h)*.095+360)%360;
  const ahead=coordAt(Math.min(1,progress+.006));
  const center=lerpCoord(here,ahead,.18);
  if(!pov)map.jumpTo({center,zoom:innerWidth<650?17.43:17.58,pitch:75,bearing:currentHeading-14});
  else updatePOVCamera(here);
  city?.setFocus?.(center);setSource('magic-done',geoLine(prefix(progress)));
  $('phase').textContent=mode==='Ruta real por calles'?'Seguimos las calles reales desde el cielo':'Ruta panorámica aproximada';
  if(progress<.1)$('chapterTitle').textContent='¡Despegamos!';
  else if(progress<.3)$('chapterTitle').textContent='Seguimos entre las nubes';
  else if(progress<.56)$('chapterTitle').textContent='Mira los tejados iluminados';
  else if(progress<.83)$('chapterTitle').textContent='¿Reconoces estas calles?';
  else $('chapterTitle').textContent='Ya casi llegamos';
 }else if(phase==='orbit'){
  const d=destination,p=orbitTime/16000,angle=rad(currentHeading+p*300),radius=54;
  const c=[d[0]+Math.sin(angle)*radius/(111320*Math.cos(rad(d[1]))),d[1]+Math.cos(angle)*radius/111320];
  if(!pov)map.jumpTo({center:c,zoom:17.15,pitch:76,bearing:currentHeading+p*300});
  else updatePOVCamera(c);
  city?.setFocus?.(d);$('chapterTitle').textContent='La magia ha llegado';
 }
}
function tick(t){
 frame=0;if(!playing||paused||overview)return;
 if(!lastFrame)lastFrame=t;
 const dt=Math.min(90,Math.max(0,t-lastFrame));lastFrame=t;
 if(phase==='route'){
  elapsed=Math.min(duration,elapsed+dt);
  showProgress(elapsed/duration);
  if(elapsed>=duration){phase='orbit';orbitTime=0}
 }else if(phase==='orbit'){
  orbitTime+=dt;showProgress(1);
  if(orbitTime>=16000){finish();return}
 }
 // 20fps on iPhone: avoid requesting 3D tile redraws at excessive frequency.
 if(t-(tick.lastRender||0)>48){tick.lastRender=t;render()}
 if(playing&&!paused)frame=requestAnimationFrame(tick);
}
function startTimer(){
 playing=true;paused=false;phase='route';elapsed=0;orbitTime=0;lastFrame=0;tick.lastRender=0;
 $('pause').textContent='Pausar vista';$('balloon').hidden=false;status('NOCHE DE CINE · EDIFICIOS 3D');
 showProgress(0);render();frame=requestAnimationFrame(tick);
}
async function startFlight(){
 if(playing)return;
 if(!map||!ready){message('El motor 3D sigue cargando. Si no aparece, consulta el aviso sobre el mapa.');return}
 $('error').hidden=true;$('launch').disabled=true;
 try{
  $('launch').textContent='Localizando las calles…';
  if($('originAddress').value.trim()){
   const start=await geocode($('originAddress').value.trim());
   origin=start.coords;originName=start.name;
  }else{origin=[...ORIGIN];originName='Puerta de Alcalá · demo'}
  const input=$('destination').value.trim();
  if(input){const place=await geocode(input);destination=place.coords;destinationName=place.name}
  else{destination=[...DEST[chosen].coords];destinationName=DEST[chosen].name}
  $('launch').textContent='Calculando la ruta real…';
  await calculateRoute();
  if(route.length<2)throw Error('No se pudo calcular el recorrido');
  $('routeLabel').textContent=(originName==='Puerta de Alcalá · demo'?'Puerta de Alcalá':originName)+' → '+destinationName;
  $('routeMode').textContent=mode+' · Edificios 3D';
  $('setup').hidden=true;$('story').hidden=false;$('flightHud').hidden=false;
  $('arrival').hidden=true;$('balloon').hidden=false;
  showProgress(0);updateLayers();phase='preview';overview=true;overhead();
  $('overview').textContent='Volver al globo';
  await new Promise(r=>setTimeout(r,3600));
  if(phase!=='preview')return;
  overview=false;$('overview').textContent='Ver mapa';startTimer();
 }catch(e){$('error').textContent=e?.message||String(e);$('error').hidden=false;status('REVISAR DIRECCIÓN');console.warn('Flight setup',e)}
 finally{$('launch').disabled=false;$('launch').textContent='✦ Comenzar vuelo 3D'}
}
function pause(){
 if(!playing||overview)return;
 paused=!paused;
 $('pause').textContent=paused?'▶ Continuar':'Pausar vista';
 $('phase').textContent=paused?'El globo está esperando…':'Seguimos volando';
 if(!paused){lastFrame=0;frame=requestAnimationFrame(tick)}
 else{cancelAnimationFrame(frame);frame=0}
}
function finish(){
 cancelAnimationFrame(frame);frame=0;playing=false;paused=false;phase='done';povExit();
 $('balloon').hidden=true;$('flightHud').hidden=true;$('story').hidden=true;$('arrival').hidden=false;status('MISIÓN COMPLETADA');
}
function restart(){
 cancelAnimationFrame(frame);frame=0;playing=false;paused=false;overview=false;phase='idle';povExit();
 $('setup').hidden=false;$('flightHud').hidden=true;$('story').hidden=true;$('arrival').hidden=true;$('balloon').hidden=true;
 route=[];routeLength=0;lengths=[];rooftops=[];setPoints('magic-sparks',[]);setPoints('magic-roofs',[]);
 setSource('magic-route',empty());setSource('magic-done',empty());
 $('overview').textContent='Ver mapa';status(day?'FOTOGRAFÍA REAL · DÍA':'MADRID REAL · EDIFICIOS 3D');
 map?.easeTo({center:ORIGIN,zoom:16.8,pitch:72,bearing:-25,duration:700});
}
function toggleOverview(){
 if(!playing)return;
 overview=!overview;
 if(overview){
  cancelAnimationFrame(frame);frame=0;overhead();
  $('overview').textContent='Volver al globo';
 }else{
  $('overview').textContent='Ver mapa';lastFrame=0;render();
  if(!paused)frame=requestAnimationFrame(tick);
 }
}
function toggleDay(){
 clearTimeout(cityLampTimer);clearTimeout(buildingCheckTimer);
 day=!day;document.body.classList.toggle('day',day);$('day').innerHTML=day?'☾ <span>Ver de noche</span>':'☀️ <span>Ver de día</span>';
 fx.setActive(!day&&magic);
 city=null;rooftops=[];clearTimeout(windowTimer);
 ready=false;map?.setStyle(styleFallback?local3DStyle(day):(day?MAP_STYLE.day:MAP_STYLE.night));armStyleWatchdog();
 message(day?'Ortofoto PNOA real.':'Noche artística sobre fotografía aérea real.');
}
function toggleMagic(){
 magic=!magic;$('magic').classList.toggle('selected',magic);$('magic').textContent=magic?'✦ Magia':'✧ Sin magia';
 fx.setActive(magic&&!day);city?.setActive?.(magic&&!day);city?.setMagic?.(magic);
 const ids=['magic-street-halo','magic-street-light'];
 for(const id of ids)if(map?.getLayer(id))map.setLayoutProperty(id,'visibility',magic?'visible':'none');
 if(magic){updateLayers();scheduleWindows()}
 else{rooftops=[];setPoints('magic-roofs',[]);setPoints('magic-sparks',[])}
}
// iOS sensor permission must be requested inside the button's click handler.
const look={active:false,base:null,alpha:0,drag:0,pitch:0,startX:null,startY:null};
function updatePOVCamera(pos){
 if(!map||!look.active)return;
 const sensor=look.base===null?0:((look.alpha-look.base+540)%360-180);
 map.jumpTo({center:pos,zoom:17.4,pitch:clamp(79+look.pitch,60,85),bearing:currentHeading+sensor+look.drag});
}
function onOrientation(e){
 if(!look.active||!Number.isFinite(e.alpha))return;
 look.alpha=e.alpha;if(look.base===null)look.base=e.alpha;
 if(playing&&!paused)updatePOVCamera(coordAt(progress));
}
function povExit(){
 look.active=false;pov=false;document.body.classList.remove('pov');$('povScene').hidden=true;
 if(playing)$('balloon').hidden=false;
 window.removeEventListener('deviceorientation',onOrientation);
 look.startX=null;look.startY=null;
}
async function povEnter(){
 if(!playing)return;
 look.active=true;pov=true;look.drag=0;look.pitch=0;look.base=null;
 $('balloon').hidden=true;$('povScene').hidden=false;document.body.classList.add('pov');
 try{
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
   const permission=await DeviceOrientationEvent.requestPermission();
   if(permission!=='granted')$('povHint').textContent='Desliza el dedo para mirar alrededor.';
  }
  window.addEventListener('deviceorientation',onOrientation,{passive:true});
 }catch(e){$('povHint').textContent='Gira arrastrando el dedo. Sensor no disponible.'}
 updatePOVCamera(coordAt(progress));
}
const drag=$('povDrag');
drag.addEventListener('pointerdown',e=>{if(!look.active)return;look.startX=e.clientX;look.startY=e.clientY;drag.setPointerCapture?.(e.pointerId)});
drag.addEventListener('pointermove',e=>{
 if(!look.active||look.startX===null)return;
 look.drag=clamp(look.drag+(e.clientX-look.startX)*.26,-240,240);
 look.pitch=clamp(look.pitch+(e.clientY-look.startY)*.08,-15,5);
 look.startX=e.clientX;look.startY=e.clientY;updatePOVCamera(coordAt(progress));
});
const release=e=>{look.startX=null;look.startY=null;try{drag.releasePointerCapture(e.pointerId)}catch(_){}};
drag.addEventListener('pointerup',release);drag.addEventListener('pointercancel',release);
$('povRecenter').addEventListener('click',()=>{look.base=look.alpha;look.drag=0;look.pitch=0;updatePOVCamera(coordAt(progress))});
$('povExit').addEventListener('click',()=>{povExit();render()});
$('pov').addEventListener('click',povEnter);
$('launch').addEventListener('click',startFlight);
$('pause').addEventListener('click',pause);
$('overview').addEventListener('click',toggleOverview);
$('day').addEventListener('click',toggleDay);
$('magic').addEventListener('click',toggleMagic);
$('restart').addEventListener('click',restart);$('again').addEventListener('click',restart);
for(const button of document.querySelectorAll('.choice')){
 button.addEventListener('click',()=>{chosen=button.dataset.place;$('destination').value='';document.querySelectorAll('.choice').forEach(b=>b.classList.toggle('active',b===button))});
}
$('destination').addEventListener('input',()=>document.querySelectorAll('.choice').forEach(b=>b.classList.remove('active')));
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&playing&&!paused&&!overview)pause();
});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);fx.setActive(false)});
initMap();
