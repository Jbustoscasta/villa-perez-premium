/*
 * Villa Pérez Google 3D experiment.
 * Google Maps JS API 3D / Map3DElement / flyCameraTo.
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
 playing:false,paused:false,activeDestination:null,timeout:null,dusk:false,apiKey:''
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
   const {Map3DElement,Polyline3DElement}=await google.maps.importLibrary('maps3d');
   state.Polyline3DElement=Polyline3DElement;
   const map=new Map3DElement({
     center:{lat:START.lat,lng:START.lng,altitude:755},
     heading:244,tilt:70,range:900,mode:'SATELLITE',
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
 if(!text){state.custom=false;return {points:routes[state.route].points,label:routes[state.route].label};}
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
 return {points:smoothCustom(end),label:'destino elegido',custom:true};
}
function makePolyline(points){
 if(!state.Polyline3DElement||!state.map)return;
 try{
  const existing=state.map.querySelector('#vpRoute3d');if(existing)existing.remove();
  const line=new state.Polyline3DElement({
   path:points.map(p=>({...p,altitude:4})),
   strokeColor:'#ffe4a4',outerColor:'#a56f38',
   strokeWidth:6,outerWidth:.42,altitudeMode:'RELATIVE_TO_GROUND',
   drawsOccludedSegments:true
  });
  line.id='vpRoute3d';state.map.append(line);
 }catch(e){console.warn('Ruta dibujada no disponible en esta versión de Maps 3D',e)}
}
function camera(point,next,index,total){
 // Madrid lies ~600–750m above sea level. Reducing altitude to 300m would
 // push the 3D camera target BELOW the city's ground. We lower the flight
 // visually by reducing camera RANGE, keeping a safe altitude above terrain.
 const bearing=heading(point,next||point);
 const last=index===total-1,first=index<2;
 return {
   center:{lat:point.lat,lng:point.lng,altitude:755},
   heading:(bearing+347)%360,
   tilt:last?68:72,
   range:last?565:first?830:650
 };
}
function resetCamera(){
 try{
  state.map.stopCameraAnimation();
  state.map.center={lat:START.lat,lng:START.lng,altitude:755};
  state.map.range=900;state.map.heading=244;state.map.tilt=70;
 }catch(e){console.warn('Camera reset not available:',e)}
}
function progress(n,total){
 const pct=Math.round(n/Math.max(1,total)*100);
 $('progressLabel').textContent=pct+'%';
 $('progressFill').style.width=pct+'%';
}
function scene(n,total){
 const names=state.custom?['Despegamos de Villa Pérez','Madrid desde lo alto','Rumbo a tus calles','Luces en el camino','¿Reconoces el barrio?','Últimos metros secretos']:routes[state.route].chapters;
 const chapter=Math.min(names.length-1,Math.floor(n/Math.max(1,total)*names.length));
 $('chapterEyebrow').textContent='EN BUSCA DEL DIENTE · CAPÍTULO '+(chapter+1);
 $('chapterTitle').textContent=names[chapter];
 $('chapterDescription').textContent=[
  'Volamos sobre calles, tejados y edificios reales.',
  'El globo avanza sobre la geografía de Madrid.',
  'Mira cómo cambia la perspectiva al girar la cámara.',
  'Ya se distinguen nuevas avenidas y edificios.',
  'Muy pronto reconocerás las calles del destino.',
  'El último tramo será invisible por privacidad.'
 ][chapter];
}
function waitAnimation(duration,token){
 return new Promise(resolve=>{
  let done=false,timeout;
  function finish(){
   if(done)return;done=true;clearTimeout(timeout);
   state.map?.removeEventListener('gmp-animationend',finish);
   if(state.animationCleanup===finish)state.animationCleanup=null;
   resolve();
  }
  state.animationCleanup=finish;
  state.map.addEventListener('gmp-animationend',finish,{once:true});
  timeout=setTimeout(finish,duration+1800);
 });
}
async function fly(){
 if(!state.loaded){error('Debes conectar primero Google Maps 3D.');return;}
 if(state.playing)return;
 clearError();$('launch').disabled=true;$('launch').textContent='Buscando destino…';
 let destination;
 try{destination=await getDestination();}
 catch(e){error('No se ha podido localizar el destino: '+(e.message||String(e)));$('launch').textContent='✦ Despegar sobre Madrid';$('launch').disabled=false;return;}
 const token=++state.flightToken;
 state.playing=true;state.paused=false;state.points=destination.points;
 state.activeDestination=destination;
 state.segment=0;
 $('setup').classList.add('off');$('flightUI').hidden=false;
 $('balloon').hidden=false;$('arrival').hidden=true;
 $('launch').textContent='✦ Despegar sobre Madrid';
 $('launch').disabled=false;
 $('travelLabel').textContent='PUERTA DE ALCALÁ → '+destination.label.toUpperCase();
 makePolyline(destination.points);
 resetCamera();progress(0,destination.points.length-1);scene(0,destination.points.length-1);
 status('VUELO 3D · EN CURSO');
 await flyFrom(0,token);
}
async function flyFrom(from,token){
 const list=state.points;
 for(let i=from;i<list.length-1;i++){
  if(!state.playing||state.paused||token!==state.flightToken)return;
  state.segment=i;scene(i,list.length-1);progress(i,list.length-1);
  const endCamera=camera(list[i+1],list[i+2]||list[i+1],i+1,list.length);
  const d=distance(list[i],list[i+1]);
  const duration=Math.min(16000,Math.max(6800,d/2.2*1000)); // geographical camera flight, not real travel speed
  try{
   const end=waitAnimation(duration,token);
   await state.map.flyCameraTo({endCamera,durationMillis:duration});
   await end;
  }catch(e){
   console.warn('Google camera flyCameraTo failure',e);
   if(state.playing&&!state.paused&&token===state.flightToken){
    try{state.map.center=endCamera.center;state.map.heading=endCamera.heading;state.map.range=endCamera.range;state.map.tilt=endCamera.tilt;}catch{}
   }
  }
 }
 if(token===state.flightToken&&state.playing&&!state.paused){
  progress(list.length-1,list.length-1);
  state.playing=false;state.paused=false;
  $('balloon').hidden=true;$('flightUI').hidden=true;$('arrival').hidden=false;
  status('MISIÓN COMPLETADA');
 }
}
function pause(){
 if(!state.playing&&!state.paused)return;
 if(!state.paused){
  state.paused=true;state.playing=false;state.flightToken++;
  try{state.map.stopCameraAnimation()}catch{}
  state.animationCleanup?.();
  $('pause').textContent='▶ Continuar';status('VUELO EN PAUSA');
 }else{
  state.paused=false;state.playing=true;
  $('pause').textContent='⏸ Pausar';status('VUELO 3D · EN CURSO');
  const token=++state.flightToken;
  // Resume from the most recently completed waypoint.
  flyFrom(state.segment,token);
 }
}
function restart(){
 state.flightToken++;state.playing=false;state.paused=false;
 try{state.map?.stopCameraAnimation()}catch{}
 state.animationCleanup?.();
 $('pause').textContent='⏸ Pausar';
 $('balloon').hidden=true;$('flightUI').hidden=true;$('arrival').hidden=true;
 $('setup').classList.remove('off');
 if(state.loaded){resetCamera();status('GOOGLE MAPS · FOTOGRAFÍA 3D');}
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
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&state.playing)pause();
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
 if(cached&&cached.startsWith('AIza'))$('apiKey').value=cached;
}catch(e){}
