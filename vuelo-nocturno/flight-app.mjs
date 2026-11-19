import {START,DEMO_END,DEMO_APPROX,pathFromPoints,along,heading,samplePath,shortenForHome,easing,colorNight,sanitizePhoton,displayDistance} from './flight-core.mjs';

const $=id=>document.getElementById(id);
const state={map:null,lib:null,provider:'free',token:'',mapReady:false,mapPromise:null,route:null,path:null,childPath:null,isDemo:false,approximate:false,flyTo:null,selection:null,progress:0,playing:false,raf:0,lastCamera:0,lastPaint:0,lastMapPos:0,follow:true,view:'globe',durationMs:95000,startTime:0,searchAbort:null,searchSerial:0,searchTimer:0,marker:null,warning:null};
const hide=id=>$(id).classList.add('hidden'),show=id=>$(id).classList.remove('hidden');
function notify(text){$('input-error').textContent=text;show('input-error');}
function clearNotify(){hide('input-error');}
function loading(on,title='Preparando el vuelo…',subtitle='Cargando la ciudad real'){ $('loading-title').textContent=title;$('loading-subtitle').textContent=subtitle;$('loading').classList.toggle('hidden',!on); }
function setProviderText(){
 const satellite=state.provider==='mapbox';
 $('mode-pill').textContent=satellite?'SATÉLITE 3D · NOCHE':'3D · MAPA REAL';
 $('map-warning').textContent=satellite?'Fotografía aérea diurna + iluminación nocturna simulada · Mapbox':'Edificios reales OSM extruidos · no es fotografía aérea';
 $('provider-info').textContent=satellite?'Satélite 3D activado. El token público no se guarda en el navegador.':'Sin token se utiliza una vista real 3D de edificios y calles, no imágenes satelitales.';
}
async function getMapLibre(){try{return await import('https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');}
catch(e){return await import('https://cdn.jsdelivr.net/npm/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');}}
async function getMapbox(){
 if(window.mapboxgl)return window.mapboxgl;
 if(!document.getElementById('mb-css')){const link=document.createElement('link');link.id='mb-css';link.rel='stylesheet';link.href='https://api.mapbox.com/mapbox-gl-js/v3.35.0/mapbox-gl.css';document.head.append(link);}
 return new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src='https://api.mapbox.com/mapbox-gl-js/v3.35.0/mapbox-gl.js';s.async=true;
  s.onload=()=>window.mapboxgl?resolve(window.mapboxgl):reject(new Error('No se pudo inicializar Mapbox.'));
  s.onerror=()=>reject(new Error('No se pudo cargar Mapbox GL JS.'));
  document.head.append(s);
 });
}
function paintIfExists(map,id,key,value){try{map.setPaintProperty(id,key,value)}catch{}}
function themeFreeMap(map){
 const style=map.getStyle();
 for(const l of style.layers||[]){const id=(l.id||'').toLowerCase(),data=(l['source-layer']||'').toLowerCase();
  if(l.type==='background'){paintIfExists(map,l.id,'background-color','#163447')}
  if(l.type==='fill'){
   if(/water/.test(id)||data==='water')paintIfExists(map,l.id,'fill-color','#1c4d64');
   else if(/park|grass|wood|forest|garden|landcover|landuse/.test(id)||/landcover|landuse|park/.test(data))paintIfExists(map,l.id,'fill-color','#244a47');
   else if(/building/.test(id)||data==='building')paintIfExists(map,l.id,'fill-color','#3e5a66');
   else if(/land|residential/.test(id))paintIfExists(map,l.id,'fill-color','#294c56');
  }
  if(l.type==='line'&&/road|street|highway|primary|secondary|transportation/.test(id+' '+data)){
   paintIfExists(map,l.id,'line-color',/primary|motorway|highway/.test(id)?'#e3c996':'#a5c5cc');
   paintIfExists(map,l.id,'line-opacity',.91);
  }
  if(l.type==='symbol'&&l.layout?.['text-field']!==undefined){
   paintIfExists(map,l.id,'text-color','#fff0d0');paintIfExists(map,l.id,'text-halo-color','#102c3c');paintIfExists(map,l.id,'text-halo-width',2);
  }
 }
 const vector=Object.entries(style.sources||{}).find(([,s])=>s.type==='vector');
 if(vector){
  const label=(style.layers||[]).find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
  try{map.addLayer({id:'flight-buildings-3d',type:'fill-extrusion',source:vector[0],'source-layer':'building',minzoom:14.3,
    paint:{'fill-extrusion-color':['interpolate',['linear'],['to-number',['get','render_height'],12],0,'#456775',24,'#6d8b91',100,'#a6a78b'],
    'fill-extrusion-opacity':.8,'fill-extrusion-height':['interpolate',['linear'],['zoom'],14.3,0,15.4,['to-number',['get','render_height'],12]],
    'fill-extrusion-base':['to-number',['get','render_min_height'],0]}},label)}catch(e){console.warn('Sin extrusiones 3D:',e)}
 }
}
async function createMap(){
 if(state.map){state.map.remove();state.map=null;state.mapReady=false;}
 const isMb=state.provider==='mapbox';
 let lib;
 try{lib=isMb?await getMapbox():await getMapLibre()}catch(e){throw new Error('No se puede cargar el visor 3D. Revisa la conexión. '+e.message)}
 state.lib=lib;
 if(isMb)lib.accessToken=state.token;
 const options={container:'map',center:START.coordinates,zoom:16.2,pitch:68,bearing:-13,antialias:true,attributionControl:true,maxPitch:80,interactive:true,
  style:isMb?'mapbox://styles/mapbox/standard-satellite':'https://tiles.openfreemap.org/styles/liberty'};
 if(isMb){options.config={basemap:{lightPreset:'night',showPointOfInterestLabels:false,showTransitLabels:false,showRoadLabels:false}};options.projection='mercator';}
 let map;
 try{map=new lib.Map(options)}catch(e){throw new Error('No se puede iniciar el mapa: '+e.message)}
 state.map=map;
 map.on('error',e=>console.warn('[Vuelo nocturno] proveedor de mapas:',e?.error?.message||e));
 await new Promise((resolve,reject)=>{
  let ended=false;const timer=setTimeout(()=>{if(!ended){ended=true;reject(new Error('El proveedor de mapas no ha respondido.'))}},20000);
  map.once('load',()=>{if(!ended){ended=true;clearTimeout(timer);resolve()}});
 });
 state.mapReady=true;
 if(!isMb)themeFreeMap(map);
 else{try{map.setConfigProperty('basemap','lightPreset','night')}catch(e){console.warn('Luz nocturna no disponible',e)}}
 map.on('move',()=>{renderBalloon();if(!state.playing)drawTrail(performance.now())});
 map.on('resize',()=>{renderBalloon();drawTrail(performance.now())});
 setProviderText();
 if(state.childPath)installRoute();
 return map;
}
async function ensureMap(){
 if(state.mapReady&&state.map)return state.map;
 if(state.mapPromise)return state.mapPromise;
 state.mapPromise=createMap().finally(()=>{state.mapPromise=null});
 return state.mapPromise;
}
function routeFeature(points){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points}};}
function routeData(points){return {type:'FeatureCollection',features:[routeFeature(points)]};}
function installRoute(){
 const map=state.map,path=state.childPath;if(!map||!state.mapReady||!path)return;
 const full=routeData(samplePath(path,Math.min(250,Math.max(60,path.points.length*3))));
 const partial=routeData([along(path,0),along(path,0)]);
 if(map.getSource('flight-path')){map.getSource('flight-path').setData(full);map.getSource('flight-completed').setData(partial);return;}
 map.addSource('flight-path',{type:'geojson',data:full});
 map.addSource('flight-completed',{type:'geojson',data:partial});
 const slot=state.provider==='mapbox'?{slot:'top'}:{};
 const layer=(id,source,paint)=>map.addLayer({id,type:'line',source,...slot,layout:{'line-cap':'round','line-join':'round'},paint});
 layer('flight-route-shadow','flight-path',{'line-color':'#122a3c','line-width':13,'line-opacity':.75});
 layer('flight-route-base','flight-path',{'line-color':'#deb66b','line-width':3.1,'line-opacity':.55,'line-dasharray':[.9,1.6]});
 layer('flight-route-glow','flight-completed',{'line-color':'#f7c367','line-width':25,'line-blur':11,'line-opacity':.7});
 layer('flight-route-halo','flight-completed',{'line-color':'#f9df95','line-width':10,'line-blur':3,'line-opacity':.94});
 layer('flight-route-core','flight-completed',{'line-color':'#fff4c0','line-width':3.8,'line-opacity':1});
}
async function requestJson(url,{timeout=15000,signal}={}){
 const controller=new AbortController();const t=setTimeout(()=>controller.abort(),timeout);
 if(signal)signal.addEventListener('abort',()=>controller.abort(),{once:true});
 try{const response=await fetch(url,{signal:controller.signal,headers:{accept:'application/json'}});
  if(!response.ok)throw new Error('Servicio externo '+response.status);
  return await response.json();
 }finally{clearTimeout(t)}
}
async function geocode(query,signal){const params=new URLSearchParams({q:query,limit:'5',lang:'es',lat:'40.4168',lon:'-3.7038'});
 const json=await requestJson('https://photon.komoot.io/api/?'+params,{timeout:12000,signal});
 return (json.features||[]).map(sanitizePhoton).filter(Boolean);
}
async function fetchWalkRoute(from,to){
 const coords=[from,to].map(c=>c.map(v=>Number(v).toFixed(6)).join(',')).join(';');
 const endpoint='https://routing.openstreetmap.de/routed-foot/route/v1/driving/'+coords+'?overview=full&geometries=geojson&steps=false';
 const json=await requestJson(endpoint,{timeout:18000});
 const shape=json?.routes?.[0]?.geometry?.coordinates;
 if(json.code!=='Ok'||!Array.isArray(shape)||shape.length<2)throw new Error('No hay una ruta peatonal real disponible entre esas direcciones.');
 return pathFromPoints(shape);
}
function setSuggestions(items){const box=$('suggestions');box.replaceChildren();$('address').setAttribute('aria-expanded',String(items.length>0));
 for(const item of items){const btn=document.createElement('button');btn.type='button';btn.setAttribute('role','option');btn.textContent='⌖ '+item.label;
  btn.addEventListener('click',()=>{state.selection=item;$('address').value=item.label;$('fly').disabled=false;hide('suggestions');$('address').setAttribute('aria-expanded','false');clearNotify()});box.appendChild(btn)}
 box.classList.toggle('hidden',!items.length);
}
function resetSearch(){state.selection=null;$('fly').disabled=true;}
function onSearchChanged(){clearNotify();resetSearch();state.searchAbort?.abort();clearTimeout(state.searchTimer);
 const q=$('address').value.trim();setSuggestions([]);if(q.length<4)return;
 const serial=++state.searchSerial;
 state.searchTimer=setTimeout(async()=>{
  const controller=new AbortController();state.searchAbort=controller;show('search-spinner');
  try{const hits=await geocode(q,controller.signal);if(serial!==state.searchSerial||controller.signal.aborted)return;setSuggestions(hits);if(!hits.length)notify('No encontramos esa dirección. Prueba con calle, número y ciudad.')}
  catch(e){if(!controller.signal.aborted&&serial===state.searchSerial)notify('No se ha podido consultar la dirección. Inténtalo de nuevo.');}
  finally{if(serial===state.searchSerial)hide('search-spinner')}
 },310);
}
async function startFlight(dest,isDemo){
 if(!dest?.coordinates)return notify('Selecciona una dirección de las sugerencias antes de volar.');
 if(state.playing)pause();
 clearNotify();
 state.isDemo=isDemo;state.approximate=false;state.progress=0;state.follow=true;state.view='globe';
 loading(true,'Calculando ruta auténtica…','La ciudad está preparando el despegue');
 try{
  let route;
  try{route=await fetchWalkRoute(START.coordinates,dest.coordinates)}
  catch(e){
   if(!isDemo)throw e;
   // DEMO ONLY: no false claim of a validated walking route.
   route=pathFromPoints(DEMO_APPROX);state.approximate=true;
  }
  state.route=route;state.childPath=isDemo?route:shortenForHome(route,180);state.flyTo=dest;
  const map=await ensureMap();installRoute();
  hide('setup');hide('arrival');show('flight-ui');show('balloon');
  $('route-indicator').textContent=state.approximate?'Trazado de muestra · NO ruta calculada':'Calles reales · globo animado';
  $('distance').textContent=displayDistance(route.length);$('flight-status').textContent=isDemo?'Madrid · recorrido público de prueba':'Últimos metros del domicilio ocultos';
  $('flight-caption').textContent=state.approximate?'Vuelo de muestra sobre Madrid':'¡El globo está sobrevolando tu ruta!';
  $('view-label').textContent='SEGUIR';$('view').setAttribute('aria-label','Cambiar a vista panorámica');
  const b=new state.lib.LngLatBounds();for(const c of state.childPath.points)b.extend(c);
  map.fitBounds(b,{padding:{top:150,bottom:215,left:35,right:35},pitch:58,maxZoom:15.3,duration:900});
  loading(false);renderFrame(0,true);play();
 }catch(e){loading(false);console.warn('[Vuelo nocturno] Error:',e);show('setup');notify(e.message||'No fue posible preparar el vuelo.');hide('flight-ui');hide('balloon');}
}
function renderBalloon(){
 if(!state.childPath||!state.mapReady)return;
 const p=along(state.childPath,state.progress),screen=state.map.project(p);
 const el=$('balloon');el.style.left=screen.x+'px';el.style.top=(screen.y-38)+'px';
 const tilt=Math.sin((heading(state.childPath,state.progress)-state.map.getBearing())*Math.PI/180)*4;
 el.style.rotate=tilt+'deg';
 const zoom=state.map.getZoom(),scale=Math.min(1.13,Math.max(.68,.86+(zoom-16)*.1));
 el.style.scale=scale;
}
function drawTrail(timestamp){
 if(!state.childPath||!state.mapReady)return;
 const canvas=$('trail'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(1.65,window.devicePixelRatio||1);
 if(w<2||h<2)return;
 const x=Math.round(w*dpr),y=Math.round(h*dpr);if(canvas.width!==x||canvas.height!==y){canvas.width=x;canvas.height=y}
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation='screen';
 const point=state.map.project(along(state.childPath,state.progress));
 if(Number.isFinite(point.x)&&Number.isFinite(point.y)){
  const glow=ctx.createRadialGradient(point.x,point.y,1,point.x,point.y,55);glow.addColorStop(0,'#ffe09a99');glow.addColorStop(.45,'#f4bc5755');glow.addColorStop(1,'#f7b66a00');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(point.x,point.y,55,0,Math.PI*2);ctx.fill();
 }
 const t=timestamp*.001;
 for(let i=0;i<26;i++){
  const f=state.progress-i*.0045;if(f<=0)break;
  const p=state.map.project(along(state.childPath,f));if(!Number.isFinite(p.x)||p.x<0||p.y<0||p.x>w||p.y>h)continue;
  const radius=(i%5===0?3.5:1.7)+Math.sin(t*4+i)*.5;
  ctx.save();ctx.globalAlpha=Math.max(.1,.94-i*.032);ctx.shadowBlur=13;ctx.shadowColor='#ffd07b';ctx.fillStyle=i%3?'#ffda8d':'#fff9db';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.6,radius),0,Math.PI*2);ctx.fill();
  if(i%5===0){ctx.strokeStyle='#ffe4ab';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(p.x-6,p.y);ctx.lineTo(p.x+6,p.y);ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x,p.y+6);ctx.stroke()}
  ctx.restore();
 }
 ctx.globalCompositeOperation='source-over';
}
function updateCamera(t,force=false){
 if(!state.map||!state.childPath||!state.follow)return;
 if(!force&&t-state.lastCamera<1550)return;
 state.lastCamera=t;
 const path=state.childPath,f=state.progress;
 const coord=along(path,Math.min(.995,f+.005));const base=colorNight(f);
 const settings=state.view==='globe'?{zoom:base.zoom+1,pitch:Math.min(78,base.pitch+3),offset:[0,105]}:{zoom:Math.max(14.7,base.zoom-1.1),pitch:55,offset:[0,0]};
 state.map.easeTo({center:coord,bearing:heading(path,Math.min(.995,f+.006)),duration:1850,essential:false,...settings});
}
function renderFrame(timestamp,force=false){
 if(!state.mapReady||!state.childPath)return;
 const now=timestamp||performance.now();
 if(force||now-state.lastPaint>75){state.lastPaint=now;renderBalloon();drawTrail(now);
  const f=state.progress;
  $('percent').textContent=Math.round(f*100)+' %';$('track-fill').style.width=(f*100)+'%';document.querySelector('.track').style.setProperty('--p',(f*100)+'%');
  // Using the original geometry is essential: don't cut across streets when animating the drawn route.
  const full=state.childPath;const traveled=full.points.filter((_,i)=>full.distances[i]<full.length*f);
  traveled.push(along(full,Math.max(.000001,f)));
  if(traveled.length===1)traveled.push(traveled[0]);
  state.map.getSource('flight-completed')?.setData(routeData(traveled));
 }
 if(state.playing)updateCamera(now,force);
}
function animate(t){if(!state.playing)return;state.progress=easing((t-state.startTime)/state.durationMs);renderFrame(t);
 if(state.progress>=1){pause();showArrival();return;}
 state.raf=requestAnimationFrame(animate);
}
function play(){if(!state.childPath||!state.mapReady)return;if(state.progress>=1)state.progress=0;state.playing=true;state.startTime=performance.now()-inverseEasing(state.progress)*state.durationMs;state.lastCamera=0;updateCamera(performance.now(),true);$('pause').innerHTML='Pausar <span>Ⅱ</span>';state.raf=requestAnimationFrame(animate);}
function inverseEasing(value){let l=0,h=1;for(let i=0;i<27;i++){const m=(l+h)/2;if(easing(m)<value)l=m;else h=m;}return(l+h)/2;}
function pause(){if(state.playing){const phase=Math.min(1,(performance.now()-state.startTime)/state.durationMs);state.progress=easing(phase)}state.playing=false;cancelAnimationFrame(state.raf);$('pause').innerHTML='Continuar <span>▶</span>';}
function showArrival(){pause();hide('flight-ui');hide('balloon');show('arrival');}
function backToStart(){pause();hide('arrival');hide('flight-ui');hide('balloon');show('setup');state.childPath=null;state.route=null;state.progress=0;state.isDemo=false;state.approximate=false;state.selection=null;$('address').value='';$('fly').disabled=true;if(state.mapReady)state.map.flyTo({center:START.coordinates,zoom:16.2,pitch:68,bearing:-13,duration:950});}
async function activateMapbox(){const token=$('mapbox-key').value.trim();if(!/^pk\.[A-Za-z0-9._-]{20,}$/.test(token)){$('provider-info').textContent='Introduce un token público válido de Mapbox, que empieza por pk.';return;}
 const previous=state.provider;state.provider='mapbox';state.token=token;loading(true,'Activando satélite 3D…','Comprobando tu token Mapbox');
 try{if(state.mapPromise)await state.mapPromise.catch(()=>{});await createMap();loading(false);$('provider-info').textContent='Mapbox Satellite 3D activo; la fotografía aérea es diurna y la iluminación se representa de noche.';}
 catch(e){console.warn(e);state.provider=previous;state.token='';loading(false);$('provider-info').textContent=e.message+' Volviendo a mapa libre.';try{await createMap()}catch(fail){notify(fail.message)}}
}
function setup(){
 $('address').addEventListener('input',onSearchChanged);$('address').addEventListener('keydown',e=>{if(e.key==='Escape')setSuggestions([])});
 $('fly').addEventListener('click',()=>startFlight(state.selection,false));
 $('quick-demo').addEventListener('click',()=>startFlight(DEMO_END,true));
 $('apply-provider').addEventListener('click',activateMapbox);
 $('pause').addEventListener('click',()=>state.playing?pause():play());
 $('back').addEventListener('click',backToStart);$('again').addEventListener('click',backToStart);
 $('restart').addEventListener('click',()=>{pause();state.progress=0;renderFrame(performance.now(),true);play()});
 $('finish').addEventListener('click',showArrival);
 $('view').addEventListener('click',()=>{state.view=state.view==='globe'?'panorama':'globe';state.follow=true;$('view-label').textContent=state.view==='globe'?'SEGUIR':'CIUDAD';$('view').setAttribute('aria-label',state.view==='globe'?'Cambiar a vista panorámica':'Cambiar a vista globo');updateCamera(performance.now(),true)});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing)pause()});
 window.addEventListener('beforeunload',()=>{pause();state.searchAbort?.abort();state.token='';});
 setProviderText();
 ensureMap().catch(e=>{console.warn(e);notify('La vista 3D no está disponible en este momento. '+e.message)});
 if(new URLSearchParams(location.search).get('demo')==='1')setTimeout(()=>startFlight(DEMO_END,true),500);
}
setup();
