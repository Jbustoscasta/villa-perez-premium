import {NativeFlightScene,calculateStreetRoute,interpolate as geoLerp} from './flight-native.mjs?v=2.0.0';
/*
 * Villa Pérez Google 3D experiment.
 * Google Maps JS API 3D / Map3DElement / native Model3DElement.
 * Nothing is sent to a Villa Pérez backend. Public demo destinations are hardcoded.
 * User-entered addresses are sent only to Google Geocoding when the adult submits them.
 * API key is held in sessionStorage of this tab; never committed, logged, or put in URL.
 */
const $=id=>document.getElementById(id);
const START={lat:40.42016,lng:-3.68845};
const routes={
 plaza:{
  label:'Plaza Mayor',points:[
   START,{lat:40.41894,lng:-3.69218},{lat:40.41870,lng:-3.69533},
   {lat:40.41800,lng:-3.70022},{lat:40.41695,lng:-3.70382},
   {lat:40.41596,lng:-3.70569},{lat:40.41536,lng:-3.70737}
  ],chapters:['Sobre los tejados','La ciudad se ilumina','Madrid desde el cielo','Una luz hacia Sol','Rumbo a Plaza Mayor','Ya casi llegamos']
 },
 bernabeu:{
  label:'Santiago Bernabéu',points:[START,
   {lat:40.42522,lng:-3.68978},{lat:40.43360,lng:-3.69022},
   {lat:40.43920,lng:-3.69012},{lat:40.44472,lng:-3.68936},
   {lat:40.44929,lng:-3.68842},{lat:40.45306,lng:-3.68832}
  ],chapters:['Madrid despierta','Por el eje del Prado','La Castellana bajo el globo','Sobre el corazón de Madrid','Los últimos tejados','Llegamos al estadio']
 },
 arroyofresno:{
  label:'Arroyo Fresno',points:[START,
   {lat:40.4268,lng:-3.6898},{lat:40.4385,lng:-3.6947},
   {lat:40.4465,lng:-3.7067},{lat:40.4554,lng:-3.7158},
   {lat:40.4652,lng:-3.7260},{lat:40.4787,lng:-3.7347}
  ],chapters:['Despegamos de Madrid','El globo toma altura','Los barrios de Madrid','Cruzando nuevas avenidas','La ciudad se abre','Un secreto en tu barrio']
 }
};
const state={
 loaded:false,map:null,Polyline3DElement:null,mapLoading:false,route:'plaza',
 custom:false,points:[],end:null,segment:0,flightToken:0,animationCleanup:null,
 playing:false,paused:false,activeDestination:null,timeout:null,dusk:false,apiKey:'',
 phase:'idle',progressMs:0,routeDurationMs:72000,orbitDurationMs:22000,
 orbitElapsedMs:0,frameId:0,lastFrame:0,lastPaint:0,filteredHeading:null,
 native:null,Model3DElement:null,Marker3DElement:null,routeSource:'panoramica',effectsOn:true,
 routeDistances:[],routeLength:0,orbitStartHeading:0,orbitView:-1,busy:false
};
const R=Earth=>Earth*Math.PI/180;
function distance(a,b){
 const phi1=R(a.lat),phi2=R(b.lat),dphi=R(b.lat-a.lat),dl=R(b.lng-a.lng);
 return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dphi/2)**2+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dl/2)**2)));
}
function lerp(a,b,t){return {lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t}}
function heading(a,b){const y=Math.sin(R(b.lng-a.lng))*Math.cos(R(b.lat)),x=Math.cos(R(a.lat))*Math.sin(R(b.lat))-Math.sin(R(a.lat))*Math.cos(R(b.lat))*Math.cos(R(b.lng-a.lng));return (Math.atan2(y,x)*180/Math.PI+360)%360}
function smoothCustom(end){
 const dist=distance(START,end),cut=Math.min(.85,Math.max(0,1-180/Math.max(dist,181)));
 const stop=lerp(START,end,cut);
 const points=[START],n=Math.min(10,Math.max(5,Math.ceil(dist/500)));
 for(let i=1;i<n;i++){
  const t=i/n,a=lerp(START,stop,t);
  // Gentle cinematic detour; not a road-navigation geometry.
  const curvature=Math.min(.00065,dist/10000000)*Math.sin(Math.PI*t);
  const ang=Math.atan2(stop.lng-START.lng,stop.lat-START.lat)+Math.PI/2;
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
 $('travelLabel').textContent='PUERTA DE ALCALÁ → '+routes[choice].label.toUpperCase();
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
   map.style.cssText='width:100%;height:100%;display:block;';
   map.addEventListener('gmp-error',ev=>{
     console.warn('3D map initialization event:',ev);
     status('ERROR GOOGLE 3D');
     info('Google Maps 3D ha comunicado un error. Comprueba API key, facturación y restricciones del dominio.');
   });
   $('mapHost').appendChild(map);
   $('beforeMap').hidden=true;
   let rendered3d=false;
   map.addEventListener('gmp-steadychange',event=>{
     if(event.isSteady){rendered3d=true;status('GOOGLE 3D · ESCENA CARGADA');}
   });
   setTimeout(()=>{
     if(state.loaded&&!rendered3d&&!state.playing)
       info('La cartografía 3D sigue cargando. Si la pantalla permanece vacía, revisa la cobertura y permisos de Google Cloud.');
   },25000);
   state.loaded=true;
   try{sessionStorage.setItem('vp_google3d_trial_key',key)}catch(e){}
   $('keyGroup').classList.add('connected');
   $('setup').classList.add('ready');
   $('connect').textContent='✓ Google Maps 3D conectado';
   $('launch').disabled=false;
   status('GOOGLE MAPS · FOTOGRAFÍA 3D');
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
async function getDestination(){
 const text=$('address').value.trim();
 if(!text){state.custom=false;return {
 points:routes[state.route].points,label:routes[state.route].label,
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
 if(distance(START,end)>80000)throw new Error('Para esta prueba el destino debe estar a menos de 80 km de Madrid.');
 return {points:smoothCustom(end),trueEnd:end,label:'destino elegido',custom:true};
}
async function improveRoute(destination){
 // Route.computeRoutes is the current Google route API, and may require a
 // separately enabled Google Routes API. Do not block the parent when unavailable.
 const attempt=calculateStreetRoute(START,destination.trueEnd,!!destination.custom);
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
function makePolyline(points){
 if(!state.Polyline3DElement||!state.map)return;
 try{
  const existing=state.map.querySelector('#vpRoute3d');if(existing)existing.remove();
  const line=new state.Polyline3DElement({
   path:points.map(p=>({...p,altitude:4})),
   strokeColor:'#97b5b3',outerColor:'#244854',
   strokeWidth:3,outerWidth:.3,altitudeMode:'RELATIVE_TO_GROUND',
   drawsOccludedSegments:false
  });
  line.id='vpRoute3d';state.map.append(line);
 }catch(e){console.warn('Ruta dibujada no disponible en esta versión de Maps 3D',e)}
}
/*
 * Google flyCameraTo uses an arcing, parabolic trajectory. On every waypoint
 * this appeared as an unwanted repeated rise-and-fall. For the route we now
 * interpolate the map camera directly at a constant RANGE and TILT.
 * The panorama ends with an orbit on the same fixed camera distance.
 */
const CAMERA={altitude:750,range:550,tilt:74};
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
function stopFrame(){if(state.frameId){cancelAnimationFrame(state.frameId);state.frameId=0}}
function resetCamera(){
 if(!state.map)return;
 try{
  state.map.stopCameraAnimation();
  state.map.center={lat:START.lat,lng:START.lng,altitude:CAMERA.altitude};
  state.map.range=CAMERA.range;
  state.map.heading=244;
  state.map.tilt=CAMERA.tilt;
 }catch(e){console.warn('Camera reset unavailable:',e)}
}
function setCamera(point,headingAngle){
 if(!state.map)return;
 // Keep height AND distance strictly constant; no keyframed zooms or vertical bobs.
 try{
  state.map.center={lat:point.lat,lng:point.lng,altitude:CAMERA.altitude};
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
 if(!points?.length)return START;
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
}
function scene(n,total){
 const names=state.custom
  ?['Despegamos de Madrid','Sobre las avenidas','Rumbo a tus calles','Luces en el camino','¿Reconoces el barrio?','Últimos metros secretos']
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
function nativeFallback(reason){
 console.warn('GLB fallback:',reason);
 state.native?.reset();state.native=null;
 $('balloon').hidden=false;
 $('modelMode').textContent='GLOBO PNG · PULSA PARA 3D';
}
function safeNativePose(method,...params){
 if(!state.native)return;
 try{state.native[method](...params)}catch(e){nativeFallback(e?.message||e)}
}
function switchGlobe(){
 if(!state.loaded||!state.playing||state.phase==='done')return;
 if(state.native){nativeFallback('Seleccionado por el usuario');return}
 try{
  const scene=new NativeFlightScene(state.map,{
    Model3DElement:state.Model3DElement,
    Marker3DElement:state.Marker3DElement,
    Polyline3DElement:state.Polyline3DElement
  },()=>nativeFallback('Error del modelo 3D'));
  scene.create();scene.setEffects(state.effectsOn);
  state.native=scene;$('balloon').hidden=true;
  $('modelMode').textContent='GLOBO 3D · OCLUSIÓN NATIVA';
 }catch(e){nativeFallback(e?.message||e)}
}
function renderRoute(t){
 const p=clamp01(t);
 const here=routePosition(p);
 const before=routePosition(Math.max(0,p-.003));
 const after=routePosition(Math.min(1,p+.003));
 const desired=heading(before,after);
 if(state.filteredHeading===null||!Number.isFinite(state.filteredHeading))state.filteredHeading=desired;
 else state.filteredHeading=normHeading(state.filteredHeading+shortestTurn(state.filteredHeading,desired)*.19);
 // Aim just ahead of the globo, keeping the street geometry recognizable.
 const lookAhead=routePosition(Math.min(1,p+.006));
 setCamera(geoLerp(here,lookAhead,.18),state.filteredHeading+350);
 safeNativePose('pose',here,state.filteredHeading,p,routePosition,getNow());
 progress(p*.82,1);
 scene(p,1);
}
function renderOrbit(t){
 const p=clamp01(t);
 const waypoint=state.points[state.points.length-1];
 // Four recognizable perspectives, one full turn, no height/range changes.
 setCamera(waypoint,state.orbitStartHeading+p*360);
 safeNativePose('orbit',waypoint,p,state.orbitStartHeading+p*360,getNow());
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
 stopFrame();state.playing=false;state.paused=false;state.phase='done';
 state.native?.reset();state.native=null;
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
 // Safari sometimes backgrounds a frame for seconds: prevent skipping the film.
 delta=Math.min(90,delta);
 state.lastFrame=now;
 if(state.phase==='route'){
  state.progressMs=Math.min(state.routeDurationMs,state.progressMs+delta);
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
  state.orbitElapsedMs=Math.min(state.orbitDurationMs,state.orbitElapsedMs+delta);
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
 state.cameraFaulted=false;
 state.phase='route';state.playing=true;state.paused=false;
 state.routeDurationMs=Math.max(44000,Math.min(98000,state.routeLength/22*1000));
 state.orbitDurationMs=21000;
 state.lastFrame=getNow();state.lastPaint=0;
 $('pause').textContent='⏸ Pausar';
 renderRoute(0);
 state.frameId=requestAnimationFrame(renderTick);
}
async function fly(){
 if(!state.loaded){error('Debes conectar primero Google Maps 3D.');return}
 if(state.playing||state.paused||state.busy)return;
 state.busy=true;clearError();
 $('launch').disabled=true;$('launch').textContent='Buscando calles reales…';
 let destination;
 try{destination=await getDestination()}
 catch(e){
  error('No se ha podido localizar el destino: '+(e.message||String(e)));
  $('launch').textContent='✦ Despegar sobre Madrid';
  $('launch').disabled=false;state.busy=false;return;
 }
 state.busy=false;state.flightToken++;
 await improveRoute(destination);
 state.points=destination.points;state.activeDestination=destination;
 state.custom=!!destination.custom;
 buildRouteLengths(state.points);
 $('setup').classList.add('off');
 $('flightUI').hidden=false;$('arrival').hidden=true;
 // True 3D glTF asset is depth-tested with the Google scene.
 state.native?.reset();state.native=null;
 try{
  const native=new NativeFlightScene(state.map,{
    Model3DElement:state.Model3DElement,
    Marker3DElement:state.Marker3DElement,
    Polyline3DElement:state.Polyline3DElement
  },()=>nativeFallback('Modelo 3D no disponible'));
  native.create();native.setEffects?.(state.effectsOn);
  state.native=native;
  $('balloon').hidden=true;
  $('modelMode').textContent='GLOBO 3D · OCLUSIÓN NATIVA';
 }catch(e){
  console.warn('3D balloon unavailable; showing flat compatibility picture',e);
  $('balloon').hidden=false;
  $('modelMode').textContent='GLOBO PNG · COMPATIBILIDAD';
 } 
 $('routeMode').textContent=state.routeSource==='google'
    ?'RUTA POR CALLES REALES · GOOGLE'
    :'VUELO PANORÁMICO · RUTA APROXIMADA';
 $('launch').textContent='✦ Despegar sobre Madrid';
 $('launch').disabled=false;
 $('travelLabel').textContent='PUERTA DE ALCALÁ → '+destination.label.toUpperCase();
 makePolyline(state.points);
 try{state.map.stopCameraAnimation()}catch(e){}
 status('VUELO 3D · ALTURA ESTABLE');
 flightStart();
}
function pause(){
 if(!state.playing)return;
 if(!state.paused){
  state.paused=true;stopFrame();
  $('pause').textContent='▶ Continuar';status('VUELO EN PAUSA');
 }else{
  state.paused=false;state.lastFrame=getNow();state.lastPaint=0;
  $('pause').textContent='⏸ Pausar';
  status(state.phase==='orbit'?'VISTAS DEL DESTINO':'VUELO 3D · ALTURA ESTABLE');
  state.frameId=requestAnimationFrame(renderTick);
 }
}
function restart(){
 stopFrame();
 state.flightToken++;state.playing=false;state.paused=false;state.busy=false;
 state.phase='idle';state.progressMs=0;state.orbitElapsedMs=0;
 state.native?.reset();state.native=null;
 state.filteredHeading=null;state.orbitView=-1;
 $('pause').textContent='⏸ Pausar';
 $('balloon').hidden=true;$('flightUI').hidden=true;$('arrival').hidden=true;
 $('setup').classList.remove('off');$('launch').disabled=!state.loaded;
 $('travelLabel').textContent='PUERTA DE ALCALÁ → '+(state.activeDestination?.label||routes[state.route].label).toUpperCase();
 if(state.loaded){resetCamera();status('GOOGLE MAPS · FOTOGRAFÍA 3D')}
 progress(0,1);
}
function toggleTwilight(){
 state.dusk=!state.dusk;
 $('cinemaGrade').classList.toggle('twilight',state.dusk);
 $('twilight').textContent=state.dusk?'☀ Aclarar':'☾ Oscurecer';
 info(state.dusk
   ? 'Oscurecimiento de ficción sobre fotografía aérea diurna real.'
   : 'Fotografía aérea con iluminación original.');
}
$('launch').addEventListener('click',fly);
$('pause').addEventListener('click',pause);
$('restart').addEventListener('click',restart);
$('again').addEventListener('click',restart);
$('twilight').addEventListener('click',toggleTwilight);
$('modelMode').addEventListener('click',switchGlobe);
$('fxToggle').addEventListener('click',()=>{
 state.effectsOn=!state.effectsOn;
 state.native?.setEffects?.(state.effectsOn);
 $('fxToggle').textContent=state.effectsOn?'✨ Magia ON':'✨ Magia OFF';
});

document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&state.playing&&!state.paused)pause();
});
for(let i=0;i<27;i++){
 const el=document.createElement('i');
 el.style.left=(i*37%100)+'%';el.style.top=(i*53%100)+'%';
 el.style.animationDelay=(-(i*.43))+'s';
 $('dustLayer').append(el);
}
setActiveChoice('plaza');
try{
 const cached=sessionStorage.getItem('vp_google3d_trial_key');
 if(cached&&cached.startsWith('AIza')){
  $('apiKey').value=cached;
  // Restore the existing Maps session automatically after an update.
  setTimeout(()=>{if(!state.loaded&&!state.mapLoading)connectGoogle()},200);
}
}catch(e){}
