/**
 * Villa Pérez · Cinema Magic v2, light particles and roof dust for iPhone Safari.
 * Procedural canvas effects (no generated/composited photographs or map tiles).
 * The original city map remains untouched, fully interactive and credited.
 */
export function createMagicAtmosphere({canvas,getBalloon=()=>null,getRoofs=()=>[],getMap=()=>null,getFlying=()=>false}={}){
 if(!canvas)return {setActive(){},destroy(){}};
 const g=canvas.getContext('2d',{alpha:true});
 if(!g)return {setActive(){},destroy(){}};
 const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
 let enabled=false,raf=0,last=0,lastBirth=0,lastStar=0,w=0,h=0,dpr=1,particles=[],shoot=null;
 const max=reduce?0:(Math.min(window.innerWidth,window.innerHeight)<500?34:55);
 const random=(a,b)=>a+Math.random()*(b-a);
 const size=()=>{
  const box=canvas.getBoundingClientRect();
  w=Math.max(1,box.width);h=Math.max(1,box.height);
  dpr=Math.min(window.devicePixelRatio||1,1.5);
  const px=Math.round(w*dpr),py=Math.round(h*dpr);
  if(canvas.width!==px||canvas.height!==py){canvas.width=px;canvas.height=py}
  g.setTransform(dpr,0,0,dpr,0,0);
 };
 const clear=()=>g.clearRect(0,0,w,h);
 const spawn=()=>{
  const el=getBalloon();
  if(!el||getComputedStyle(el).display==='none')return;
  const a=el.getBoundingClientRect(),b=canvas.getBoundingClientRect();
  if(!a.width||!a.height)return;
  // Light escapes below the actual basket, not from a fixed screen coordinate.
  const x=a.left-b.left+a.width*.51,y=a.top-b.top+a.height*.92;
  if(x<0||x>w||y<0||y>h)return;
  for(let i=0;i<3&&particles.length<max;i++){
   particles.push({x:x+random(-16,16),y:y+random(-9,9),
    vx:random(-20,20),vy:random(8,35),r:random(.8,2.8),
    age:0,life:random(.8,2.1),phase:random(0,7)});
  }
 };
 function draw(t){
  raf=0;if(!enabled||document.hidden)return;
  const dt=Math.min(.07,Math.max(0,(t-last)/1000||.03));last=t;
  // Never overdrive Safari: cap the additional canvas around 25fps.
  if(t-(draw.paintAt||0)<38){raf=requestAnimationFrame(draw);return}
  draw.paintAt=t;
  size();clear();
  if(!reduce&&getFlying()&&t-lastBirth>95){lastBirth=t;spawn()}
  // A transparent, moving pool of magic light underneath the real balloon.
  if(getFlying()){
   const balloon=getBalloon();
   if(balloon&&getComputedStyle(balloon).display!=='none'){
    const a=balloon.getBoundingClientRect(),b=canvas.getBoundingClientRect();
    const cx=a.left-b.left+a.width*.50,cy=a.top-b.top+a.height*.92;
    if(cx>0&&cx<w&&cy>0&&cy<h){
     const glow=g.createRadialGradient(cx,cy,3,cx,cy,Math.min(72,w*.17));
     glow.addColorStop(0,'rgba(255,225,162,.16)');
     glow.addColorStop(.36,'rgba(242,182,103,.055)');
     glow.addColorStop(1,'rgba(255,196,90,0)');
     g.fillStyle=glow;g.fillRect(cx-75,cy-75,150,150);
    }
   }
  }
  g.save();g.globalCompositeOperation='screen';
  // The haze stays transparent; it is not a flat dark filter on the aerial image.
  if(!reduce){
   const yy=h*(.64+.025*Math.sin(t*.00016));
   const haze=g.createRadialGradient(w*.5,yy,15,w*.5,yy,Math.max(w,h)*.58);
   haze.addColorStop(0,'rgba(237,188,130,0.064)');
   haze.addColorStop(.5,'rgba(152,176,222,0.030)');
   haze.addColorStop(1,'rgba(130,164,210,0)');
   g.fillStyle=haze;g.fillRect(0,h*.2,w,h*.8);
  }
  // Roof light points derive from mapped buildings. Their geography stays real.
  const map=getMap(),roofs=getRoofs();
  if(!reduce&&map?.project&&Array.isArray(roofs)){
   const count=Math.min(25,roofs.length);
   for(let i=0;i<count;i++){
    const xy=map.project(roofs[i]);
    if(!Number.isFinite(xy.x)||!Number.isFinite(xy.y)||xy.x<3||xy.y<2||xy.x>w-3||xy.y>h-4)continue;
    const pulse=Math.pow(Math.max(0,Math.sin(t*.00075+i*2.7)),7);
    if(pulse<.21)continue;
    const radius=1.2+2*pulse;
    g.fillStyle='rgba(255,216,146,'+(.12+.32*pulse)+')';
    g.shadowColor='rgba(255,203,110,.7)';g.shadowBlur=7;
    g.beginPath();g.arc(xy.x,xy.y,radius,0,Math.PI*2);g.fill();
   }
  }
  g.shadowBlur=0;
  particles=particles.filter(p=>{
   p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
   if(p.age>=p.life||p.y>h+10)return false;
   const fade=Math.pow(Math.sin(Math.PI*p.age/p.life),1.25);
   g.fillStyle='rgba(255,222,165,'+(fade*.85).toFixed(3)+')';
   g.shadowBlur=8;g.shadowColor='rgba(255,205,101,.8)';
   g.beginPath();g.arc(p.x,p.y,p.r,0,Math.PI*2);g.fill();
   return true;
  });
  g.shadowBlur=0;
  if(!reduce&&getFlying()&&t-lastStar>19000){
   lastStar=t;shoot={born:t,x:random(.08,.45)*w,y:random(.10,.26)*h};
  }
  if(shoot){
   const k=(t-shoot.born)/820;
   if(k>1)shoot=null;
   else{
    const x=shoot.x+Math.min(145,w*.35)*k,y=shoot.y+Math.min(45,h*.10)*k;
    const line=g.createLinearGradient(x-70,y-22,x,y);
    line.addColorStop(0,'rgba(255,227,177,0)');
    line.addColorStop(1,'rgba(255,235,190,'+(.72*(1-k))+')');
    g.beginPath();g.moveTo(x-70,y-22);g.lineTo(x,y);
    g.strokeStyle=line;g.lineWidth=1.35;g.stroke();
   }
  }
  g.restore();
  raf=requestAnimationFrame(draw);
 }
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;clear()}else if(enabled&&!raf){last=0;raf=requestAnimationFrame(draw)}};
 document.addEventListener('visibilitychange',visibility);
 window.addEventListener('resize',size,{passive:true});
 size();
 return {
  setActive(value){
   const next=Boolean(value);if(next===enabled)return;enabled=next;
   cancelAnimationFrame(raf);raf=0;
   if(!next){particles=[];shoot=null;clear();return}
   last=0;lastBirth=0;lastStar=performance.now();raf=requestAnimationFrame(draw);
  },
  destroy(){enabled=false;cancelAnimationFrame(raf);raf=0;clear();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',size)}
 };
}
