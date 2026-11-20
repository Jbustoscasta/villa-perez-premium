export function installPOV({ctx,$,position,heading,paused,renderNormal,notify}){
 const el=$('povScene'),dock=$('povControls'),drag=$('povDrag'),img=$('povBasketPhoto');
 let fallback=false;
 img.addEventListener('error',()=>{if(fallback)return;fallback=true;img.src='../google-3d-vuelo/assets/vista-cesta-360.svg'});
 const p={active:false,yaw:0,dy:0,dp:0,pitch:0,yawZero:null,pitchZero:null,pointer:null,x:0,y:0,sensorOk:false};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),delta=(a,b)=>((a-b+540)%360)-180;
 function draw(coords=position()){
  if(!p.active||!ctx.map||ctx.rescue)return;
  try{ctx.map.jumpTo({center:coords,zoom:17.3,bearing:(heading()+p.yaw+p.dy+3600)%360,pitch:clamp(74+p.pitch+p.dp,35,84)})}
  catch(e){console.warn('360° MapLibre camera:',e)}
 }
 function sensor(e){
  if(!p.active)return;
  const yaw=Number.isFinite(e.webkitCompassHeading)?e.webkitCompassHeading:Number.isFinite(e.alpha)?360-e.alpha:null;
  if(yaw===null)return;
  if(p.yawZero===null){p.yawZero=yaw;if(Number.isFinite(e.beta))p.pitchZero=e.beta;return}
  const d=delta(yaw,p.yawZero);if(Math.abs(d)<160)p.yaw=d;
  if(Number.isFinite(e.beta)&&p.pitchZero!==null)p.pitch=clamp((e.beta-p.pitchZero)*.45,-29,29);
  p.sensorOk=true;
  if(paused())draw();
 }
 function recenter(){p.yawZero=null;p.pitchZero=null;p.yaw=0;p.dy=0;p.dp=0;p.pitch=0;draw()}
 function exit(){
  if(!p.active)return;p.active=false;
  document.body.classList.remove('pov-active');el.hidden=true;dock.hidden=true;
  $('povToggle').textContent='🔭 Mira desde el globo · 360°';
  $('povToggle').setAttribute('aria-pressed','false');
  window.removeEventListener('deviceorientation',sensor);
  renderNormal();
 }
 async function toggle(){
  if(p.active){exit();return}
  if(ctx.rescue||!ctx.map?.jumpTo){notify('El 360° necesita el visor 3D.');return}
  if(!ctx.playing||ctx.overview||!['route','orbit'].includes(ctx.phase)){
   notify('Podrás mirar desde la cesta después de despegar.');return
  }
  p.active=true;recenter();document.body.classList.add('pov-active');
  el.hidden=false;dock.hidden=false;
  $('povPause').textContent=paused()?'▶ Continuar':'⏸ Pausar';
  $('povToggle').textContent='↩ Salir de la cesta';
  $('povToggle').setAttribute('aria-pressed','true');
  $('povHint').textContent='Gira el móvil o arrastra con el dedo.';
  draw();
  let permission='granted';
  if(typeof DeviceOrientationEvent==='undefined')permission='unavailable';
  else if(typeof DeviceOrientationEvent.requestPermission==='function'){
   try{permission=await DeviceOrientationEvent.requestPermission()}catch(_){permission='denied'}
  }
  if(!p.active)return;
  if(permission==='granted'){
   window.addEventListener('deviceorientation',sensor,{passive:true});
   setTimeout(()=>{if(p.active&&!p.sensorOk)$('povHint').textContent='Arrastra con el dedo si los sensores no responden.'},2400)
  }else $('povHint').textContent='Explora arrastrando con el dedo.';
 }
 drag.addEventListener('pointerdown',e=>{
  if(!p.active||p.pointer!==null)return;
  p.pointer=e.pointerId;p.x=e.clientX;p.y=e.clientY;
  try{drag.setPointerCapture(e.pointerId)}catch(_){}
  e.preventDefault()
 });
 drag.addEventListener('pointermove',e=>{
  if(!p.active||p.pointer!==e.pointerId)return;
  p.dy-=(e.clientX-p.x)*.32;p.dp=clamp(p.dp+(e.clientY-p.y)*.22,-39,39);
  p.x=e.clientX;p.y=e.clientY;draw();e.preventDefault()
 });
 function release(e){if(p.pointer!==e.pointerId)return;p.pointer=null;try{drag.releasePointerCapture(e.pointerId)}catch(_){}}
 drag.addEventListener('pointerup',release);drag.addEventListener('pointercancel',release);
 window.addEventListener('orientationchange',()=>{p.yawZero=null;p.pitchZero=null});
 $('povToggle').addEventListener('click',toggle);
 $('povExit').addEventListener('click',exit);
 $('povRecenter').addEventListener('click',recenter);
 $('povPause').addEventListener('click',()=>{$('pause').click();$('povPause').textContent=paused()?'▶ Continuar':'⏸ Pausar'});
 return {isActive:()=>p.active,draw,exit,recenter};
}