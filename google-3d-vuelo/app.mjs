import {calculateStreetRoute,interpolate as geoLerp} from './flight-native.mjs?v=3.1.2';
import {installLook360} from './look360.mjs?v=5.4.0';
import {CinemaNight} from './night-cinema-v9-1.mjs?v=9.1.0';
import {StreetNightScene} from './street-night-v7.mjs?v=8.0.0';
import {EnchantedRoofScene} from './enchanted-roofs-v9.mjs?v=9.0.0';
import {BlowBoost,MAX_BLOW_SPEED} from './blow-boost.mjs?v=9.5.0';
/*
 * Villa Pérez Google 3D experiment.
 * Google Maps JavaScript API 3D, photorealistic daytime only.
 * Nothing is sent to a Villa Pérez backend. Public demo destinations are hardcoded.
 * Geocoding and Routes receive origin/destination coordinates when the parent launches the flight.
 * API key is held in sessionStorage of this tab; never committed, logged, or put in URL.
 */
const $=id=>document.getElementById(id);
// The photoreal source is real Google 3D. Night is a cinematic reconstruction.
document.documentElement.classList.add('night-active'); // Canvas2D night; CSS only as fallback
const cinema=new CinemaNight($('nightCanvas'));
const START={lat:40.42016,lng:-3.68845};
const routes={
 plaza:{
  label:'Plaza Mayor',points:[
   START,{lat:40.41894,lng:-3.69218},{lat:40.41870,lng:-3.69533},
   {lat:40.41800,lng:-3.70022},{lat:40.41695,lng:-3.70382},
   {lat:40.41596,lng:-3.70569},{lat:40.41536,lng:-3.70737}
  ],chapters:['Sobre los tejados','Las avenidas de Madrid','Madrid desde el cielo','Rumbo al centro','Cerca de Plaza Mayor','Ya casi llegamos']
 },
 bernabeu:{
  label:'Santiago Bernabéu',points:[START,
   {lat:40.42522,lng:-3.68978},{lat:40.43360,lng:-3.69022},
   {lat:40.43920,lng:-3.69012},{lat:40.44472,lng:-3.68936},
   {lat:40.44929,lng:-3.68842},{lat:40.45306,lng:-3.68832}
  ],chapters:['La clínica queda atrás','Por las grandes avenidas','La Castellana bajo el globo','Sobre el corazón de Madrid','Los últimos tejados','Llegamos al estadio']
 },
 arroyofresno:{
  label:'Arroyo Fresno',points:[START,
   {lat:40.4268,lng:-3.6898},{lat:40.4385,lng:-3.6947},
   {lat:40.4465,lng:-3.7067},{lat:40.4554,lng:-3.7158},
   {lat:40.4652,lng:-3.7260},{lat:40.4787,lng:-3.7347}
  ],chapters:['Salimos de la clínica','Sobre los edificios','Los barrios de Madrid','Cruzando nuevas avenidas','La ciudad se abre','Un secreto en tu barrio']
 }
};
const state={
 loaded:false,map:null,Polyline3DElement:null,mapLoading:false,route:'plaza',
 custom:false,points:[],end:null,segment:0,flightToken:0,animationCleanup:null,
 playing:false,paused:false,activeDestination:null,timeout:null,apiKey:'',
 phase:'idle',progressMs:0,routeDurationMs:72000,orbitDurationMs:22000,
 orbitElapsedMs:0,frameId:0,lastFrame:0,lastPaint:0,filteredHeading:null,
 native:null,Model3DElement:null,Marker3DElement:null,routeSource:'panoramica',effectsOn:true,
 routeDistances:[],routeLength:0,orbitStartHeading:0,orbitView:-1,busy:false,
 origin:{lat:START.lat,lng:START.lng},clinicName:'Clínica del Doctor Abreu',
 originLabel:'Origen de prueba · Puerta de Alcalá',clinicVerified:false,originMarker:null,
 destinationMarker:null,routeGlow:null,routeLine:null,overview:false,overviewTimer:0,
 overviewWasPlaying:false,originStored:false,
 terrainSamples:[],turnLastTs:0,takeoffMs:0,takeoffDurationMs:2600,overviewSnapshot:null,takeoffBearing:0,
 routeSpark:null,routeSparkTip:null,magicLastAt:0,magicDraws:0,day:false,fireflies:[],streetNight:null,enchantedRoofs:null
};
const blowBoost = new BlowBoost();
let lastBlowUiAt = 0;
function renderBlowUi(speed=1, message='') {
 const active=blowBoost.active, pending=blowBoost.pending;
 const label=message || (pending?'Solicitando permiso al micrófono…'
  :active?(speed>1.3?'🌬 TURBO ×'+speed.toFixed(1)+' · ¡El globo acelera!':'Sopla cerca del micrófono para acelerar')
  :'Micrófono apagado');
 $('blowStatus').textContent=label;
 $('blowMeter').style.width=(Math.max(0,Math.min(1,(speed-1)/(MAX_BLOW_SPEED-1)))*100).toFixed(0)+'%';
 $('blowToggle').textContent=pending?'⌛ Permiso…':active?'🎤 Desactivar soplido':'🎤 Activar soplido';
 $('povBlowToggle').textContent=active?(speed>1.3?'🚀 ×'+speed.toFixed(1):'🎤 Mic ON'):'🌬 Soplar';
 for(const button of [$('blowToggle'),$('povBlowToggle')]){
  button.disabled=pending;button.setAttribute('aria-pressed',String(active));
 }
 $('balloon').classList.toggle('blow-fast',active&&speed>1.4);
 document.querySelector('.blow-strip')?.classList.toggle('is-boosted',active&&speed>1.4);
}
async function toggleBlow(){
 if(blowBoost.pending)return;
 if(blowBoost.active){blowBoost.stop();renderBlowUi();return}
 if(!state.playing||state.phase==='done'){info('Activa primero el vuelo para soplar.');return}
 renderBlowUi(1,'Solicitando permiso al micrófono…');
 try {
  const started=await blowBoost.start();
  if(!state.playing||state.paused||document.hidden)blowBoost.stop();
  renderBlowUi();
  if(started&&blowBoost.active) info('¡Micrófono listo! Sopla hacia él para impulsar el globo.');
 }catch(e){
  blowBoost.stop();
  renderBlowUi(1,'Micrófono no disponible · vuelo normal');
  info(e?.name==='NotAllowedError'?'Permiso de micrófono denegado. El vuelo sigue sin soplidos.':
   'No se pudo activar el micrófono. Comprueba HTTPS y los permisos del navegador.');
 }
}
const R=Earth=>Earth*Math.PI/180;
function distance(a,b){
 const phi1=R(a.lat),phi2=R(b.lat),dphi=R(b.lat-a.lat),dl=R(b.lng-a.lng);
 return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dphi/2)**2+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dl/2)**2)));
}
function lerp(a,b,t){return {lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t}}
function heading(a,b){const y=Math.sin(R(b.lng-a.lng))*Math.cos(R(b.lat)),x=Math.cos(R(a.lat))*Math.sin(R(b.lat))-Math.sin(R(a.lat))*Math.cos(R(b.lat))*Math.cos(R(b.lng-a.lng));return (Math.atan2(y,x)*180/Math.PI+360)%360}
function smoothCustom(end,origin=START,privateHome=true){
 const dist=distance(origin,end);
 // Trim only residential destinations, by approximately 180m.
 // Public landmarks must stay exactly at their displayed marker.
 const cut=privateHome?Math.max(0,1-180/Math.max(dist,180)):1;
 const stop=lerp(origin,end,cut);
 const points=[origin],n=Math.min(10,Math.max(5,Math.ceil(dist/500)));
 for(let i=1;i<n;i++){
  const t=i/n,a=lerp(origin,stop,t);
  const curvature=Math.min(.00065,dist/10000000)*Math.sin(Math.PI*t);
  const ang=Math.atan2(stop.lng-origin.lng,stop.lat-origin.lat)+Math.PI/2;
  points.push({lat:a.lat+Math.cos(ang)*curvature,lng:a.lng+Math.sin(ang)*curvature});
 }
 points.push(stop);
 return points;
}
function error(text){
 const el=$('error');el.textContent=text;el.hidden=false;
 $('systemMessage').textContent=text;$('systemMessage').hidden=false;
 clearTimeout(state.timeout);state.timeout=setTimeout(()=>{$('systemMessage').hidden=true},8500);
}
function info(text){
 $('systemMessage').textContent=text;$('systemMessage').hidden=false;
 clearTimeout(state.timeout);state.timeout=setTimeout(()=>{$('systemMessage').hidden=true},4300);
}
function clearError(){$('error').hidden=true;$('systemMessage').hidden=true}
function status(t){$('mapState').textContent=t}
function setActiveChoice(choice){
 state.route=choice;state.custom=false;state.points=routes[choice].points;
 $('address').value='';
 document.querySelectorAll('.chip').forEach(b=>b.classList.toggle('active',b.dataset.route===choice));
 $('travelLabel').textContent=state.originLabel.toUpperCase()+' → '+routes[choice].label.toUpperCase();
 if(state.loaded&&!state.playing&&!state.busy&&!state.overview){
  try{state.streetNight?.populate(routes[choice].points)}
  catch(e){console.warn('Night preview lamps unavailable',e)}
  try{state.enchantedRoofs?.populate(routes[choice].points)}
  catch(e){console.warn('Magical roof preview unavailable',e)}
 }
}
document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>setActiveChoice(b.dataset.route)));
$('address').addEventListener('input',()=>{
 state.custom=$('address').value.trim().length>0;
 if(state.custom)document.querySelectorAll('.chip').forEach(b=>b.classList.remove('active'));
});
$('showKey').addEventListener('click',()=>{
 const shown=$('apiKey').type==='text';$('apiKey').type=shown?'password':'text';
 $('showKey').textContent=shown?'VER':'OCULTAR';$('showKey').setAttribute('aria-pressed',String(!shown));
});
function loadGoogle(key){
 return new Promise((resolve,reject)=>{
   const cb='__villaGoogleMapsLoaded';
   let done=false,tag,timeout;
   const finish=(err)=>{
    if(done)return;done=true;clearTimeout(timeout);delete window[cb];delete window.gm_authFailure;if(err)reject(err);else resolve();
   };
   window[cb]=()=>finish();
   window.gm_authFailure=()=>finish(new Error('Google ha rechazado la clave: comprueba la autorización, las restricciones y la facturación.'));
   timeout=setTimeout(()=>finish(new Error('Google no ha respondido a la carga de Maps JS. Revisa conexión, restricciones y facturación.')),25000);
   tag=document.createElement('script');
   tag.async=true;
   tag.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({
     key,loading:'async',v:'weekly',libraries:'maps3d',language:'es',region:'ES',callback:cb
   });
   tag.onerror=()=>finish(new Error('No se ha podido descargar Google Maps JavaScript API.'));
   document.head.appendChild(tag);
 });
}
async function connectGoogle(){
 if(state.loaded){info('Google Maps 3D ya está conectado.');return;}
 if(state.mapLoading)return;
 const key=$('apiKey').value.trim();
 if(!/^AIza[A-Za-z0-9_-]{30,}$/.test(key)){error('Introduce una API key web válida de Google Maps (normalmente empieza por AIza).');return;}
 state.apiKey=key;state.mapLoading=true;clearError();$('connect').disabled=true;
 $('connect').textContent='Conectando con Google…';status('INICIALIZANDO FOTORREALISMO');
 try{
   await loadGoogle(key);
   if(!window.google?.maps?.importLibrary)throw new Error('Maps JavaScript API no ha terminado de inicializarse.');
   const {Map3DElement,Polyline3DElement,Model3DElement,Marker3DElement}=await google.maps.importLibrary('maps3d');
   state.Polyline3DElement=Polyline3DElement;
   state.Model3DElement=Model3DElement;
   state.Marker3DElement=Marker3DElement;
   const map=new Map3DElement({
     center:{lat:START.lat,lng:START.lng,altitude:755},
     heading:244,tilt:74,range:550,mode:'SATELLITE',
     qualityMode:'FIDELITY',defaultUIHidden:true
   });
   state.map=map;
   state.streetNight=new StreetNightScene(map,Marker3DElement);
   state.streetNight.setNight(!state.day);
   state.enchantedRoofs=new EnchantedRoofScene(map,Marker3DElement,Model3DElement);
   state.enchantedRoofs.setNight(!state.day);
   state.enchantedRoofs.setMagic(state.effectsOn);
   // Keep SATELLITE photogrammetry as the single cinematic visual mode.
   map.mode='SATELLITE';
   map.style.cssText='width:100%;height:100%;display:block;';
   map.addEventListener('gmp-error',ev=>{
     console.warn('3D map initialization event:',ev);
     status('ERROR GOOGLE 3D');
     info('Google Maps 3D ha comunicado un error. Comprueba API key, facturación y restricciones del dominio.');
   });
   $('mapHost').appendChild(map);
   $('beforeMap').hidden=true;
   cinema.setNight(!state.day);
   let rendered3d=false;
   map.addEventListener('gmp-steadychange',event=>{
     if(event.isSteady){rendered3d=true;status('GOOGLE 3D · ESCENA CARGADA');}
   });
   setTimeout(()=>{
     if(state.loaded&&!rendered3d&&!state.playing)
       info('La cartografía 3D sigue cargando. Si la pantalla permanece vacía, revisa la cobertura y permisos de Google Cloud.');
   },25000);
   state.loaded=true;
   createOriginMarker();
   // Preview lights must be visible BEFORE starting the flight, so
   // "día"/"noche" offers a meaningful comparison right away.
   let previewInstalled=false;
   const installPreview=()=>{
    if(previewInstalled||!state.loaded||state.playing)return;
    previewInstalled=true;
    try{state.streetNight?.populate(routes[state.route].points)}
    catch(e){console.warn('Preview street lights unavailable',e)}
    try{state.enchantedRoofs?.populate(routes[state.route].points)}
    catch(e){console.warn('Preview magical roofs unavailable',e)}
   };
   map.addEventListener('gmp-steadystate',installPreview,{once:true});
   setTimeout(installPreview,3400);
   try{sessionStorage.setItem('vp_google3d_trial_key',key)}catch(e){}
   $('keyGroup').classList.add('connected');
   $('setup').classList.add('ready');
   $('connect').textContent='✓ Google Maps 3D conectado';
   $('launch').disabled=false;
   updateClinicSummary();
   status('GOOGLE MAPS · EDIFICIOS REALES');
   info('Conectado. Pulsa «Despegar» para ver el vuelo fotorrealista.');
 }catch(e){
   console.error('Error inicializando Maps 3D:',e);
   state.mapLoading=false;state.loaded=false;$('connect').disabled=false;
   $('connect').textContent='Volver a conectar Google 3D';
   status('CONECTAR GOOGLE MAPS');
   error('No se ha podido activar Google 3D: '+(e.message||String(e))+' Revisa también la consola de Google Cloud.');
 }
}
$('connect').addEventListener('click',connectGoogle);
function updateClinicSummary(){
 const address=$('clinicAddress').value.trim();
 const name=$('clinicName').value.trim()||'Clínica del Doctor Abreu';
 $('clinicSummary').textContent=address?name:'Origen de prueba · Puerta de Alcalá';
}
$('clinicName').addEventListener('input',updateClinicSummary);
$('clinicAddress').addEventListener('input',updateClinicSummary);
async function locateClinicOrigin(){
 const name=$('clinicName').value.trim()||'Clínica del Doctor Abreu';
 const address=$('clinicAddress').value.trim();
 state.clinicName=name;
 if(!address){
  state.origin={...START};
  state.clinicVerified=false;
  state.originLabel='Origen de prueba · Puerta de Alcalá';
  $('originBadge').textContent=state.originLabel;
  updateClinicSummary();
  createOriginMarker();
  return;
 }
 let Geocoder;
 try{({Geocoder}=await google.maps.importLibrary('geocoding'))}
 catch(e){throw new Error('Para situar la clínica necesitas habilitar Geocoding API.')}
 const result=await new Geocoder().geocode({
  address,region:'ES',componentRestrictions:{country:'ES'}
 });
 const first=result.results?.find(x=>x.geometry?.location);
 if(!first)throw new Error('No encuentro la dirección de la clínica. Añade calle, número y ciudad.');
 const loc=first.geometry.location;
 state.origin={lat:loc.lat(),lng:loc.lng()};
 if(!Number.isFinite(state.origin.lat)||!Number.isFinite(state.origin.lng))
  throw new Error('La dirección de la clínica no tiene coordenadas válidas.');
 state.clinicVerified=true;
 state.originLabel=name;
 $('originBadge').textContent='SALIDA · '+name;
 updateClinicSummary();
 try{localStorage.setItem('vp_clinic_origin',JSON.stringify({name,address}))}catch(e){}
 createOriginMarker();
}
async function getDestination(){
 const text=$('address').value.trim();
 if(!text){state.custom=false;return {
 points:state.clinicVerified
   ?smoothCustom(routes[state.route].points.at(-1),state.origin,false)
   :routes[state.route].points,
 label:routes[state.route].label,
 trueEnd:routes[state.route].points.at(-1),custom:false
};}
 if(text.length>220)throw new Error('La dirección es demasiado larga.');
 let Geocoder;
 try{({Geocoder}=await google.maps.importLibrary('geocoding'))}
 catch(e){throw new Error('No se puede cargar Geocoding. Habilita Geocoding API o usa una ruta de ejemplo.');}
 const geo=new Geocoder(),result=await geo.geocode({address:text,region:'ES',componentRestrictions:{country:'ES'}});
 const first=result.results?.find(r=>r.geometry?.location&&r.geometry.location_type!=='APPROXIMATE')||result.results?.[0];
 if(!first)throw new Error('No encuentro una dirección inequívoca. Escribe calle, número y municipio.');
 const loc=first.geometry.location;const end={lat:loc.lat(),lng:loc.lng()};
 if(!Number.isFinite(end.lat)||!Number.isFinite(end.lng))throw new Error('No se han recibido coordenadas válidas.');
 if(distance(state.origin,end)>80000)throw new Error('Para esta prueba el destino debe estar a menos de 80 km de Madrid.');
 return {points:smoothCustom(end,state.origin),trueEnd:end,label:'destino elegido',custom:true};
}
async function improveRoute(destination){
 // Route.computeRoutes is the current Google route API, and may require a
 // separately enabled Google Routes API. Do not block the parent when unavailable.
 const attempt=calculateStreetRoute(state.origin,destination.trueEnd,!!destination.custom);
 try{
  const result=await Promise.race([
   attempt,
   new Promise((_,reject)=>setTimeout(()=>reject(new Error('Routes timeout')),11000))
  ]);
  if(result?.length>=2){
   destination.points=result;
   state.routeSource='google';
   return true;
  }
 }catch(e){console.warn('Google Routes not enabled, using scenic flight:',e)}
 state.routeSource='panoramica';
 return false;
}
function removeElement(el){try{el?.remove()}catch(e){}}
function createOriginMarker(){
 if(!state.map||!state.Marker3DElement)return;
 removeElement(state.originMarker);
 try{
  // Built-in pin and native Google text label, not a raster photo marker.
  state.originMarker=new state.Marker3DElement({
   position:{...state.origin,altitude:8},altitudeMode:'RELATIVE_TO_GROUND',
   label:state.originLabel,sizePreserved:true,drawsWhenOccluded:true,
   zIndex:19
  });
  state.originMarker.id='vpOriginPin';
  state.map.append(state.originMarker);
 }catch(e){console.warn('Origin pin unavailable:',e)}
}
function clearRouteMap(){
 state.streetNight?.clear();
 state.enchantedRoofs?.clear();
 removeElement(state.routeGlow);removeElement(state.routeLine);
 removeElement(state.routeSpark);removeElement(state.routeSparkTip);
 for(const fly of state.fireflies)removeElement(fly);
 state.fireflies=[];
 removeElement(state.destinationMarker);state.routeGlow=null;
 state.routeLine=null;state.routeSpark=null;state.routeSparkTip=null;
 state.magicLastAt=0;state.destinationMarker=null;
}
function makePolyline(points,destination){
 if(!state.Polyline3DElement||!state.map)return;
 clearRouteMap();
 // Pale pearl-and-lilac thread, 3D world coordinates from the ACTUAL road
 // route. It does not depict or alter Google map photography.
 const path=points.map(p=>({...p,altitude:22}));
 function addMagicalLine(id,options){
  try{
   const line=new state.Polyline3DElement({
    ...options,altitudeMode:'RELATIVE_TO_GROUND',
    drawsOccludedSegments:true
   });
   line.id=id;
   state.map.append(line);
   return line;
  }catch(e){console.warn('Magical 3D line unavailable',id,e);return null}
 }
 // A faint wide halo plus a thin silvery thread; no opaque yellow GPS stripe.
 state.routeGlow=addMagicalLine('vpRouteAura',{
  path,strokeColor:'#B7A3D5',strokeWidth:6.5,
  outerColor:'#E1D3EC',outerWidth:.43
 });
 state.routeLine=addMagicalLine('vpRouteThread',{
  path,strokeColor:'#F6EDE0',strokeWidth:2.2,
  outerColor:'#B18AA9',outerWidth:.5
 });
 // Two animated pulses slide along the REAL route throughout the journey.
 const origin=path[0];
 state.routeSpark=addMagicalLine('vpMagicComet',{
  path:[origin,origin],strokeColor:'#EDD7FF',strokeWidth:8,
  outerColor:'#FFF9DE',outerWidth:.43
 });
 state.routeSparkTip=addMagicalLine('vpMagicCometTip',{
  path:[origin,origin],strokeColor:'#FFFCEC',strokeWidth:4,
  outerColor:'#B7F6EE',outerWidth:.95
 });
 // Geographic city lanterns and sparse enchanted glints along the actual route.
 // These are not fabricated or recolored windows on the Google meshes.
 try{state.streetNight?.populate(points)}
 catch(e){console.warn('Optional 3D street lights unavailable',e)}
 try{state.enchantedRoofs?.populate(points)}
 catch(e){console.warn('Optional enchanted rooftops unavailable',e)}
 createOriginMarker();
 if(state.Marker3DElement){
  try{
   state.destinationMarker=new state.Marker3DElement({
    position:{...points.at(-1),altitude:8},altitudeMode:'RELATIVE_TO_GROUND',
    label:'✧ Destino · '+destination.label,sizePreserved:true,
    drawsWhenOccluded:true,zIndex:18
   });
   state.map.append(state.destinationMarker);
  }catch(e){console.warn('Destination pin unavailable',e)}
 }
}
function updateMagicTrail(progress,now=getNow(),force=false){
 if(!state.routeSpark&&!state.routeSparkTip)return;
 if(!force&&now-state.magicLastAt<140)return; // ~7 updates/sec on mobile
 state.magicLastAt=now;
 const enabled=state.effectsOn;
 if(!enabled){
  for(const segment of [state.routeSpark,state.routeSparkTip]){
   if(segment)try{segment.path=[]}catch(e){}
  }
  return;
 }
 const total=Math.max(1,state.routeLength);
 const p=clamp01(progress);
 const travel=state.phase==='orbit'?0:40/total;
 const position=clamp01(p+travel);
 const pathBetween=(from,to,n=6)=>{
  const a=clamp01(from),b=clamp01(to);
  return Array.from({length:n},(_,i)=>{
   const t=a+(b-a)*(i/(n-1));
   const point=routePosition(t);
   return {...point,altitude:25+4*Math.sin(t*53+now*.00042)};
  });
 };
 // Lilac comet about 68m long, with a short luminous tip. The opacity and
 // surface glow come from the material colors, not a dark Google map filter.
 const start=Math.max(0,position-69/total);
 const end=Math.min(1,position+24/total);
 const tipStart=Math.max(0,position-9/total);
 const tipEnd=Math.min(1,position+15/total);
 try{
  if(state.routeSpark)state.routeSpark.path=pathBetween(start,end,8);
  if(state.routeSparkTip)state.routeSparkTip.path=pathBetween(tipStart,tipEnd,4);
  state.magicDraws++;
 }catch(e){console.warn('Magic route animation unsupported by this browser',e)}
}
function overviewCamera(){
 const points=state.points;
 if(!points?.length||!state.map)return;
 const limits={
  minLat:Math.min(...points.map(p=>p.lat)),maxLat:Math.max(...points.map(p=>p.lat)),
  minLng:Math.min(...points.map(p=>p.lng)),maxLng:Math.max(...points.map(p=>p.lng))
 };
 const middle={lat:(limits.minLat+limits.maxLat)/2,lng:(limits.minLng+limits.maxLng)/2};
 const diag=distance({lat:limits.minLat,lng:limits.minLng},{lat:limits.maxLat,lng:limits.maxLng});
 // Fit the full route, not just its endpoints; leave space for a narrow iPhone.
 const range=Math.min(32000,Math.max(1800,diag*(innerWidth<680?2.35:1.7)+650));
 try{
  state.map.stopCameraAnimation?.();
  state.overviewSnapshot={center:middle,altitude:790,heading:0,tilt:28,range};
  state.map.center={...middle,altitude:790};
  state.map.heading=0;state.map.tilt=28;state.map.range=range;
 }catch(e){console.warn('Could not show full route:',e)}
}
function closeOverview(){
 if(!state.overview)return;
 state.overview=false;
 $('atlasFrame').hidden=true;
 clearTimeout(state.overviewTimer);state.overviewTimer=0;
 $('overviewToggle').textContent='🗺 Ver recorrido completo';
 $('overviewToggle').setAttribute('aria-pressed','false');
 $('balloon').hidden=state.phase==='done';
 state.lastFrame=getNow();state.lastPaint=0;state.turnLastTs=0;
 if(state.phase==='preview'){
  flightStart();
  return;
 }
 if(state.phase==='takeoff')renderTakeoff(state.takeoffMs/state.takeoffDurationMs);
 else if(state.phase==='route')renderRoute(state.progressMs/state.routeDurationMs);
 else if(state.phase==='orbit')renderOrbit(state.orbitElapsedMs/state.orbitDurationMs);
 if(state.playing&&!state.paused)state.frameId=requestAnimationFrame(renderTick);
}
function enterOverview({intro=false}={}){
 if(!state.points?.length)return;
 if(explorer.isActive())explorer.disable(false);
 $('povToggle').hidden=true;
 stopFrame();
 state.overview=true;
 $('atlasFrame').hidden=false;
 $('overviewToggle').textContent=intro?'▶ Empezar vuelo':'▶ Volver al vuelo';
 $('overviewToggle').setAttribute('aria-pressed','true');
 $('balloon').hidden=true;
 $('chapterTitle').textContent='El mapa del Ratón Pérez';
 $('chapterEyebrow').textContent='VISTA GENERAL · RUTA COMPLETA';
 $('travelLabel').textContent=state.originLabel.toUpperCase()+' → '+(state.activeDestination?.label||'DESTINO').toUpperCase();
 status('EL MAPA SECRETO · VILLA PÉREZ');
 overviewCamera();
 if(intro){
  state.phase='preview';
  state.overviewTimer=setTimeout(()=>{
    if(state.overview&&state.phase==='preview')closeOverview()
  },4500);
 }
}
function toggleOverview(){
 if(state.overview){closeOverview();return}
 if(!state.playing||state.phase==='done')return;
 enterOverview();
}
/*
 * Google flyCameraTo uses an arcing, parabolic trajectory. On every waypoint
 * this appeared as an unwanted repeated rise-and-fall. For the route we now
 * interpolate the map camera directly at a constant RANGE and TILT.
 * The panorama ends with an orbit on the same fixed camera distance.
 */
// Low-altitude flight: roughly half the previous camera-to-subject distance.
// Altitude is absolute (sea level). Where available, terrain elevations
// supply a safe, smoothed 52 m clearance for the target point.
const CAMERA={altitude:717,range:205,tilt:64,clearance:43,headingLimit:14};

const ORBIT_CHAPTERS=[
 ['Primera vista del destino','Los tejados y las calles aparecen justo bajo el globo.'],
 ['Desde el otro lado','Giramos suavemente para reconocer los edificios desde otro ángulo.'],
 ['La ciudad desde el cielo','La cámara rodea el barrio sin perder la altura del vuelo.'],
 ['La última mirada','Una última panorámica antes de que Pérez continúe en secreto.']
];
function clamp01(v){return Math.max(0,Math.min(1,v))}
function normHeading(v){return (v%360+360)%360}
function shortestTurn(from,to){return ((to-from+540)%360)-180}
function getNow(){return performance.now()}
function terrainAltitudeAt(progress){
 const list=state.terrainSamples;
 if(!list?.length)return CAMERA.altitude;
 const p=clamp01(progress),x=p*(list.length-1),i=Math.floor(x);
 // Smooth changes in the ground height without sudden jumps at the samples.
 const sample=t=>{
  const k=clamp01(t)*(list.length-1),n=Math.floor(k),u=k-n;
  const a=list[n],b=list[Math.min(list.length-1,n+1)];
  return a+(b-a)*u;
 };
 const smooth=(sample(Math.max(0,p-.035))+sample(p)+sample(Math.min(1,p+.035)))/3;
 return smooth+CAMERA.clearance;
}
async function prepareTerrain(){
 state.terrainSamples=[];
 // Optional enhancement: a single Elevation API call per journey.
 // When unavailable, the already-lower fixed camera still works.
 try{
  const {ElevationService}=await google.maps.importLibrary('elevation');
  if(!ElevationService)return;
  const service=new ElevationService();
  const stride=Math.max(1,Math.ceil(state.points.length/24));
  const path=state.points.filter((_,i)=>i%stride===0);
  if(path.at(-1)!==state.points.at(-1))path.push(state.points.at(-1));
  if(path.length<2)return;
  const result=await Promise.race([
   service.getElevationAlongPath({path,samples:20}),
   new Promise((_,reject)=>setTimeout(()=>reject(new Error('Elevation timeout')),2800))
  ]);
  const heights=result?.results?.map(r=>r.elevation)||[];
  if(heights.length>=2&&heights.every(x=>Number.isFinite(x)&&x>-450&&x<5000)){
   // Widen clearance if nearby steep topography is detected.
   state.terrainSamples=heights;
  }
 }catch(e){console.info('Optional terrain elevation unavailable; using safe low camera',e)}
}
function cameraPoint(progress){
 // Keep map route exact; smooth the camera position by <= 9 m at a corner,
 // instead of cutting visibly through the neighbouring buildings.
 const p=clamp01(progress);
 const here=routePosition(p);
 const windowMeters=Math.min(40,Math.max(14,state.routeLength*.012));
 const span=windowMeters/Math.max(1,state.routeLength);
 const prev=routePosition(Math.max(0,p-span));
 const next=routePosition(Math.min(1,p+span));
 const midpoint=lerp(prev,next,.5);
 const offset=distance(here,midpoint);
 const blend=Math.min(.52,9/Math.max(1,offset));
 const softened=lerp(here,midpoint,blend);
 const ahead=routePosition(Math.min(1,p+15/Math.max(1,state.routeLength)));
 return lerp(softened,ahead,.14);
}
function stopFrame(){if(state.frameId){cancelAnimationFrame(state.frameId);state.frameId=0}}
function resetCamera(){
 if(!state.map)return;
 try{
  state.map.stopCameraAnimation();
  state.map.center={lat:state.origin.lat,lng:state.origin.lng,altitude:terrainAltitudeAt(0)};
  state.map.range=CAMERA.range;
  state.map.heading=244;
  state.map.tilt=CAMERA.tilt;
 }catch(e){console.warn('Camera reset unavailable:',e)}
}
function setCamera(point,headingAngle,progress=0){
 if(!state.map)return;
 // Target stays close to the neighbourhood; when Elevation is enabled the
 // camera follows a smoothed terrain profile rather than a flat sea-level plane.
 try{
  state.map.center={lat:point.lat,lng:point.lng,altitude:terrainAltitudeAt(progress)};
  state.map.heading=normHeading(headingAngle);
  // Only set these when necessary so Safari does not request needless redraws.
  if(Math.abs(state.map.range-CAMERA.range)>0.5)state.map.range=CAMERA.range;
  if(Math.abs(state.map.tilt-CAMERA.tilt)>0.1)state.map.tilt=CAMERA.tilt;
 }catch(e){
  console.warn('3D camera could not update:',e);
  if(!state.cameraFaulted){state.cameraFaulted=true;info('No se ha podido actualizar la cámara 3D. Prueba reiniciar el vuelo.')}
 }
}
function buildRouteLengths(points){
 state.routeDistances=[0];
 for(let i=1;i<points.length;i++){
  const d=Math.max(.1,distance(points[i-1],points[i]));
  state.routeDistances.push(state.routeDistances[i-1]+d);
 }
 state.routeLength=state.routeDistances[state.routeDistances.length-1]||1;
}
function catmullRom(a,b,c,d,t){
 // C1-continuous interpolation for cinematic transitions between waypoints.
 const v=x=>.5*((2*b[x])+(-a[x]+c[x])*t+
  (2*a[x]-5*b[x]+4*c[x]-d[x])*t*t+
  (-a[x]+3*b[x]-3*c[x]+d[x])*t*t*t);
 return {lat:v('lat'),lng:v('lng')};
}
function routePosition(progress){
 const points=state.points;
 if(!points?.length)return state.origin;
 const p=clamp01(progress);
 if(p===0)return points[0];
 if(p===1)return points[points.length-1];
 const meters=p*state.routeLength;
 let i=0;
 while(i<points.length-2&&meters>state.routeDistances[i+1])i++;
 const leg=state.routeDistances[i+1]-state.routeDistances[i]||1;
 const u=clamp01((meters-state.routeDistances[i])/leg);
 return state.routeSource==='google'
  ? geoLerp(points[i],points[i+1],u)
  : catmullRom(points[Math.max(0,i-1)],points[i],points[i+1],points[Math.min(points.length-1,i+2)],u);
}
function progress(n,total){
 const pct=Math.round(clamp01(n/Math.max(1,total))*100);
 $('progressLabel').textContent=pct+'%';
 $('progressFill').style.width=pct+'%';
 cinema.setProgress(clamp01(n/Math.max(1,total)));
}
function scene(n,total){
 const names=state.custom
  ?['Despegamos de la clínica','Calles bajo el globo','El camino de estrellas','Siguiendo el polvo mágico','¿Reconoces tu barrio?','Últimos metros secretos']
  :routes[state.route].chapters;
 const chapter=Math.min(names.length-1,Math.floor(clamp01(n/Math.max(1,total))*names.length));
 $('chapterEyebrow').textContent='EN BUSCA DEL DIENTE · CAPÍTULO '+(chapter+1);
 $('chapterTitle').textContent=names[chapter];
 $('chapterDescription').textContent=[
  'Volamos a baja altura sobre calles, tejados y edificios reales.',
  'La cámara acompaña el globo con una altura constante.',
  '¿Reconoces los parques y los cruces de tu ciudad?',
  'Los edificios aparecen cada vez más cerca.',
  'El Ratón Pérez está reconociendo las últimas calles.',
  'Por privacidad, los últimos metros serán un secreto.'
 ][chapter];
}
function cinematicEase(t){
 const p=clamp01(t);
 return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
}
function renderTakeoff(progress){
 const p=cinematicEase(progress);
 const from=state.overviewSnapshot||{
  center:state.origin,altitude:terrainAltitudeAt(0)+100,
  heading:state.takeoffBearing,tilt:28,range:1500
 };
 if(!state.map)return;
 try{
  const location=lerp(from.center,routePosition(0),p);
  const altitude=from.altitude+(terrainAltitudeAt(0)-from.altitude)*p;
  // Zoom geometrically (not linearly) to avoid a jarring zoom near the end.
  const range=from.range*Math.pow(CAMERA.range/Math.max(1,from.range),p);
  const tilt=from.tilt+(CAMERA.tilt-from.tilt)*p;
  const target=normHeading(state.takeoffBearing-9);
  const h=normHeading(from.heading+shortestTurn(from.heading,target)*p);
  state.map.center={...location,altitude};
  state.map.range=range;state.map.tilt=tilt;state.map.heading=h;
 }catch(e){console.warn('Takeoff zoom fallback:',e)}
 $('balloon').hidden=progress<.53;
 $('balloon').style.opacity=String(clamp01((progress-.53)/.36));
 $('chapterEyebrow').textContent='VILLA PÉREZ · COMIENZA EL VUELO';
 $('chapterTitle').textContent='¡Despegamos!';
}
function renderRoute(t){
 const p=clamp01(t);
 // Direction is estimated over the next ~55–115 m, not over an abrupt road
 // vertex. This anticipates turns while keeping the geographic route intact.
 const lead=Math.min(155,Math.max(85,state.routeLength*.038));
 const span=lead/Math.max(1,state.routeLength);
 const before=routePosition(Math.max(0,p-span*.58));
 const after=routePosition(Math.min(1,p+span));
 const desired=heading(before,after);
 const now=getNow();
 const dt=state.turnLastTs?Math.min(.11,Math.max(.016,(now-state.turnLastTs)/1000)):.05;
 state.turnLastTs=now;
 if(state.filteredHeading===null||!Number.isFinite(state.filteredHeading)){
  state.filteredHeading=desired;
 }else{
  const difference=shortestTurn(state.filteredHeading,desired);
  const turnBoost=blowBoost.active?Math.max(1,blowBoost.speed*.85):1;
  const damping=1-Math.exp(-dt/(1.35/turnBoost));
  const maxTurn=CAMERA.headingLimit*dt*turnBoost;
  const change=Math.max(-maxTurn,Math.min(maxTurn,difference*damping));
  state.filteredHeading=normHeading(state.filteredHeading+change);
 }
 $('povToggle').hidden=false;
 if(explorer.isActive())explorer.repaint(cameraPoint(p),p);
 else setCamera(cameraPoint(p),state.filteredHeading-9,p);
 updateMagicTrail(p,now);
 // Recycle roof decorations every few hundred metres, not every animation frame.
 state.enchantedRoofs?.setProgress(p);
 $('balloon').hidden=state.overview||explorer.isActive();
 $('balloon').style.opacity='1';
 progress(p*.82,1);
 scene(p,1);
}
function renderOrbit(t){
 const p=clamp01(t);
 const waypoint=state.points[state.points.length-1];
 // A measured 205-degree final panorama, eased to avoid a whip-pan.
 const ease=(1-Math.cos(Math.PI*p))/2;
 $('povToggle').hidden=false;
 if(explorer.isActive())explorer.repaint(waypoint,1);
 else setCamera(waypoint,state.orbitStartHeading+ease*205,1);
 updateMagicTrail(.982+(Math.sin(p*Math.PI*4)+1)*.007,getNow());
 state.enchantedRoofs?.setProgress(1);
 $('balloon').hidden=state.overview||explorer.isActive();
 const view=Math.min(3,Math.floor(p*4));
 if(view!==state.orbitView){
  state.orbitView=view;
  $('chapterEyebrow').textContent='LLEGADA · PANORÁMICA '+(view+1)+' DE 4';
  $('chapterTitle').textContent=ORBIT_CHAPTERS[view][0];
  $('chapterDescription').textContent=ORBIT_CHAPTERS[view][1];
  $('travelLabel').textContent='ÓRBITA FINAL · VISTA '+(view+1)+' DE 4';
  status('VUELO 3D · VISTAS DEL DESTINO');
 }
 progress(.82+.18*p,1);
}
function finishFlight(){
 explorer.disable(false);
 $('povToggle').hidden=true;
 stopFrame();clearTimeout(state.overviewTimer);state.overviewTimer=0;state.overview=false;
 blowBoost.stop();renderBlowUi();
 $('atlasFrame').hidden=true;
 state.playing=false;state.paused=false;state.phase='done';
 state.progressMs=state.routeDurationMs;state.orbitElapsedMs=state.orbitDurationMs;
 progress(1,1);
 $('balloon').hidden=true;
 $('flightUI').hidden=true;
 $('arrival').hidden=false;
 $('pause').textContent='⏸ Pausar';
 status('MISIÓN COMPLETADA');
}
function renderTick(now){
 state.frameId=0;
 if(!state.playing||state.paused)return;
 let delta=Math.max(0,now-state.lastFrame);
 // Límite moderado para Safari: con Maps 3D a bajo FPS, 90 ms
 // recortaban tanto el tiempo que el turbo apenas movía la cámara.
 // visibilitychange ya pausa la app al pasar a segundo plano.
 delta=Math.min(240,delta);
 state.lastFrame=now;
 // El soplido impulsa la cámara sobre el mapa real: no solo el indicador.
 const speed=blowBoost.active?blowBoost.sample(now):1;
 if(blowBoost.active&&now-lastBlowUiAt>=120){
  lastBlowUiAt=now;renderBlowUi(speed);
 }
 if(state.phase==='takeoff'){
  state.takeoffMs=Math.min(state.takeoffDurationMs,state.takeoffMs+delta*Math.min(speed,3));
  if(state.takeoffMs>=state.takeoffDurationMs){
   state.phase='route';state.lastPaint=0;state.turnLastTs=0;
   state.filteredHeading=state.takeoffBearing;
   renderRoute(0);
  }else if(now-state.lastPaint>=40){
   state.lastPaint=now;renderTakeoff(state.takeoffMs/state.takeoffDurationMs);
  }
 }else if(state.phase==='route'){
  // El avance sobre las coordenadas reales acelera hasta x10.
  state.progressMs=Math.min(state.routeDurationMs,state.progressMs+delta*speed);
  if(state.progressMs>=state.routeDurationMs){
   const end=state.points[state.points.length-1];
   renderRoute(1);
   state.phase='orbit';state.orbitElapsedMs=0;state.orbitView=-1;
   state.orbitStartHeading=normHeading(state.filteredHeading+350);
   state.lastPaint=0;renderOrbit(0);
  }else if(now-state.lastPaint>=50){
   state.lastPaint=now;
   renderRoute(state.progressMs/state.routeDurationMs);
  }
 }else if(state.phase==='orbit'){
  state.orbitElapsedMs=Math.min(state.orbitDurationMs,state.orbitElapsedMs+delta*Math.min(speed,3));
  if(state.orbitElapsedMs>=state.orbitDurationMs){
   renderOrbit(1);finishFlight();return;
  }else if(now-state.lastPaint>=50){
   state.lastPaint=now;
   renderOrbit(state.orbitElapsedMs/state.orbitDurationMs);
  }
 }
 if(state.playing&&!state.paused)state.frameId=requestAnimationFrame(renderTick);
}
function flightStart(){
 stopFrame();
 state.progressMs=0;state.orbitElapsedMs=0;state.filteredHeading=null;state.orbitView=-1;
 state.turnLastTs=0;state.magicLastAt=0;state.cameraFaulted=false;
 state.phase='takeoff';state.playing=true;state.paused=false;
 state.takeoffMs=0;state.takeoffDurationMs=2600;
 const previewSpan=Math.min(.035,75/Math.max(1,state.routeLength));
 state.takeoffBearing=heading(routePosition(0),routePosition(previewSpan));
 state.routeDurationMs=Math.max(42000,Math.min(85000,state.routeLength/28*1000));
 state.orbitDurationMs=23000;
 state.lastFrame=getNow();state.lastPaint=0;
 $('pause').textContent='⏸ Pausar';
 renderTakeoff(0);
 state.frameId=requestAnimationFrame(renderTick);
}
async function fly(){
 if(!state.loaded){error('Debes conectar primero Google Maps 3D.');return}
 if(state.playing||state.paused||state.busy||state.overview)return;
 state.busy=true;clearError();
 $('launch').disabled=true;$('launch').textContent='Preparando mapa y ruta…';
 let destination;
 try{
  await locateClinicOrigin();
  destination=await getDestination();
  await improveRoute(destination);
 }catch(e){
  error('No se ha podido preparar el vuelo: '+(e.message||String(e)));
  $('launch').textContent='✦ Comenzar vuelo mágico';
  $('launch').disabled=false;state.busy=false;return;
 }
 state.busy=false;state.flightToken++;
 state.points=destination.points;state.activeDestination=destination;
 state.custom=!!destination.custom;
 buildRouteLengths(state.points);
 // Optional elevation sample lets the camera fly low over varied terrain.
 // If this API is not enabled, the flight still starts with the fallback.
 await prepareTerrain();
 $('setup').classList.add('off');
 $('flightUI').hidden=false;$('arrival').hidden=true;
 // Use photorealistic Google's buildings, NOT procedurally modelled houses.
 // The 2D screen-space vector balloon intentionally stays visible on top.
 $('balloon').hidden=false;
 $('balloon').classList.toggle('fx-off',!state.effectsOn);
 $('routeMode').textContent=state.routeSource==='google'
    ?'CAMINO DE ESTRELLAS · CALLES REALES'
    :'CAMINO MÁGICO · TRAYECTO APROXIMADO';
 $('launch').textContent='✦ Comenzar vuelo mágico';
 $('launch').disabled=false;
 $('travelLabel').textContent=state.originLabel.toUpperCase()+' → '+destination.label.toUpperCase();
 $('originBadge').textContent=state.clinicVerified?'SALIDA · '+state.clinicName:state.originLabel;
 makePolyline(state.points,destination);
 try{state.map.stopCameraAnimation()}catch(e){}
 status('VISTA GENERAL · RECORRIDO COMPLETO');
 progress(0,1);
 enterOverview({intro:true});
}
function pause(){
 if(!state.playing||state.overview)return;
 if(!state.paused){
  blowBoost.stop();renderBlowUi(1,'Micrófono apagado durante la pausa');
  state.paused=true;stopFrame();
  $('pause').textContent='▶ Continuar';status('VUELO EN PAUSA');
 }else{
  state.paused=false;state.lastFrame=getNow();state.lastPaint=0;state.turnLastTs=0;
  $('pause').textContent='⏸ Pausar';
  status(state.phase==='orbit'?'VISTAS DEL DESTINO':'VUELO 3D · ALTURA ESTABLE');
  state.frameId=requestAnimationFrame(renderTick);
 }
}
function restart(){
 blowBoost.stop();renderBlowUi();
 explorer.disable(false);
 $('povToggle').hidden=true;
 stopFrame();clearTimeout(state.overviewTimer);state.overviewTimer=0;state.overview=false;
 $('atlasFrame').hidden=true;
 state.flightToken++;state.playing=false;state.paused=false;state.busy=false;
 state.phase='idle';state.progressMs=0;state.orbitElapsedMs=0;state.takeoffMs=0;
 state.overviewSnapshot=null;
 clearRouteMap();createOriginMarker();
 state.filteredHeading=null;state.orbitView=-1;state.turnLastTs=0;
 state.terrainSamples=[];
 $('pause').textContent='⏸ Pausar';
 $('balloon').hidden=true;$('balloon').style.opacity='1';
 $('flightUI').hidden=true;$('arrival').hidden=true;
 $('setup').classList.remove('off');$('launch').disabled=!state.loaded;
 $('travelLabel').textContent=state.originLabel.toUpperCase()+' → '+(state.activeDestination?.label||routes[state.route].label).toUpperCase();
 $('overviewToggle').textContent='🗺 Ver recorrido completo';
 $('overviewToggle').setAttribute('aria-pressed','false');
 if(state.loaded){resetCamera();status('GOOGLE MAPS · FOTOGRAFÍA 3D')}
 progress(0,1);
}
const explorer=installLook360({
 state,$,now:getNow,norm:normHeading,shortest:shortestTurn,
 routeProgress:()=>state.phase==='orbit'?1:clamp01(state.progressMs/Math.max(1,state.routeDurationMs)),
 routePoint:()=>state.phase==='orbit'?state.points.at(-1)
  :cameraPoint(clamp01(state.progressMs/Math.max(1,state.routeDurationMs))),
 terrainAt:terrainAltitudeAt,
 headingNow:()=>state.phase==='orbit'
  ?state.orbitStartHeading:((state.filteredHeading??state.takeoffBearing)-9),
 restoreCamera:()=>{
  if(state.phase==='route')renderRoute(clamp01(state.progressMs/Math.max(1,state.routeDurationMs)));
  else if(state.phase==='orbit')renderOrbit(state.orbitElapsedMs/state.orbitDurationMs);
  else if(state.phase==='takeoff')renderTakeoff(state.takeoffMs/state.takeoffDurationMs);
 },
 notify:info,onPause:pause
});
$('launch').addEventListener('click',fly);
$('overviewToggle').addEventListener('click',toggleOverview);
$('pause').addEventListener('click',pause);
$('blowToggle').addEventListener('click',toggleBlow);
$('povBlowToggle').addEventListener('click',toggleBlow);
$('restart').addEventListener('click',restart);
$('again').addEventListener('click',restart);
$('nightToggle').addEventListener('click',()=>{
 state.day=!state.day;
 document.documentElement.classList.toggle('night-active',!state.day);
 cinema.setNight(!state.day);
 state.streetNight?.setNight(!state.day);
 state.enchantedRoofs?.setNight(!state.day);
 $('nightToggle').textContent=state.day?'☾ Ver de noche':'☀ Ver de día';
 $('nightToggle').setAttribute('aria-pressed',String(!state.day));
 info(state.day?'Fotogrametría de día.':'Vuelo nocturno recreado sobre la ciudad 3D real.');
});
$('fxToggle').addEventListener('click',()=>{
 state.effectsOn=!state.effectsOn;
 $('dustLayer').classList.toggle('fx-off',!state.effectsOn);
 $('balloon').classList.toggle('fx-off',!state.effectsOn);
 state.streetNight?.setMagic(state.effectsOn);
 state.enchantedRoofs?.setMagic(state.effectsOn);
 for(const marker of state.fireflies){
  try{if(state.effectsOn&&!marker.isConnected)state.map?.append(marker);
   if(!state.effectsOn&&marker.isConnected)marker.remove()}catch(e){}
 }
 updateMagicTrail(state.phase==='orbit'?1:state.progressMs/Math.max(1,state.routeDurationMs),getNow(),true);
 $('fxToggle').textContent=state.effectsOn?'✨ Magia ON':'✨ Magia OFF';
});

document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
  blowBoost.stop();renderBlowUi();
  if(state.playing&&!state.paused)pause();
 }
});
window.addEventListener('pagehide',()=>{blowBoost.stop();cinema.stop()});
for(let i=0;i<27;i++){
 const el=document.createElement('i');
 el.style.left=(i*37%100)+'%';el.style.top=(i*53%100)+'%';
 el.style.animationDelay=(-(i*.43))+'s';
 $('dustLayer').append(el);
}
setActiveChoice('plaza');
renderBlowUi();
try{
 const clinic=JSON.parse(localStorage.getItem('vp_clinic_origin')||'null');
 if(clinic&&typeof clinic.name==='string'&&typeof clinic.address==='string'){
  $('clinicName').value=clinic.name;
  $('clinicAddress').value=clinic.address;
 }
 updateClinicSummary();
}catch(e){console.warn('Clinic setting unavailable',e)}
try{
 const cached=sessionStorage.getItem('vp_google3d_trial_key');
 if(cached&&cached.startsWith('AIza')){
  $('apiKey').value=cached;
  // Restore the existing Maps session automatically after an update.
  setTimeout(()=>{if(!state.loaded&&!state.mapLoading)connectGoogle()},200);
}
}catch(e){}
