import {APP_CONFIG as CFG} from './config.js';
import {createPath,pointAt,validCoordinate,compactAddress,formatDistance,postcardSvg,trailParticles,routeBearing,cinematicProgress,cinematicPhase,publicFacingRoute,nearestPublicLandmark} from './route-utils.mjs';

const $ = id => document.getElementById(id);
const screens = ['welcome','address','route','arrival'];
const state = {
  screen:'welcome', clinic:CFG.clinic,
  origin:{label:CFG.clinic.originLabel,coordinate:CFG.clinic.origin?.slice()||null},
  destination:{label:'',coordinate:null},
  map:null,ml:null,mouseMarker:null,originMarker:null,homeMarker:null,
  route:null,path:null,mapPath:null,isDemo:false,landmark:null,landmarkShown:false,landmarkTimer:0,introTimer:0,arrivalShown:false,
  soundOn:false,audioCtx:null,durationMs:CFG.stageDurationSeconds*1000,progress:0,
  playing:false,startTime:0,frame:0,follow:true,cinematic:true,lastPaint:0,lastStage:-1,lastCamera:0,
  reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false
};

function showScreen(name) {
  state.screen=name;
  screens.forEach(s=>$( `screen-${s}` ).classList.toggle('active',s===name));
  window.scrollTo({top:0,behavior:'instant'});
  if(name==='route' && state.map) setTimeout(()=>state.map.resize(),120);
}
function errorMessage(msg) { const node=$('form-error');node.textContent=msg;node.classList.remove('hidden');node.scrollIntoView({block:'nearest'}); }
function clearError() { $('form-error').textContent='';$('form-error').classList.add('hidden'); }
function setBusy(on){const b=$('calculate');b.disabled=on;b.textContent=on?'Calculando recorrido real…':'Calcular mi viaje mágico →';}
function sanitizePhoton(feature){
  if(!feature?.geometry || feature.geometry.type!=='Point' || !validCoordinate(feature.geometry.coordinates)) return null;
  return {coordinate:feature.geometry.coordinates.slice(0,2),label:compactAddress(feature)||'Dirección encontrada'};
}
function shortPlace(s) {return String(s||'').split(' · ')[0];}
function updateConfig(){
  $('welcome-clinic').textContent=CFG.clinic.name;
  $('origin-clinic').textContent=CFG.clinic.name;
  $('recap-clinic').textContent=CFG.clinic.name;
  $('origin-address').value=CFG.clinic.originLabel.replace(' · ORIGEN DE PRUEBA','');
  $('origin-demo-hint').textContent=CFG.clinic.demo?'Punto de salida provisional, NO dirección real de la clínica. Cámbialo para probarla.':'Dirección registrada por la clínica. Puedes corregirla para esta prueba.';
  const facade=$('facade');facade.src=CFG.assets.facade;facade.onerror=()=>{facade.style.display='none';};
}

async function fetchJson(url,ms=11000,signal) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),ms);
  const onAbort=()=>controller.abort();
  signal?.addEventListener('abort',onAbort,{once:true});
  try {
    const res=await fetch(url,{signal:controller.signal,headers:{'Accept':'application/json'},cache:'no-store',referrerPolicy:'strict-origin-when-cross-origin'});
    if(!res.ok) throw new Error(`Servicio de mapas no disponible (${res.status})`);
    return await res.json();
  } finally { clearTimeout(timeout);signal?.removeEventListener('abort',onAbort); }
}
function setupAutocomplete(field,box,key) {
  const input=$(field),dropdown=$(box);
  let debounce,ongoing=null,serial=0;
  input.addEventListener('input',()=>{
    state[key]={label:input.value,coordinate:null};
    clearError();
    dropdown.classList.add('hidden');dropdown.replaceChildren();
    clearTimeout(debounce);ongoing?.abort();
    // Invalidate older responses even when a user clears or shortens the text.
    const seq=++serial;
    const value=input.value.trim(); if(value.length<4)return;
    debounce=setTimeout(async()=>{
      const controller=new AbortController();ongoing=controller;
      try {
        const url=new URL(CFG.services.geocoder);url.searchParams.set('q',value);url.searchParams.set('limit','5');url.searchParams.set('lang','es');
        // Sesgo geográfico: sirve para España, sin obligar a vivir junto a la clínica.
        if(validCoordinate(state.origin.coordinate)) {url.searchParams.set('lat',String(state.origin.coordinate[1]));url.searchParams.set('lon',String(state.origin.coordinate[0]));}
        const json=await fetchJson(url.toString(),8500,controller.signal);
        if(serial!==seq || input.value.trim()!==value) return;
        const places=(json.features||[]).map(sanitizePhoton).filter(Boolean);
        dropdown.replaceChildren();
        for(const place of places){
          const btn=document.createElement('button');btn.type='button';btn.className='suggestion';btn.setAttribute('role','option');
          btn.textContent=place.label;
          btn.addEventListener('click',()=>{
            state[key]={...place};input.value=place.label;dropdown.classList.add('hidden');dropdown.replaceChildren();clearError();
            if(key==='origin') $('origin-demo-hint').textContent='Origen seleccionado para esta misión (no modifica la clínica permanentemente).';
          });dropdown.appendChild(btn);
        }
        if(places.length)dropdown.classList.remove('hidden');
        else { const notice=document.createElement('div');notice.className='suggestion';notice.textContent='Sin coincidencias. Añade localidad y número.';dropdown.appendChild(notice);dropdown.classList.remove('hidden'); }
      } catch(e){
        if(controller.signal.aborted)return;
        dropdown.replaceChildren();const note=document.createElement('div');note.className='suggestion';note.textContent='No se pudieron buscar direcciones. Revisa tu conexión.';dropdown.appendChild(note);dropdown.classList.remove('hidden');
      }
    },550);
  });
  input.addEventListener('keydown',e=>{if(e.key==='Escape') dropdown.classList.add('hidden');});
  document.addEventListener('click',e=>{if(!input.contains(e.target)&&!dropdown.contains(e.target)) dropdown.classList.add('hidden');});
}

async function routeBetween(start,end){
  if(Math.abs(start[0]-end[0])<.00001 && Math.abs(start[1]-end[1])<.00001) throw new Error('Elige una dirección distinta de la clínica.');
  const coords=`${start[0].toFixed(6)},${start[1].toFixed(6)};${end[0].toFixed(6)},${end[1].toFixed(6)}`;
  const url=CFG.services.router+coords+'?overview=full&geometries=geojson&steps=false&alternatives=false';
  const json=await fetchJson(url,13000);
  const first=json?.routes?.[0];
  if(json.code!=='Ok'||!first?.geometry?.coordinates?.length) throw new Error('No se ha encontrado una ruta real a pie entre ambos lugares.');
  const path=createPath(first.geometry.coordinates);
  return {path,serviceMeters:first.distance,serviceSeconds:first.duration,demoFallback:false};
}
async function calculateRoute(){
  if(!$('adult-confirm').checked) throw new Error('Esta función requiere que un adulto marque la confirmación.');
  if(!validCoordinate(state.origin.coordinate)) throw new Error('Elige la dirección de la clínica en las sugerencias.');
  if(!validCoordinate(state.destination.coordinate)) throw new Error('Elige la dirección de casa en las sugerencias.');
  return routeBetween(state.origin.coordinate,state.destination.coordinate);
}
/** Public demonstration between two known Madrid landmarks; no user's address is needed. */
async function startMadridDemo(){
  const button=$('try-demo');
  if(button.disabled)return;
  button.disabled=true;button.textContent='Preparando mapa de Madrid…';
  $('demo-error').classList.add('hidden');
  const origin=CFG.clinic.origin.slice();
  const end=[-3.70736,40.41540]; // Plaza Mayor, Madrid (landmark only)
  state.origin={label:CFG.clinic.originLabel,coordinate:origin};
  state.destination={label:'Plaza Mayor, Madrid · DESTINO DE PRUEBA',coordinate:end};
  try{
    try{
      state.route=await routeBetween(origin,end);
    }catch(e){
      // Resilient visual preview when the community routing server throttles requests.
      // This is an ILLUSTRATIVE polyline, NOT an OSRM-verified walking route.
      const demoPoints=[
        origin,[-3.68947,40.41975],[-3.69093,40.41947],[-3.69300,40.41935],
        [-3.69605,40.41874],[-3.69896,40.41802],[-3.70172,40.41705],
        [-3.70326,40.41692],[-3.70511,40.41606],end
      ];
      const path=createPath(demoPoints);
      state.route={path,serviceMeters:path.total,serviceSeconds:null,demoFallback:true};
    }
    state.path=state.route.path;
    prepareJourney(true);
    state.progress=0;state.lastStage=-1;
    $('distance').textContent=formatDistance(state.route.serviceMeters);
    $('route-mode-label').textContent=state.route.demoFallback?'Trazado ilustrativo · no validado en calles':'Ruta a pie real · simulación mágica';
    $('route-legal-note').textContent=state.route.demoFallback?
      'Modo demostración: el servicio de rutas no respondió, por lo que el recorrido dibujado es ilustrativo, no calculado por calles. No es seguimiento GPS.':
      'Ruta calculada sobre calles reales entre dos puntos turísticos de prueba. El movimiento del Ratón es una animación ficticia, no un GPS.';
    showScreen('route');
    await ensureMap();
    showIntro();
  }catch(e){
    showScreen('welcome');
    $('demo-error').textContent='No se ha podido cargar el mapa. Comprueba tu conexión y vuelve a probar: '+(e?.message||'error');
    $('demo-error').classList.remove('hidden');
  }finally{
    button.disabled=false;button.textContent='▶ Probar recorrido de Madrid';
  }
}
/** Named places are only used after verifying the computed walking route passes nearby. */
const PUBLIC_LANDMARKS=[
  {name:'Fuente de Cibeles',coordinate:[-3.6933,40.4194],message:'¡He pasado cerca de la famosa fuente de Cibeles!'},
  {name:'Puerta del Sol',coordinate:[-3.70376,40.41696],message:'¡Ya estoy cerca de la Puerta del Sol!'},
  {name:'Parque del Retiro',coordinate:[-3.6849,40.4151],message:'¡Qué bonito es el parque del Retiro de noche!'},
  {name:'Templo de Debod',coordinate:[-3.7177,40.4241],message:'¡He visto el Templo de Debod desde el camino!'},
  {name:'Plaza de España',coordinate:[-3.7128,40.4230],message:'¡Qué grande es esta plaza!'}
];
function prepareJourney(demo=false){
  state.isDemo=demo;
  state.mapPath=publicFacingRoute(state.path,{demo});
  state.landmark=nearestPublicLandmark(state.mapPath,PUBLIC_LANDMARKS,120)||
    {name:'Un alto en el camino',message:'¡Qué aventura! Las calles brillan como si guardaran estrellas.',progress:.52};
  state.landmarkShown=false;state.arrivalShown=false;
  clearTimeout(state.landmarkTimer);clearTimeout(state.introTimer);
  $('landmark-panel').classList.add('hidden');
  $('final-curtain').classList.add('hidden');
  $('cinematic-intro').classList.add('hidden');
}
function playChime(kind='sparkle'){
  if(!state.soundOn||!state.audioCtx)return;
  const ctx=state.audioCtx;
  try{
    const base=kind==='arrival'?523:kind==='landmark'?659:880;
    const now=ctx.currentTime;
    [0,.12].forEach((delay,i)=>{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();
      oscillator.type='sine';oscillator.frequency.setValueAtTime(base*(i?1.25:1),now+delay);
      gain.gain.setValueAtTime(.0001,now+delay);
      gain.gain.exponentialRampToValueAtTime(.035,now+delay+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,now+delay+.29);
      oscillator.connect(gain);gain.connect(ctx.destination);
      oscillator.start(now+delay);oscillator.stop(now+delay+.32);
    });
  }catch(e){console.warn('Audio no disponible',e)}
}
function showLandmark(){
  if(state.landmarkShown||!state.landmark)return;
  state.landmarkShown=true;
  $('landmark-title').textContent=state.landmark.name;
  $('landmark-copy').textContent=state.landmark.message;
  $('landmark-panel').classList.remove('hidden');
  playChime('landmark');
  clearTimeout(state.landmarkTimer);
  state.landmarkTimer=setTimeout(()=>$('landmark-panel').classList.add('hidden'),4900);
}
function finishIntro(){
  clearTimeout(state.introTimer);
  if($('cinematic-intro').classList.contains('hidden'))return;
  $('cinematic-intro').classList.add('hidden');
  if(state.path && state.map && !state.playing)playPause();
}
function showIntro(){
  $('cinematic-intro').classList.remove('hidden');
  state.introTimer=setTimeout(finishIntro,state.reducedMotion?1000:3900);
}

function line(coords){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}};}
function pin(text,home=false){const e=document.createElement('div');e.className='place-pin'+(home?' place-pin--home':'');e.textContent=text;return e;}
function mouseNode(){
  const node=document.createElement('div');node.className='mouse-pin';
  const img=document.createElement('img');img.src=CFG.assets.character;img.alt='Ratón Pérez oficial';
  const fallback=document.createElement('span');fallback.className='fallback-icon hidden';fallback.textContent='✦';
  img.onerror=()=>{img.classList.add('hidden');fallback.classList.remove('hidden');};
  node.append(img,fallback);return node;
}
async function ensureMap(){
  if(state.map)return;
  try{
    let ml;
    try{ml=await import('https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');}
    catch(e){ml=await import('https://cdn.jsdelivr.net/npm/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');}
    state.ml=ml;
    const map=new ml.Map({container:'map',style:CFG.services.mapStyle,center:state.origin.coordinate,zoom:12,pitch:48,attributionControl:false,interactive:true,maxPitch:65,antialias:true});
    state.map=map;
    map.addControl(new ml.AttributionControl({compact:true,customAttribution:'Rutas: OSRM · Direcciones: Photon'}),'bottom-left');
    map.on('error',e=>{console.warn('Error de mapa:',e?.error?.message||e);});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('El mapa no responde.')),20000);
      map.once('load',()=>{clearTimeout(timer);resolve();});
    });
    // 3D buildings only when the live tile style includes a compatible vector building layer.
    // Keep every map provider's required attribution visible.
    const building=(map.getStyle()?.layers||[]).find(l=>l.type==='fill'&&/building/i.test(l.id)&&l['source-layer']&&map.getSource(l.source));
    if(building){
      try{map.addLayer({id:'villa-city-3d',type:'fill-extrusion',source:building.source,'source-layer':building['source-layer'],minzoom:14,
        paint:{'fill-extrusion-color':'#365761','fill-extrusion-opacity':.53,
        'fill-extrusion-height':['coalesce',['to-number',['get','render_height']],['to-number',['get','height']],12],
        'fill-extrusion-base':0}});}
      catch(err){console.warn('Edificios 3D no disponibles para este estilo:',err);}
    }
    const full=line(state.mapPath.points);
    map.addSource('journey-route',{type:'geojson',data:full});
    map.addSource('journey-completed',{type:'geojson',data:line(state.mapPath.points.slice(0,2))});
    map.addSource('journey-sparks',{type:'geojson',data:trailParticles(state.mapPath,0)});
    map.addLayer({id:'route-shadow',type:'line',source:'journey-route',paint:{'line-color':'#182c36','line-width':11,'line-opacity':.85},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'route-pending',type:'line',source:'journey-route',paint:{'line-color':'#a9a5a2','line-width':4,'line-opacity':.7,'line-dasharray':[1.2,1.4]},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'route-glow',type:'line',source:'journey-completed',paint:{'line-color':'#fbd37c','line-width':21,'line-opacity':.46,'line-blur':12},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'route-halo',type:'line',source:'journey-completed',paint:{'line-color':'#f5ca75','line-width':9,'line-opacity':.57,'line-blur':3},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'route-gold',type:'line',source:'journey-completed',paint:{'line-color':'#fff0ba','line-width':4.5},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'route-sparkle-aura',type:'circle',source:'journey-sparks',paint:{'circle-radius':['get','size'],'circle-color':'#ffdf91','circle-opacity':['get','alpha'],'circle-blur':.68}});
    map.addLayer({id:'route-sparkle-core',type:'circle',source:'journey-sparks',paint:{'circle-radius':2,'circle-color':'#fff9d2','circle-opacity':['get','alpha']}});
    state.originMarker=new ml.Marker({element:pin('✦ Villa Pérez')}).setLngLat(state.mapPath.points[0]).addTo(map);
    state.homeMarker=new ml.Marker({element:pin(state.isDemo?'⌂ Fin de prueba':'✧ Cerca de casa',true)}).setLngLat(state.mapPath.points.at(-1)).addTo(map);
    state.mouseMarker=new ml.Marker({element:mouseNode(),anchor:'bottom'}).setLngLat(state.mapPath.points[0]).addTo(map);
    fitMap();
    paintProgress(0,true);
  } catch(e){
    // A failed first load must not poison the next route attempt.
    state.map?.remove();state.map=null;state.ml=null;
    $('map-fallback').classList.remove('hidden');
    throw new Error(`No ha sido posible cargar el mapa interactivo: ${e.message}`);
  }
}
function fitMap(){
  if(!state.map||!state.ml||!state.mapPath)return;
  const bounds=new state.ml.LngLatBounds();for(const p of state.mapPath.points)bounds.extend(p);
  state.map.fitBounds(bounds,{padding:{top:160,bottom:95,left:38,right:38},maxZoom:15.8,duration:state.reducedMotion?0:900});
}
function journeyStage(f){
  if(f>=1)return {index:5,message:'¡He llegado! Ahora puedes terminar la misión.',subtitle:'Tu viaje ya está completo.'};
  if(f>=.81)return {index:4,message:'¡Ya falta muy poquito! Ve preparando tu almohada.',subtitle:'El Ratón Pérez está cerca de casa…'};
  if(f>=.55)return {index:3,message:'¡Más de la mitad del camino! ¡Qué aventura!',subtitle:'Avanzando por las calles de tu ciudad…'};
  if(f>=.28)return {index:2,message:'Voy siguiendo la ruta mágica. ¡Qué bonitas calles!',subtitle:'Un recorrido real con un toque de magia…'};
  if(f>=.08)return {index:1,message:'¡Ya he salido de Villa Pérez! ¡Allá voy!',subtitle:'Ha comenzado la aventura…'};
  return {index:0,message:'¡Mi mochila está lista! Voy a salir de la clínica.',subtitle:'El Ratón Pérez prepara la salida…'};
}
function updateMilestones(progress){
  const stops=[0,.2,.74,1];
  const index=progress>=1?3:progress>=.74?2:progress>=.2?1:0;
  document.querySelectorAll('#journey-milestones span').forEach((node,i)=>{
    node.classList.toggle('active',i===index);
    node.classList.toggle('completed',progress>=stops[i] && i<index);
  });
}
function paintProgress(progress,force=false){
  state.progress=Math.max(0,Math.min(1,progress));
  $('percent').textContent=`${Math.round(state.progress*100)}%`;
  $('track-fill').style.width=`${state.progress*100}%`;
  $('route-track').setAttribute('aria-valuenow',String(Math.round(state.progress*100)));
  updateMilestones(state.progress);
  if(!state.mapPath || !state.map || !state.mouseMarker)return;
  const now=performance.now();
  if(!force&&now-state.lastPaint<95)return;
  state.lastPaint=now;
  // Only map the genuine road section that does not expose a family's front door.
  const along=pointAt(state.mapPath,state.progress);
  state.mouseMarker.setLngLat(along.coordinate);
  const partial=along.partial.length===1?[along.partial[0],along.partial[0]]:along.partial;
  state.map.getSource('journey-completed')?.setData(line(partial));
  if(!state.reducedMotion)state.map.getSource('journey-sparks')?.setData(trailParticles(state.mapPath,state.progress,18,.0028));
  if(state.follow && state.playing && !state.reducedMotion && (force||now-state.lastCamera>1350) && state.progress<.92){
    state.lastCamera=now;
    const lookAhead=pointAt(state.mapPath,Math.min(.99,state.progress+.012)).coordinate;
    const options={center:lookAhead,zoom:state.cinematic?15.15:Math.max(13.3,Math.min(15,state.map.getZoom())),
      pitch:state.cinematic?(state.progress<.12?45:state.progress>.84?35:58):27,duration:1600,essential:false};
    if(state.cinematic)options.bearing=routeBearing(state.mapPath,Math.min(.99,state.progress+.009));
    state.map.easeTo(options);
  }
  const stage=journeyStage(state.progress);
  if(force||state.lastStage!==stage.index){
    if(!force && stage.index>0 && stage.index!==5)playChime('sparkle');
    state.lastStage=stage.index;
    $('route-message').textContent=stage.message;
    $('route-subtitle').textContent=stage.subtitle;
  }
  if(state.progress >= (state.landmark?.progress??.52) && state.progress<.87 && !state.landmarkShown && !force){
    showLandmark();
  }
  if(state.progress>=.92 && !state.arrivalShown){
    state.arrivalShown=true;
    $('landmark-panel').classList.add('hidden');
    $('final-curtain').classList.remove('hidden');
    playChime('arrival');
  } else if(state.progress<.92 && state.arrivalShown){
    state.arrivalShown=false;
    $('final-curtain').classList.add('hidden');
  }
}
function stopAnimation(){
  cancelAnimationFrame(state.frame);state.frame=0;state.playing=false;
  $('play-pause').textContent=state.progress>=1?'Ver sorpresa final →':state.progress>0?'Continuar viaje ▶':'Comenzar el viaje ▶';
}
function finishAnimation(){
  state.progress=1;paintProgress(1,true);
  stopAnimation();
  $('skip').textContent='Ver sorpresa final →';
}
function animate(t){
  if(!state.playing)return;
  const f=cinematicProgress(Math.min(1,(t-state.startTime)/state.durationMs));
  paintProgress(f);
  if(f>=1){finishAnimation();return;}
  state.frame=requestAnimationFrame(animate);
}
function playPause(){
  if(!state.mapPath||!state.map)return;
  if(state.playing){
    state.progress=cinematicProgress(Math.min(1,(performance.now()-state.startTime)/state.durationMs));
    stopAnimation();return;
  }
  if(state.progress>=1){finishMission();return;}
  state.playing=true;
  state.startTime=performance.now()-cinematicPhase(state.progress)*state.durationMs;
  $('play-pause').textContent='Pausar viaje ❚❚';
  $('skip').textContent='Terminar misión';
  if(state.follow&&!state.reducedMotion){
    const position=pointAt(state.mapPath,state.progress).coordinate;
    state.map.flyTo({center:position,zoom:14.7,pitch:state.cinematic?53:28,
      bearing:state.cinematic?routeBearing(state.mapPath,state.progress):0,duration:1650,essential:false});
    state.lastCamera=performance.now();
  }
  state.frame=requestAnimationFrame(animate);
}
function finishMission(){
  if(!state.path)return;
  stopAnimation();
  $('recap-distance').textContent=formatDistance(state.route.serviceMeters);
  showScreen('arrival');
}
function reset(){
  stopAnimation();state.map?.remove();state.map=null;state.mouseMarker=null;state.originMarker=null;state.homeMarker=null;state.path=null;state.route=null;
  state.progress=0;state.lastStage=-1;state.lastPaint=0;state.lastCamera=0;state.destination={label:'',coordinate:null};
  $('destination-address').value='';$('adult-confirm').checked=false;
  $('route-message').textContent='¡Mi mochila está lista! Voy a salir de la clínica.';$('play-pause').textContent='Comenzar el viaje ▶';$('skip').textContent='Terminar misión';
  $('map-fallback').classList.add('hidden');$('follow-map').classList.add('is-selected');$('follow-map').setAttribute('aria-pressed','true');state.follow=true;
  state.cinematic=false;$('cinematic-map').classList.remove('is-selected');$('cinematic-map').setAttribute('aria-pressed','false');
  showScreen('welcome');
}
function downloadPostcard(){
  if(!state.path)return;
  const doc=postcardSvg({clinicName:CFG.clinic.name,distanceMeters:state.route.serviceMeters});
  const blob=new Blob([doc],{type:'image/svg+xml;charset=utf-8'}),href=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=href;link.download='mi-viaje-raton-perez-villa-perez.svg';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),3000);
}
function setup(){
  updateConfig();
  $('start').addEventListener('click',()=>showScreen('address'));
  $('try-demo').addEventListener('click',startMadridDemo);
  // Deep link for testing directly on a phone without storing a home address.
  if(new URLSearchParams(location.search).get('demo')==='1')setTimeout(startMadridDemo,450);
  $('back-welcome').addEventListener('click',()=>showScreen('welcome'));
  $('restart').addEventListener('click',reset);
  $('new-trip').addEventListener('click',reset);
  $('download-postcard').addEventListener('click',downloadPostcard);
  setupAutocomplete('origin-address','origin-suggestions','origin');
  setupAutocomplete('destination-address','destination-suggestions','destination');
  $('address-form').addEventListener('submit',async e=>{
    e.preventDefault();clearError();setBusy(true);
    try {
      state.route=await calculateRoute();state.path=state.route.path;prepareJourney(false);state.progress=0;state.lastStage=-1;
      $('distance').textContent=formatDistance(state.route.serviceMeters);
      $('route-mode-label').textContent='Ruta a pie real · simulación mágica';
      $('route-legal-note').textContent='El recorrido sigue calles reales; el movimiento del Ratón es ficticio, no GPS. Solo un adulto confirma la llegada.';
      showScreen('route');
      await ensureMap();
      showIntro();
    }catch(err){console.warn(err);showScreen('address');errorMessage(err.message||'No se pudo calcular la ruta.');}
    finally{setBusy(false);}
  });
  $('fit-map').addEventListener('click',()=>{
    state.follow=false;$('follow-map').classList.remove('is-selected');$('follow-map').setAttribute('aria-pressed','false');fitMap();
  });
  $('follow-map').addEventListener('click',()=>{
    state.follow=!state.follow;
    $('follow-map').classList.toggle('is-selected',state.follow);$('follow-map').setAttribute('aria-pressed',String(state.follow));
    if(state.follow&&state.map&&state.path)state.map.easeTo({center:pointAt(state.path,state.progress).coordinate,zoom:14,pitch:state.cinematic?58:34,duration:550});
  });
  $('cinematic-map').addEventListener('click',()=>{
    state.cinematic=!state.cinematic;$('cinematic-map').classList.toggle('is-selected',state.cinematic);
    $('cinematic-map').setAttribute('aria-pressed',String(state.cinematic));
    if(state.map&&state.path)state.map.easeTo({pitch:state.cinematic?58:26,bearing:state.cinematic?routeBearing(state.path,state.progress):0,duration:650});
  });
  $('play-pause').addEventListener('click',playPause);
  $('skip').addEventListener('click',()=>{
    if(!state.path)return;
    if(state.progress>=1){finishMission();return;}
    // Only an adult should activate final arrival; keep it separate from time progress.
    if(window.confirm('Zona de padres: ¿quieres terminar la animación y mostrar la sorpresa final ahora?')){paintProgress(1,true);finishMission();}
  });
  for(const button of document.querySelectorAll('[data-duration]')){
    button.addEventListener('click',()=>{
      const duration=Number(button.dataset.duration);
      if(!Number.isFinite(duration)||duration<20)return;
      if(state.playing) {state.progress=Math.min(1,(performance.now()-state.startTime)/state.durationMs);state.startTime=performance.now()-state.progress*duration*1000;}
      state.durationMs=duration*1000;
      document.querySelectorAll('[data-duration]').forEach(b=>b.classList.toggle('selected',b===button));
    });
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&state.playing){state.progress=Math.min(1,(performance.now()-state.startTime)/state.durationMs);stopAnimation();}
  });
  window.addEventListener('beforeunload',()=>{stopAnimation();state.destination.coordinate=null;});
}
setup();