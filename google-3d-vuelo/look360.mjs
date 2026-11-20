/* Villa Pérez 5.3 — explorer 360°: real Google Maps 3D camera with device
 * orientation when granted, touch-drag fallback and transparent basket overlay.
 * No geolocation or sensor data is transmitted to a Villa Pérez server.
 */
export function installLook360({state,$,now,norm,shortest,routeProgress,routePoint,terrainAt,headingNow,restoreCamera,notify}){
 const l={active:false,sensorWorking:false,lastYaw:null,accumYaw:0,pitchZero:null,
  pitch:0,dragYaw:0,dragTilt:0,anchor:0,heading:0,tilt:77,lastDraw:0,
  pointer:null,x:0,y:0,savedFov:null,faulted:false,permissionTimer:0};
 const pad=$('lookGesturePad');
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function repaint(position=routePoint(),progress=routeProgress(),force=false){
  if(!l.active||!state.map||!position)return;
  const tick=now();
  if(!force&&tick-l.lastDraw<42)return;
  l.lastDraw=tick;
  const targetHeading=norm(l.anchor+l.accumYaw+l.dragYaw);
  const targetTilt=clamp(77+l.pitch+l.dragTilt,47,105);
  const k=force?.49:.25;
  l.heading=norm(l.heading+shortest(l.heading,targetHeading)*k);
  l.tilt+=(targetTilt-l.tilt)*k;
  try{
   // The explicit cameraPosition fixes our viewpoint in the basket.
   // Changing heading must not orbit a remote target point.
   state.map.heading=l.heading;
   state.map.tilt=l.tilt;
   if(Math.abs(state.map.range-130)>1)state.map.range=130;
   state.map.cameraPosition={...position,altitude:terrainAt(progress)+9};
  }catch(e){
   console.warn('Villa Pérez first-person 3D camera:',e);
   if(!l.faulted){l.faulted=true;notify('La cámara subjetiva no está disponible en esta versión de Maps 3D.')}
  }
 }
 function sensorYaw(event){
  if(Number.isFinite(event.webkitCompassHeading))return norm(event.webkitCompassHeading);
  if(!Number.isFinite(event.alpha))return null;
  const angle=screen.orientation?.angle??window.orientation??0;
  return norm(360-event.alpha-angle);
 }
 function onSensor(event){
  if(!l.active)return;
  const yaw=sensorYaw(event);
  if(yaw===null)return;
  const angle=screen.orientation?.angle??window.orientation??0;
  const pitch=(Math.abs(angle)===90&&Number.isFinite(event.gamma))
   ?(angle===90?-event.gamma:event.gamma):event.beta;
  if(l.lastYaw===null){
   l.lastYaw=yaw;
   if(Number.isFinite(pitch))l.pitchZero=pitch;
  }else{
   const change=shortest(l.lastYaw,yaw);
   // Ignore sensor recalibrations that otherwise cause sudden camera jumps.
   if(Math.abs(change)<65)l.accumYaw+=change;
   l.lastYaw=yaw;
   if(Number.isFinite(pitch)&&l.pitchZero!==null)
    l.pitch=clamp((pitch-l.pitchZero)*.65,-42,42);
  }
  l.sensorWorking=true;
  $('lookStatus').textContent='Gira el móvil para explorar. También puedes arrastrar con el dedo.';
  if(state.paused)repaint(routePoint(),routeProgress(),true);
 }
 function recenter(){
  if(!l.active)return;
  l.anchor=norm(headingNow());
  l.accumYaw=0;l.dragYaw=0;l.dragTilt=0;l.pitch=0;
  l.lastYaw=null;l.pitchZero=null;
  l.heading=l.anchor;l.tilt=77;
  repaint(routePoint(),routeProgress(),true);
 }
 function disable(restore=true){
  if(!l.active)return;
  l.active=false;l.sensorWorking=false;l.lastYaw=null;l.pitchZero=null;l.pointer=null;
  clearTimeout(l.permissionTimer);
  window.removeEventListener('deviceorientation',onSensor);
  $('povOverlay').hidden=true;
  pad.hidden=true;
  $('povTools').hidden=true;
  $('lookToggle').textContent='🔭 Mirar 360°';
  $('lookToggle').setAttribute('aria-pressed','false');
  if(Number.isFinite(l.savedFov)&&state.map)try{state.map.fov=l.savedFov}catch(e){}
  $('balloon').hidden=state.overview||state.phase==='done';
  if(restore)restoreCamera();
 }
 async function toggle(){
  if(l.active){disable();return}
  if(!state.loaded||!state.playing||state.overview||
    !['route','orbit'].includes(state.phase)){
   notify('La vista desde la cesta estará disponible después de despegar.');
   return;
  }
  l.active=true;l.sensorWorking=false;l.lastYaw=null;l.accumYaw=0;l.pitchZero=null;
  l.pitch=0;l.dragYaw=0;l.dragTilt=0;l.pointer=null;l.faulted=false;l.lastDraw=0;
  l.anchor=norm(state.map?.heading??headingNow());
  l.heading=l.anchor;l.tilt=77;l.savedFov=state.map?.fov;
  $('balloon').hidden=true;
  $('povOverlay').hidden=false;pad.hidden=false;$('povTools').hidden=false;
  $('lookToggle').textContent='↩ Salir de 360°';
  $('lookToggle').setAttribute('aria-pressed','true');
  $('lookStatus').textContent='Arrastra para mirar. Activando movimiento del móvil…';
  try{state.map.fov=73}catch(e){}
  repaint(routePoint(),routeProgress(),true);
  // On iOS Safari this must be invoked INSIDE the tap handler, before any await.
  let permission='unavailable';
  if(typeof DeviceOrientationEvent!=='undefined'){
   try{
    permission=typeof DeviceOrientationEvent.requestPermission==='function'
     ?await DeviceOrientationEvent.requestPermission():'granted';
   }catch(e){permission='denied'}
  }
  if(!l.active)return;
  if(permission==='granted'){
   window.addEventListener('deviceorientation',onSensor,{passive:true});
   l.permissionTimer=setTimeout(()=>{
    if(l.active&&!l.sensorWorking)
     $('lookStatus').textContent='Sin datos de movimiento: explora arrastrando con el dedo.';
   },2200);
  }else{
   $('lookStatus').textContent='Control táctil: arrastra para mirar a tu alrededor.';
  }
 }
 pad.addEventListener('pointerdown',event=>{
  if(!l.active||l.pointer!==null)return;
  l.pointer=event.pointerId;l.x=event.clientX;l.y=event.clientY;
  try{pad.setPointerCapture(event.pointerId)}catch(e){}
  event.preventDefault();
 });
 pad.addEventListener('pointermove',event=>{
  if(!l.active||l.pointer!==event.pointerId)return;
  const dx=event.clientX-l.x,dy=event.clientY-l.y;
  l.x=event.clientX;l.y=event.clientY;
  l.dragYaw-=dx*.32;
  l.dragTilt=clamp(l.dragTilt+dy*.24,-45,45);
  if(state.paused)repaint(routePoint(),routeProgress(),true);
  event.preventDefault();
 });
 function release(event){
  if(l.pointer!==event.pointerId)return;
  l.pointer=null;
  try{pad.releasePointerCapture(event.pointerId)}catch(e){}
 }
 pad.addEventListener('pointerup',release);
 pad.addEventListener('pointercancel',release);
 window.addEventListener('orientationchange',()=>{
  if(l.active){l.lastYaw=null;l.pitchZero=null}
 });
 $('lookToggle').addEventListener('click',toggle);
 $('lookRecenter').addEventListener('click',recenter);
 return {isActive:()=>l.active,repaint,disable,recenter};
}
