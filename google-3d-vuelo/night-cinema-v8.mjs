/**
 * Villa Pérez — Noche mágica cinematográfica v8
 *
 * No second WebGL context: Google Maps owns the GPU and retains its
 * photorealistic SATELLITE 3D meshes. This is a Canvas2D atmosphere layer,
 * composited over the map but kept clear of all Google attributions.
 *
 * Not real night imagery, not mesh/material editing, and not fake windows.
 */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export class CinemaNight{
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas?.getContext?.('2d',{alpha:true})||null;
  this.target=0;this.level=0;this.phase=0;this.raf=0;this.last=0;this.lastDraw=0;
  this.enabled=true;this.reduced=Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  this.frameBound=this.frame.bind(this);this.resizeBound=this.resize.bind(this);
  this.onVisibility=()=>{
   if(document.hidden)this.stop();
   else if(this.level>0||this.target>0){
    this.resize();this.draw(performance.now());
    if(Math.abs(this.level-this.target)>.001)this.run();
   }
  };
  window.addEventListener('resize',this.resizeBound,{passive:true});
  document.addEventListener('visibilitychange',this.onVisibility);
  if(!this.ctx){this.enabled=false;this.canvas.hidden=true}
 }
 resize(){
  if(!this.ctx)return;
  const c=this.canvas,rect=c.getBoundingClientRect();
  const density=Math.min(window.devicePixelRatio||1,1.25);
  const w=Math.max(1,Math.round(rect.width*density));
  const h=Math.max(1,Math.round(rect.height*density));
  if(c.width!==w||c.height!==h){
   c.width=w;c.height=h;
   if(this.level>.003)this.draw(performance.now());
  }
 }
 draw(now=performance.now()){
  const ctx=this.ctx;if(!ctx)return;
  const {width:w,height:h}=this.canvas;
  if(w<2||h<2)return;
  ctx.clearRect(0,0,w,h);
  if(this.level<=.003)return;
  ctx.save();ctx.globalAlpha=this.level;
  // Distinct night exposure on the *city*, without flattening roof geometry:
  // dark blue shadows; deep navy in sky; slightly warmer urban horizon.
  const shade=ctx.createLinearGradient(0,0,0,h);
  shade.addColorStop(0,'rgba(2,8,24,.82)');
  shade.addColorStop(.21,'rgba(3,10,31,.77)');
  shade.addColorStop(.43,'rgba(6,15,35,.69)');
  shade.addColorStop(.68,'rgba(6,18,39,.67)');
  shade.addColorStop(1,'rgba(3,10,24,.66)');
  ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
  // Moonlight: faint blue fill, not a spotlight stamped onto a building.
  ctx.globalCompositeOperation='screen';
  const moon=ctx.createRadialGradient(w*.72,h*.13,0,w*.72,h*.13,Math.max(w,h)*.56);
  moon.addColorStop(0,'rgba(122,160,220,.13)');
  moon.addColorStop(.38,'rgba(64,109,177,.07)');
  moon.addColorStop(1,'rgba(40,86,148,0)');
  ctx.fillStyle=moon;ctx.fillRect(0,0,w,h);
  // Distant warm urban sky-glow near the horizon. This is atmospheric
  // scattering, not an invented building-mounted light.
  const centerX=w*(.36+.025*Math.sin(this.phase*Math.PI));
  const glow=ctx.createRadialGradient(centerX,h*.50,0,centerX,h*.50,Math.max(w,h)*.56);
  glow.addColorStop(0,'rgba(232,149,71,.105)');
  glow.addColorStop(.45,'rgba(147,103,72,.032)');
  glow.addColorStop(1,'rgba(100,78,76,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  // Fine atmospheric separation: restrained blue mist in the distance.
  const mist=ctx.createLinearGradient(0,h*.22,0,h*.84);
  mist.addColorStop(0,'rgba(92,128,181,0)');
  mist.addColorStop(.54,'rgba(90,121,159,.06)');
  mist.addColorStop(1,'rgba(60,100,150,0)');
  ctx.fillStyle=mist;ctx.fillRect(0,0,w,h);
  ctx.restore();
 }
 setNight(value){
  const target=value?1:0;
  this.target=target;
  document.documentElement.classList.toggle('night-css-fallback',!this.ctx&&Boolean(value));
  if(!this.ctx){
   this.canvas.hidden=true;
   return;
  }
  // Always reveal before measuring: hidden CSS would give a 0px canvas.
  this.canvas.hidden=false;this.resize();
  if(this.reduced){
   this.level=target;this.draw();
   if(!target)this.canvas.hidden=true;
   return;
  }
  this.last=0;this.run();
 }
 setProgress(v){
  this.phase=Number.isFinite(v)?clamp(v,0,1):0;
  if(this.ctx&&this.level>.99&&this.target===1&&!document.hidden){
   const now=performance.now();
   if(now-this.lastDraw>240){this.draw(now);this.lastDraw=now}
  }
 }
 run(){if(!document.hidden&&!this.raf)this.raf=requestAnimationFrame(this.frameBound)}
 frame(now){
  this.raf=0;if(document.hidden||!this.ctx)return;
  const dt=this.last?Math.min(90,now-this.last):16;this.last=now;
  const ease=Math.min(1,dt/950);
  this.level+= (this.target-this.level)*ease*2.4;
  if(Math.abs(this.target-this.level)<.006)this.level=this.target;
  if(now-this.lastDraw>55||this.level===this.target){
   this.lastDraw=now;this.draw(now);
  }
  if(this.level===0&&this.target===0){this.canvas.hidden=true;return}
  if(this.level!==this.target)this.run();
 }
 stop(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0}
 destroy(){
  this.stop();window.removeEventListener('resize',this.resizeBound);
  document.removeEventListener('visibilitychange',this.onVisibility);
  if(this.ctx)this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  document.documentElement.classList.remove('night-css-fallback');
 }
}
