import {APP_CONFIG as CFG} from './config.js';
import {createPath,pointAt,validCoordinate,compactAddress,formatDistance,postcardSvg,trailParticles,routeBearing} from './route-utils.mjs';

const $ = id => document.getElementById(id);
const screens = ['welcome','address','route','arrival'];
const state = {
  screen:'welcome', clinic:CFG.clinic,
  origin:{label:CFG.clinic.originLabel,coordinate:CFG.clinic.origin?.slice()||null},
  destination:{label:'',coordinate:null},
  map:null,ml:null,mouseMarker:null,originMarker:null,homeMarker:null,
  route:null,path:null,durationMs:CFG.stageDurationSeconds*1000,progress:0,
  playing:false,startTime:0,frame:0,follow:true,cinematic:false,lastPaint:0,lastStage:-1,lastCamera:0,
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

async function calculateRoute(){
  if(!$('adult-confirm').checked) throw new Error('Esta función requiere que un adulto marque la confirmación.');
  if(!validCoordinate(state.origin.coordinate)) throw new Error('Elige la dirección de la clínica en las sugerencias.');
  if(!validCoordinate(state.destination.coordinate)) throw new Error('Elige la dirección de casa en las sugerencias.');
  const [start,end]=[state.origin.coordinate,state.destination.coordinate];
  if(Math.abs(start[0]-end[0])<.00001 && Math.abs(start[1]-end[1])<.00001) throw new Error('Elige una dirección distinta de la clínica.');
  const coords=`${start[0].toFixed(6)},${start[1].toFixed(6)};${end[0].toFixed(6)},${end[1].toFixed(6)}`;
  const url=CFG.services.router+coords+'?overview=full&geometries=geojson&steps=false&alternatives=false';
  const json=await fetchJson(url,16000);
  const first=json?.routes?.[0];
  if(json.code!=='Ok'||!first?.geometry?.coordinates?.length) throw new Error('No se ha encontrado una ruta real a pie entre ambos lugares.');
  const path=createPath(first.geometry.coordinates);
  return {path,serviceMeters:first.distance,serviceSeconds:first.duration};
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
    const ml=await import('https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');
    state.ml=ml;
    const map=new ml.Map({container:'map',style:CFG.services.mapStyle,center:state.origin.coordinate,zoom:12,pitch:26,attributionControl:false,interactive:true});
    state.map=map;
    map.addControl(new ml.AttributionControl({compact:true,customAttribution:'Rutas: OSRM · Direcciones: Photon'}),'bottom-left');
    map.on('error',e=>{console.warn('Error de mapa:',e?.error?.message||e);});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('El mapa no responde.')),20000);
      map.once('load',()=>{clearTimeout(timer);resolve();});
    });
    const full=line(state.path.points);
    map.addSource('journey-route',{type:'geojson',data:full});
    map.addSource('journey-completed',{type:'geojson',data:line(state.path.points.slice(0,2))});
    map.addSource('journey-sparks',{type:'geojson',data:trailParticles(state.path,0)});
    map.addLayer({id:'route-shadow',type:'line',source:'journey-route',paint:{'line-color':'#182c36','line-width':11,'line-opacity':.85},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'route-pending',type:'line',source:'journey-route',paint:{'line-color':'#a9a5a2','line-width':4,'line-opacity':.7,'line-dasharray':[1.2,1.4]},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'route-glow',type:'line',source:'journey-completed',paint:{'line-color':'#fbd37c','line-width':13,'line-opacity':.45,'line-blur':7},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'route-gold',type:'line',source:'journey-completed',paint:{'line-color':'#ffe3a1','line-width':5},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'route-sparkle-aura',type:'circle',source:'journey-sparks',paint:{'circle-radius':['get','size'],'circle-color':'#ffdf91','circle-opacity':['get','alpha'],'circle-blur':.68}});
    map.addLayer({id:'route-sparkle-core',type:'circle',source:'journey-sparks',paint:{'circle-radius':2,'circle-color':'#fff9d2','circle-opacity':['get','alpha']}});
    state.originMarker=new ml.Marker({element:pin('✦ Villa Pérez')}).setLngLat(state.path.points[0]).addTo(map);
    state.homeMarker=new ml.Marker({element:pin('⌂ Tu casa',true)}).setLngLat(state.path.points.at(-1)).addTo(map);
    state.mouseMarker=new ml.Marker({element:mouseNode(),anchor:'bottom'}).setLngLat(state.path.points[0]).addTo(map);
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
  if(!state.map||!state.ml||!state.path)return;
  const bounds=new state.ml.LngLatBounds();for(const p of state.path.points)bounds.extend(p);
  state.map.fitBounds(bounds,{padding:{top:175,bottom:100,left:42,right:42},maxZoom:16,duration:650});
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
  if(!state.path || !state.map || !state.mouseMarker)return;
  const now=performance.now();if(!force&&now-state.lastPaint<90)return;
  state.lastPaint=now;
  const along=pointAt(state.path,state.progress);
  state.mouseMarker.setLngLat(along.coordinate);
  const partial=along.partial.length===1?[along.partial[0],along.partial[0]]:along.partial;
  state.map.getSource('journey-completed')?.setData(line(partial));
  if(!state.reducedMotion)state.map.getSource('journey-sparks')?.setData(trailParticles(state.path,state.progress));
  if(state.follow && state.playing && !state.reducedMotion && (force||now-state.lastCamera>650)){
    state.lastCamera=now;
    const options={center:along.coordinate,zoom:state.cinematic?15.3:Math.max(13.2,Math.min(15,state.map.getZoom())),pitch:state.cinematic?58:30,duration:850,essential:false};
    if(state.cinematic)options.bearing=routeBearing(state.path,state.progress);
    state.map.easeTo(options);
  }
  const stage=journeyStage(state.progress);
  if(force||state.lastStage!==stage.index){state.lastStage=stage.index;$('route-message').textContent=stage.message;$('route-subtitle').textContent=stage.subtitle;}
}
function stopAnimation(){cancelAnimationFrame(state.frame);state.frame=0;state.playing=false;$('play-pause').textContent=state.progress>=1?'Ver el recorrido ↻':'Continuar viaje ▶';}
function finishAnimation(){stopAnimation();state.progress=1;paintProgress(1,true);$('play-pause').textContent='Volver a ver ↻';$('skip').textContent='Ver sorpresa final →';}
function animate(t){
  if(!state.playing)return;
  const f=Math.min(1,(t-state.startTime)/state.durationMs);
  paintProgress(f);
  if(f>=1){finishAnimation();return;}
  state.frame=requestAnimationFrame(animate);
}
function playPause(){
  if(!state.path||!state.map)return;
  if(state.playing){state.progress=Math.min(1,(performance.now()-state.startTime)/state.durationMs);stopAnimation();return;}
  if(state.progress>=1) paintProgress(0,true);
  state.playing=true;state.startTime=performance.now()-state.progress*state.durationMs;
  $('play-pause').textContent='Pausar viaje ❚❚';$('skip').textContent='Terminar misión';
  if(state.follow){const position=pointAt(state.path,state.progress).coordinate;state.map.easeTo({center:position,zoom:14,pitch:34,duration:800});}
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
  $('back-welcome').addEventListener('click',()=>showScreen('welcome'));
  $('restart').addEventListener('click',reset);
  $('new-trip').addEventListener('click',reset);
  $('download-postcard').addEventListener('click',downloadPostcard);
  setupAutocomplete('origin-address','origin-suggestions','origin');
  setupAutocomplete('destination-address','destination-suggestions','destination');
  $('address-form').addEventListener('submit',async e=>{
    e.preventDefault();clearError();setBusy(true);
    try {
      state.route=await calculateRoute();state.path=state.route.path;state.progress=0;state.lastStage=-1;
      $('distance').textContent=formatDistance(state.route.serviceMeters);
      showScreen('route');
      await ensureMap();
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