/*
 * VILLA PÉREZ — El vuelo mágico | v1.5.4
 * Static, local-first editor. No API keys, third-party SDKs or server uploads.
 * The user controls a curved motion path; a chroma-keyed local video or official
 * transparent art follows it.  Video compositing and export happen in the browser.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('sceneCanvas'), ctx = canvas.getContext('2d', { alpha: false });
  const overlay = $('overlayCanvas'), octx = overlay.getContext('2d');
  const stage = $('stage'), video = $('assetVideo'), sound = $('magicAudio');
  const transform = $('balloonTransform'), sizePanel = $('sceneSizePanel'), scenePlayer = $('scenePlayer');
  const sprite = new Image(); sprite.src = 'assets/perez-globo-iphone.webp';
  const DEFAULT_VIDEO = 'assets/raton-perez-vuelo.mp4?v=minimax8';
  const W = () => canvas.width, H = () => canvas.height;
  const CLAMP = (x,a,b) => Math.max(a,Math.min(b,x));
  const lerp = (a,b,t) => a+(b-a)*t;
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const point = (x,y) => ({x,y});
  const R = (a,b,c) => { let x = Math.sin((a+1)*128.37 + (b+1)*83.72 + (c+1)*59.3)*43758.545; return x-Math.floor(x); };

  const suggested = [point(-.26,.29),point(-.12,.30),point(.18,.29),point(.46,.32),point(.74,.27),point(1.25,.22),point(1.32,.53),point(1.12,.56),point(.78,.58),point(.51,.51),point(.35,.58),point(.14,.57),point(-.24,.49)];
  const state = {
    photo:null, photoUrl:null, videoUrl:null, loadedVideo:false,
    mode:'draw', path:suggested.map(p=>({...p})), pathName:'sugerida', smoothPath:[], sampled:[], target:null,
    photoZoom:1, panX:0,panY:0, size:.22, duration:15, magic:.65, chromaStrength:.55,
    autoLight:true, lightManual:1, appliedExposure:.65, soundLevel:.55,
    playing:false, seeking:false, time:0, startedAt:0, frameRequest:0,
    recording:false, recorder:null, exportCancelled:false, exportBlob:null, exportName:null,
    spriteReady:false, silent:false, hasDrawn:false,
  };
  let toastTimer;
  function toast(text) { const t=$('toast');t.textContent=text;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3700); }

  /* Milestones narrativos en vez de un panel de edición convencional. */
  function setJourneyStep(step){
    for(const [index,id] of [[1,'storyStepPhoto'],[2,'storyStepFlight'],[3,'storyStepMemory']]){
      const el=$(id);if(!el)continue;
      el.classList.toggle('is-active',index===step);
      el.classList.toggle('is-done',index<step);
      if(index===step)el.setAttribute('aria-current','step');
      else el.removeAttribute('aria-current');
    }
  }
  function setCameraStep(index,title){
    const el=$('cameraStepIndicator');if(!el)return;
    const number=el.querySelector('.camera-step-index');
    const label=el.querySelector('strong');
    if(number)number.textContent=String(index).padStart(2,'0')+' / 03';
    if(label)label.textContent=title;
  }

  const formatTime = sec=>`00:${String(Math.floor(sec)).padStart(2,'0')}`;
  const setHint = msg=>$('contextHint').innerHTML=`✦ <span>${msg}</span>`;
  const saveSettings = () => {try {localStorage.setItem('villaperez-flight-v1', JSON.stringify({path:state.path,target:state.target,duration:state.duration,size:state.size,magic:state.magic,autoLight:state.autoLight,lightManual:state.lightManual,soundLevel:state.soundLevel}));} catch {} };
  function restoreSettings() {try {const a=JSON.parse(localStorage.getItem('villaperez-flight-v1')||'null');if(!a)return;if(Array.isArray(a.path)&&a.path.length>1&&a.path.length<3000){const safe=a.path.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));if(safe.length>=2)state.path=safe;}if(a.target&&Number.isFinite(a.target.x)&&Number.isFinite(a.target.y))state.target=a.target;if(Number.isFinite(a.duration))state.duration=CLAMP(a.duration,8,30);if(Number.isFinite(a.size))state.size=CLAMP(a.size,.1,.43);if(Number.isFinite(a.magic))state.magic=CLAMP(a.magic,0,1);if(typeof a.autoLight==='boolean')state.autoLight=a.autoLight;if(Number.isFinite(a.lightManual))state.lightManual=CLAMP(a.lightManual,.3,1.5);if(Number.isFinite(a.soundLevel))state.soundLevel=CLAMP(a.soundLevel,0,1);}catch{} }
  function setProgressUi() {$('scrub').value=Math.round(state.time/state.duration*1000);$('elapsed').textContent=formatTime(state.time);$('totalTime').textContent=formatTime(state.duration);$('durationValue').textContent=`${state.duration} s`;$('mobileDuration').textContent=`Solo en tu móvil · ${state.duration} s`; }

  /* Chaikin corner cutting + uniform-distance Catmull-style resampling. */
  function smoothed(points) {
    if(points.length<2)return points;
    let pts=points.filter((p,i)=>i===0||dist(p,points[i-1])>.001);
    if(pts.length===1)return pts;
    for(let iter=0;iter<3;iter++) {
      const next=[pts[0]];
      for(let i=0;i<pts.length-1;i++) {
        const a=pts[i],b=pts[i+1];
        next.push(point(.75*a.x+.25*b.x,.75*a.y+.25*b.y));
        next.push(point(.25*a.x+.75*b.x,.25*a.y+.75*b.y));
      }
      next.push(pts[pts.length-1]);pts=next;
      if(pts.length>4000)break;
    }
    return pts;
  }
  function buildPath() {
    state.smoothPath=smoothed(state.path);
    if(state.smoothPath.length<2) { state.sampled=[{...state.smoothPath[0],d:0,cost:0}];return; }
    const line=state.smoothPath, acc=[{...line[0],d:0,cost:0}];
    let traveled=0, cost=0;
    for(let i=1;i<line.length;i++) {
      const dx=line[i].x-line[i-1].x,dy=line[i].y-line[i-1].y;
      const step=Math.hypot(dx,dy);if(step<1e-7)continue;
      traveled+=step;
      let multiplier=1;
      if(state.target){const mid=point((line[i].x+line[i-1].x)/2,(line[i].y+line[i-1].y)/2),d=dist(mid,state.target);multiplier+=3.2*Math.exp(-d*d/(2*.12*.12));}
      cost+=step*multiplier;
      acc.push({...line[i],d:traveled,cost});
    }
    state.sampled=acc;state.totalCost=cost;
    $('routeStatus').textContent=state.pathName==='manual'?'Recorrido dibujado': 'Vuelo sugerido cargado';
    $('routeLength').textContent=`${Math.round(state.duration)} s`;
    saveSettings();
  }
  function at(t) {
    const arr=state.sampled, n=arr.length;if(n===0)return point(.5,.5);if(n===1)return arr[0];
    // Slight initial and end deceleration, otherwise distance-based travel.
    const q=CLAMP(t/state.duration,0,1);
    const ease=q<.08 ? .08*Math.sin(q/.08*Math.PI/2) : q>.92 ? .92+.08*(1-Math.cos((q-.92)/.08*Math.PI/2)) : q;
    const target=ease*state.totalCost;
    let lo=0,hi=n-1;
    while(lo<hi){const m=(lo+hi)>>1;if(arr[m].cost<target)lo=m+1;else hi=m;}
    const i=Math.max(1,lo),a=arr[i-1],b=arr[i];
    const p=CLAMP((target-a.cost)/Math.max(1e-8,b.cost-a.cost),0,1);
    return point(lerp(a.x,b.x,p),lerp(a.y,b.y,p));
  }

  function drawBackdrop() {
    const w=W(),h=H();ctx.fillStyle='#162239';ctx.fillRect(0,0,w,h);
    if(state.photo) {
      const im=state.photo;
      const scale=Math.max(w/im.width,h/im.height)*state.photoZoom;
      const dw=im.width*scale,dh=im.height*scale;
      ctx.drawImage(im,(w-dw)/2+state.panX*w,(h-dh)/2+state.panY*h,dw,dh);
      // Soft photographic night grading, reduced so actual photo stays natural.
      const vignette=ctx.createRadialGradient(w/2,h*.45,w*.1,w/2,h*.5,w*.95);
      vignette.addColorStop(0,'#07112400');vignette.addColorStop(1,'#08162C4C');
      ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    } else {
      const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#24395a');g.addColorStop(1,'#101a2b');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      for(let i=0;i<32;i++){ctx.fillStyle=`rgba(255,229,181,${.10+R(i,1,2)*.25})`;ctx.beginPath();ctx.arc(R(i,2,3)*w,R(i,2,4)*h*.62,1+R(i,2,5)*1.4,0,Math.PI*2);ctx.fill();}
    }
  }

  // Local smart lighting: one tiny photo-only luminance map, not cloud AI.
  // No photographs or per-pixel data leave the visitor's device.
  const ambienceCanvas=document.createElement('canvas');
  ambienceCanvas.width=64;ambienceCanvas.height=114;
  const ambienceCtx=ambienceCanvas.getContext('2d',{willReadFrequently:true});
  let ambiencePixels=null,ambienceDirty=true,lightSmoothed=null,lastChip='';
  function rebuildAmbient(){
    ambienceDirty=false;ambiencePixels=null;
    if(!state.photo||!ambienceCtx)return;
    try{
      const w=ambienceCanvas.width,h=ambienceCanvas.height,im=state.photo;
      ambienceCtx.fillStyle='#10131d';ambienceCtx.fillRect(0,0,w,h);
      const scale=Math.max(w/im.width,h/im.height)*state.photoZoom;
      const dw=im.width*scale,dh=im.height*scale;
      ambienceCtx.drawImage(im,(w-dw)/2+state.panX*w,(h-dh)/2+state.panY*h,dw,dh);
      ambiencePixels=ambienceCtx.getImageData(0,0,w,h).data;
    }catch(e){console.warn('No se pudo medir luz ambiente',e);}
  }
  function localBrightness(pos){
    if(ambienceDirty)rebuildAmbient();
    if(!ambiencePixels)return .14;
    const w=ambienceCanvas.width,h=ambienceCanvas.height;
    const x=Math.round(CLAMP(pos.x,0,1)*(w-1)),y=Math.round(CLAMP(pos.y,0,1)*(h-1));
    // Sample local area behind the balloon; ignore one bright bedside light.
    let sum=0,total=0;
    for(let dy=-5;dy<=5;dy+=2){
      for(let dx=-4;dx<=4;dx+=2){
        const sx=CLAMP(x+dx,0,w-1),sy=CLAMP(y+dy,0,h-1);
        const i=(sy*w+sx)*4;
        const r=ambiencePixels[i]/255,g=ambiencePixels[i+1]/255,b=ambiencePixels[i+2]/255;
        const l=.2126*r*r+.7152*g*g+.0722*b*b;
        sum+=Math.sqrt(l);total++;
      }
    }
    return total?sum/total:.14;
  }
  function exposureFor(t){
    const p=editingPos(t);
    const l=localBrightness(p);
    const automatic=CLAMP(.24+.94*Math.pow(l,.79),.24,1.06);
    const target=CLAMP((state.autoLight?automatic:1)*state.lightManual,.16,1.48);
    if(lightSmoothed===null||!state.playing)lightSmoothed=target;
    else lightSmoothed+=(target-lightSmoothed)*.11;
    state.appliedExposure=lightSmoothed;
    const label=state.autoLight?'☾ Auto '+Math.round(lightSmoothed*100)+'%':'☾ Manual '+Math.round(lightSmoothed*100)+'%';
    if(label!==lastChip){
      const chip=$('lightBadge');chip.textContent=label;chip.classList.toggle('manual',!state.autoLight);
      lastChip=label;
    }
    return lightSmoothed;
  }

  function glowingStar(x,y,r,alpha) {
    if(alpha<=0)return;
    ctx.save();ctx.globalAlpha=CLAMP(alpha,0,1);ctx.shadowBlur=r*5;ctx.shadowColor='#ffd990';ctx.fillStyle='#ffe5a5';ctx.beginPath();ctx.arc(x,y,Math.max(.7,r*.32),0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ffdc90';ctx.lineWidth=Math.max(.65,r*.19);ctx.beginPath();ctx.moveTo(x-r*1.3,y);ctx.lineTo(x+r*1.3,y);ctx.moveTo(x,y-r*1.3);ctx.lineTo(x,y+r*1.3);ctx.stroke();ctx.restore();
  }
  function drawParticles(t) {
    if(state.magic<=0)return;
    const count=Math.round(120*state.magic);
    for(let i=0;i<count;i++) {
      const born=(i+.25)/count*state.duration,age=t-born;
      if(age<0||age>2.0)continue;
      const p=at(born),tail=at(Math.min(state.duration,born+.12));
      const dx=tail.x-p.x,dy=tail.y-p.y;
      const off=(R(i,1,9)-.5)*.067;
      const px=(p.x-dx*.1 -dy*off + (R(i,2,9)-.5)*.018 + age*.009)*W();
      const py=(p.y-dy*.1 +dx*off+(R(i,3,9)-.5)*.02+age*.015)*H();
      const a=(1-age/2)*(.4+R(i,4,9)*.5)*state.magic;
      const rad=(.9+R(i,5,9)*2.5)*W()/720;
      glowingStar(px,py,rad,a*Math.pow(Math.max(.18,state.appliedExposure),.53));
    }
  }

  // GPU green-screen compositor: only the user's local video blob is read.
  let keyer=null;
  function makeKeyer(){
    const keyCanvas=document.createElement('canvas');keyCanvas.width=360;keyCanvas.height=640;
    const gl=keyCanvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false});
    if(!gl)return {keyCanvas,cpuCtx:keyCanvas.getContext('2d',{willReadFrequently:true}),crop:null};
    const vs='attribute vec2 pos;varying vec2 uv;void main(){uv=(pos+1.0)*0.5;gl_Position=vec4(pos,0.0,1.0);}';
    const fs='precision mediump float;varying vec2 uv;uniform sampler2D tex;uniform float threshold;uniform float exposure;void main(){vec4 c=texture2D(tex,uv);float dom=c.g-max(c.r,c.b);float green=smoothstep(threshold-.095,threshold+.095,dom);float a=1.0-green;float leak=max(0.0,c.g-max(c.r,c.b));c.g-=leak*.60*green;float gray=dot(c.rgb,vec3(.2126,.7152,.0722));vec3 col=mix(vec3(gray),c.rgb,clamp(.69+.30*exposure,.65,1.0));col*=exposure;col.b*=.96;gl_FragColor=vec4(col,a);}';
    const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};
    const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const tx=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tx);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program,'tex'),0);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    return {gl,keyCanvas,threshold:gl.getUniformLocation(program,'threshold'),exposure:gl.getUniformLocation(program,'exposure'),crop:null,frameReady:false};
  }
  function applyKey() {
    if(!state.loadedVideo||!keyer||video.readyState<2)return null;
    const keyCanvas=keyer.keyCanvas;
    try {
      let pix,bottomUp=false;
      const threshold=.45-state.chromaStrength*.41;
      if(keyer.cpuCtx){
        // Canvas2D fallback for older iPhones, browsers with WebGL disabled,
        // and headless verification environments. Input is only a local file.
        const kc=keyer.cpuCtx;kc.clearRect(0,0,keyCanvas.width,keyCanvas.height);
        kc.drawImage(video,0,0,keyCanvas.width,keyCanvas.height);
        const imageData=kc.getImageData(0,0,keyCanvas.width,keyCanvas.height);
        pix=imageData.data;
        for(let i=0;i<pix.length;i+=4){
          const red=pix[i]/255,green=pix[i+1]/255,blue=pix[i+2]/255;
          const dominance=green-Math.max(red,blue);
          const u=CLAMP((dominance-(threshold-.095))/.19,0,1);
          const ch=u*u*(3-2*u);
          pix[i+3]=Math.round(255*(1-ch));
          pix[i+1]=Math.round(255*Math.max(0,green-Math.max(0,dominance)*.60*ch));
          // Apply image-matched lighting AFTER identifying the green pixels.
          const luminosity=.2126*pix[i]+.7152*pix[i+1]+.0722*pix[i+2];
          const sat=CLAMP(.69+.30*state.appliedExposure,.65,1);
          const brightness=state.appliedExposure;
          pix[i]=Math.round(CLAMP((luminosity+(pix[i]-luminosity)*sat)*brightness,0,255));
          pix[i+1]=Math.round(CLAMP((luminosity+(pix[i+1]-luminosity)*sat)*brightness,0,255));
          pix[i+2]=Math.round(CLAMP((luminosity+(pix[i+2]-luminosity)*sat)*brightness*.96,0,255));
        }
        kc.putImageData(imageData,0,0);
      } else {
        const gl=keyer.gl;gl.viewport(0,0,keyCanvas.width,keyCanvas.height);
        gl.uniform1f(keyer.threshold,threshold);
        gl.uniform1f(keyer.exposure,state.appliedExposure);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      }
      if(!keyer.crop) {
        if(!keyer.cpuCtx){const gl=keyer.gl;pix=new Uint8Array(4*keyCanvas.width*keyCanvas.height);gl.readPixels(0,0,keyCanvas.width,keyCanvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pix);bottomUp=true;}
        let minX=keyCanvas.width,minY=keyCanvas.height,maxX=0,maxY=0,num=0;
        for(let y=0;y<keyCanvas.height;y+=2)for(let x=0;x<keyCanvas.width;x+=2){const a=pix[(y*keyCanvas.width+x)*4+3];if(a>205){num++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
        if(num>100&&maxX-minX>35&&maxY-minY>70&&maxY-minY<keyCanvas.height*.94){
          const m=20;
          keyer.crop={x:Math.max(0,minX-m),y:Math.max(0,(bottomUp?keyCanvas.height-1-maxY:minY)-m),w:Math.min(keyCanvas.width,maxX-minX+2*m),h:Math.min(keyCanvas.height,maxY-minY+2*m)};
        }else keyer.crop={x:18,y:26,w:324,h:588};
      }
      return keyCanvas;
    }catch(err){console.warn('Chroma frame not ready',err);return null;}
  }

  // Edit mode shows a reference balloon inside the photo even when the real
  // flight route begins outside the frame. Playback/export follow exact path.
  function editingPos(t){
    const p=at(t);
    if(state.playing||state.recording||!state.photo)return p;
    const safeXMin=.10+state.size*.56, safeXMax=.90-state.size*.56;
    const safeYMin=.11+state.size*.50, safeYMax=.83-state.size*.50;
    if(Number.isFinite(p.x)&&p.x>=safeXMin&&p.x<=safeXMax&&p.y>=safeYMin&&p.y<=safeYMax)return p;
    let best=null,bestCost=Infinity;
    for(let i=0;i<=48;i++){
      const candidate=at(state.duration*i/48);
      if(!Number.isFinite(candidate.x)||!Number.isFinite(candidate.y))continue;
      if(candidate.x<safeXMin||candidate.x>safeXMax||candidate.y<safeYMin||candidate.y>safeYMax)continue;
      const score=Math.abs(candidate.x-.50)*1.5+Math.abs(candidate.y-.43)*.65;
      if(score<bestCost){bestCost=score;best=candidate;}
    }
    return best||point(.5,.42);
  }
  function updateBalloonControls(){
    const visible=!!state.photo&&!state.playing&&!state.recording;
    transform.hidden=!visible;sizePanel.hidden=!visible;scenePlayer.hidden=!state.photo;
    $('sceneToolDock').hidden=!visible;$('lightBadge').hidden=!visible;
    $('sceneQuickActions').hidden=!state.photo||state.recording;
    $('mobileActionDock').hidden=!state.photo||state.recording;
    if(!visible)return;
    const pos=editingPos(state.time);
    const h=stage.clientHeight*state.size;
    const aspect=state.loadedVideo&&keyer?.crop?keyer.crop.w/keyer.crop.h:
      sprite.naturalHeight?sprite.naturalWidth/sprite.naturalHeight:.59;
    transform.style.width=Math.max(34,h*aspect)+'px';
    transform.style.height=h+'px';
    transform.style.left=pos.x*100+'%';
    transform.style.top=pos.y*100+'%';
    transform.style.transform='translate(-50%,-50%)';
  }
  function setSize(value){
    state.size=CLAMP(Number(value)/100,.1,.43);
    const n=Math.round(state.size*100);
    $('sizeControl').value=n;$('sizeValue').textContent=n+'%';
    drawFrame();saveSettings();
  }
  function updatePlayUi(){
    const btn=$('playBtn');
    btn.textContent=state.playing?'Ⅱ Pausa':'▶ Ver magia';
    btn.setAttribute('aria-label',state.playing?'Pausar vuelo':'Reproducir vuelo');
    btn.disabled=state.recording||!state.photo;
  }

  function drawBalloon(t) {
    const pos=editingPos(t);
    const bob=.0045*Math.sin(t*2*Math.PI/7.2),swing=Math.sin(t*2*Math.PI/6.1)*.022;
    const x=(pos.x)*W(),y=(pos.y+bob)*H();
    const spriteHeight=H()*state.size;
    ctx.save();ctx.translate(x,y);ctx.rotate(swing);ctx.shadowColor='#040c18';ctx.shadowBlur=H()*.009;ctx.shadowOffsetY=H()*.006;
    let source=null,crop=null,aspect=.59;
    if(state.loadedVideo&&keyer){source=applyKey();if(source&&keyer.crop){crop=keyer.crop;aspect=crop.w/crop.h;}}
    if(!source&&state.spriteReady){source=sprite;aspect=sprite.naturalWidth/sprite.naturalHeight;}
    if(source) {
      // Safari/Canvas2D fallback has GPU-independent exposure via canvas filter.
      if(!state.loadedVideo){
        ctx.filter='brightness('+state.appliedExposure.toFixed(3)+') saturate('+Math.min(1,state.appliedExposure*.85+.12).toFixed(3)+')';
      }
      const h=spriteHeight, w=h*aspect;
      if(crop)ctx.drawImage(source,crop.x,crop.y,crop.w,crop.h,-w/2,-h/2,w,h);
      else ctx.drawImage(source,-w/2,-h/2,w,h);
    }
    ctx.restore();
  }

  // The child's magic-camera HUD is painted into the exported video itself.
  // It uses the same green night-vision graphics as camara-espia, scaled to 9:16.
  function drawMagicCameraHud(t){
    const w=W(),h=H(),u=w/720;
    const green='#adffcc',edge='#80ffaf';
    const top=h*.052,bottom=h*.948,pad=w*.055;
    const font=(size,weight=700)=>{ctx.font=weight+' '+(size*u)+'px ui-monospace, SFMono-Regular, Consolas, monospace';};
    const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
    const plate=(x,y,width,height)=>{
      ctx.save();ctx.fillStyle='rgba(0,22,17,.70)';ctx.shadowBlur=0;
      ctx.beginPath();
      if(typeof ctx.roundRect==='function')ctx.roundRect(x,y,width,height,8*u);
      else ctx.rect(x,y,width,height);
      ctx.fill();ctx.restore();
    };
    ctx.save();
    // Fine scanlines add a camera texture without obscuring the room or Pérez.
    ctx.fillStyle='rgba(7,31,27,.075)';
    for(let y=0;y<h;y+=8*u)ctx.fillRect(0,y,w,1*u);
    ctx.textBaseline='middle';ctx.fillStyle=green;ctx.strokeStyle=edge;
    ctx.lineWidth=2.4*u;ctx.lineCap='round';
    ctx.shadowColor='rgba(103,255,179,.55)';ctx.shadowBlur=5*u;
    // Four green viewfinder corner brackets.
    const mx=w*.027,my=h*.023,l=38*u;
    for(const [x,y,sx,sy] of [[mx,my,1,1],[w-mx,my,-1,1],[mx,h-my,1,-1],[w-mx,h-my,-1,-1]]){
      ctx.beginPath();ctx.moveTo(x+sx*l,y);ctx.lineTo(x,y);ctx.lineTo(x,y+sy*l);ctx.stroke();
    }
    // REC stays legible while its red indicator pulses every 1.2 seconds.
    plate(pad,top-21*u,116*u,42*u);
    ctx.save();ctx.fillStyle='#ff414f';ctx.shadowColor='#ff213c';ctx.shadowBlur=9*u;
    ctx.globalAlpha=.23+.77*(.5+.5*Math.cos(2*Math.PI*t/1.2));
    ctx.beginPath();ctx.arc(pad+19*u,top,8*u,0,2*Math.PI);ctx.fill();ctx.restore();
    font(25,900);ctx.textAlign='left';ctx.fillStyle='#ff646a';ctx.fillText('REC',pad+35*u,top);
    // Fictional capture time: starts at 06:34:00, independent of the real clock.
    const seconds=String(Math.floor(Math.max(0,t))).padStart(2,'0');
    plate(w/2-100*u,top-21*u,200*u,42*u);
    ctx.fillStyle=green;ctx.textAlign='center';font(27,800);ctx.fillText('06:34:'+seconds,w/2,top);
    // Battery/CAM indicator (drawn geometrically for identical rendering on iOS).
    const bx=w-pad-113*u;
    plate(bx,top-18*u,113*u,36*u);
    ctx.strokeStyle=green;ctx.lineWidth=2*u;ctx.strokeRect(bx+10*u,top-8*u,28*u,16*u);
    ctx.fillRect(bx+39*u,top-3*u,3*u,6*u);ctx.fillRect(bx+14*u,top-4*u,20*u,8*u);
    font(20,700);ctx.textAlign='left';ctx.fillText('CAM',bx+48*u,top);
    // Central focus reticle, deliberately discreet.
    ctx.save();ctx.globalAlpha=.55;ctx.strokeStyle=edge;ctx.lineWidth=1.8*u;
    ctx.setLineDash([5*u,5*u]);ctx.strokeRect(w/2-39*u,h/2-39*u,78*u,78*u);
    ctx.setLineDash([]);line(w/2-13*u,h/2,w/2+13*u,h/2);line(w/2,h/2-13*u,w/2,h/2+13*u);ctx.restore();
    plate(pad,bottom-19*u,240*u,38*u);
    font(21,700);ctx.fillStyle=green;ctx.textAlign='left';ctx.fillText('☾ Visión nocturna',pad+10*u,bottom);
    // Coverage bars, matching the child's ▂▄▆ signal.
    const right=w-pad,barW=9*u,gap=5*u;
    for(let i=0;i<3;i++){
      const bh=(9+i*9)*u;
      ctx.fillRect(right-(3-i)*(barW+gap),bottom+12*u-bh,barW,bh);
    }
    ctx.restore();
  }



  // Analog tracking loss + digital packet breakup. The full HUD is affected,
  // not just the room. Rendered on the same canvas in preview and export.
  const signalBuffer=document.createElement('canvas');
  signalBuffer.id='signalGlitchBuffer';
  const signalCtx=signalBuffer.getContext('2d',{alpha:false});
  const noiseBuffer=document.createElement('canvas');
  noiseBuffer.id='signalNoiseBuffer';
  noiseBuffer.width=240;noiseBuffer.height=320;
  const noiseCtx=noiseBuffer.getContext('2d',{alpha:false});
  const noisePixels=noiseCtx?.createImageData(noiseBuffer.width,noiseBuffer.height);
  let noiseStep=-1;
  function signalInterferenceAt(t,duration=state.duration){
    const smooth=x=>{x=CLAMP(x,0,1);return x*x*(3-2*x);};
    // 1.65 seconds to lock on; 2.1 seconds to lose the signal.
    const arrival=1-smooth((t-.24)/1.41);
    const departure=smooth((t-(duration-2.1))/1.55);
    return Math.max(arrival,departure);
  }
  function refreshSignalNoise(step){
    if(step===noiseStep||!noiseCtx||!noisePixels)return;
    noiseStep=step;
    const d=noisePixels.data,nw=noiseBuffer.width,nh=noiseBuffer.height;
    let seed=((step+1)*2654435761)>>>0;
    for(let y=0;y<nh;y++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const lineBias=(seed>>>25)-64;
      for(let x=0;x<nw;x++){
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        const v=CLAMP(25+(seed>>>25)*1.25+lineBias*.42,8,186);
        const i=(y*nw+x)*4;
        d[i]=v*.81;d[i+1]=v;d[i+2]=v*.92;d[i+3]=255;
      }
    }
    noiseCtx.putImageData(noisePixels,0,0);
  }
  function drawSignalInterference(t){
    const strength=signalInterferenceAt(t);
    if(strength<.012||!signalCtx)return;
    const w=W(),h=H(),u=w/720,step=Math.floor(t*18);
    const closing=t>state.duration-2.1;
    const edgeLoss=closing?CLAMP((t-(state.duration-.66))/.34,0,1):
      1-CLAMP((t-.10)/.65,0,1);
    if(signalBuffer.width!==w||signalBuffer.height!==h){
      signalBuffer.width=w;signalBuffer.height=h;
    }
    signalCtx.drawImage(canvas,0,0);
    ctx.save();ctx.shadowBlur=0;
    // Rolling sync break: displace broad horizontal chunks of the whole image.
    // The source is a separate reusable canvas, so no recursive smearing.
    const bands=5+Math.round(strength*11);
    for(let i=0;i<bands;i++){
      const y=Math.floor(R(step,i,71)*h);
      const bh=Math.min(h-y,Math.max(1,Math.floor((7+R(step,i,72)*63)*u*strength)));
      const offset=Math.round((R(step,i,73)-.5)*w*.29*strength);
      if(!offset)continue;
      ctx.drawImage(signalBuffer,0,y,w,bh,offset,y,w,bh);
      ctx.fillStyle='rgba(3,17,19,'+(.8*strength)+')';
      if(offset>0)ctx.fillRect(0,y,offset,bh);
      else ctx.fillRect(w+offset,y,-offset,bh);
    }
    // A continuous tracking bar travels down the picture, like old CCTV/VHS.
    const roll=((t*1.45+(closing?.21:0))%1)*h;
    const bh=Math.min(h-roll,h*.12*strength);
    if(bh>0){
      const off=w*.13*strength*(closing?-1:1);
      ctx.drawImage(signalBuffer,0,roll,w,bh,off,roll,w,bh);
      ctx.fillStyle='rgba(7,22,23,'+(.44*strength)+')';
      ctx.fillRect(0,roll,w,bh);
    }
    // Digital packet loss: coarse displaced image blocks with occasional
    // muted cyan or magenta chroma breakup. Not a decorative particle effect.
    for(let i=0;i<Math.round(13*strength);i++){
      const bw=Math.min(w,(28+R(step,i,91)*140)*u);
      const bh=(8+R(step,i,92)*32)*u;
      const x=R(step,i,93)*(w-bw),y=R(step,i,94)*Math.max(0,h-bh);
      const sx=CLAMP(x+(R(step,i,95)-.5)*w*.25,0,w-bw);
      ctx.drawImage(signalBuffer,sx,y,bw,bh,x,y,bw,bh);
      ctx.fillStyle=i%3===0?'rgba(104,168,156,'+(.30*strength)+')':
        i%3===1?'rgba(92,49,107,'+(.25*strength)+')':'rgba(5,14,19,'+(.46*strength)+')';
      ctx.fillRect(x,y,bw,bh);
    }
    // Actual dense TV snow: low-resolution seeded grain, scaled without blur.
    // Stable average brightness and smooth envelopes avoid full-screen flashes.
    refreshSignalNoise(step);
    if(noiseCtx){
      ctx.imageSmoothingEnabled=false;
      ctx.globalAlpha=.24*strength+.73*edgeLoss;
      ctx.drawImage(noiseBuffer,0,0,w,h);
      ctx.globalAlpha=1;
    }
    // Distinct stationary tracking lines and a dark loss-of-sync band.
    ctx.fillStyle='rgba(2,12,15,'+(.15*strength)+')';
    for(let y=0;y<h;y+=5*u)ctx.fillRect(0,y,w,1.4*u);
    const center=roll;
    const gradient=ctx.createLinearGradient(0,Math.max(0,center-45*u),0,Math.min(h,center+45*u));
    gradient.addColorStop(0,'rgba(0,12,15,0)');
    gradient.addColorStop(.5,'rgba(0,12,15,'+(.65*strength)+')');
    gradient.addColorStop(1,'rgba(0,12,15,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,Math.max(0,center-45*u),w,90*u);
    // The recording starts with a signal lock and ends with a genuine dropout.
    // No bright cut: the last .32s holds the dark static screen.
    if(edgeLoss>.68){
      ctx.fillStyle='rgba(2,13,17,'+(.26*edgeLoss)+')';ctx.fillRect(0,0,w,h);
      ctx.fillStyle='rgba(3,18,19,.84)';
      ctx.fillRect(w*.16,h*.47,w*.68,h*.06);
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='700 '+(25*u)+'px ui-monospace, SFMono-Regular, Consolas, monospace';
      ctx.fillStyle='#adffcc';
      ctx.fillText(closing?'SIN SEÑAL':'SEÑAL INESTABLE',w/2,h*.5);
    }
    ctx.restore();
  }

  function drawFrame(t=state.time) {
    ctx.save();ctx.clearRect(0,0,W(),H());drawBackdrop();if(state.photo){exposureFor(t);drawParticles(t);drawBalloon(t);if(state.playing||state.recording){drawMagicCameraHud(t);drawSignalInterference(t);}}ctx.restore();
    drawOverlay();setProgressUi();updateBalloonControls();
  }
  function drawOverlay() {
    const w=overlay.width,h=overlay.height;octx.clearRect(0,0,w,h);
    if(state.playing||state.recording||!state.photo)return;
    const pts=state.smoothPath;
    if(pts.length>1) {
      octx.save();octx.beginPath();octx.moveTo(pts[0].x*w,pts[0].y*h);
      for(let i=1;i<pts.length;i++)octx.lineTo(pts[i].x*w,pts[i].y*h);
      // Brillos puntuales: una estela de estrellas, no una ruta técnica.
      const glow=octx.createLinearGradient(0,0,w,h);
      glow.addColorStop(0,'#c3c6ff');glow.addColorStop(.5,'#ffe2a4');glow.addColorStop(1,'#a6e4dc');
      octx.lineWidth=Math.max(1.7,w*.0025);
      octx.lineCap='round';octx.setLineDash([Math.max(1,w*.0022),Math.max(8,w*.014)]);
      octx.strokeStyle=glow;octx.shadowBlur=13;octx.shadowColor='#f4cf94';
      octx.stroke();octx.setLineDash([]);
      const stride=Math.max(1,Math.floor(pts.length/27));
      octx.shadowBlur=9;octx.fillStyle='#ffe8bb';
      for(let j=stride;j<pts.length-stride;j+=stride){
        const p=pts[j];if(p.x<0||p.x>1||p.y<0||p.y>1)continue;
        const x=p.x*w,y=p.y*h,rad=Math.max(2,w*.002*(1+(j%3)*.3));
        octx.beginPath();octx.arc(x,y,rad,0,2*Math.PI);octx.fill();
      }
      for(const [p,label] of [[pts[0],'INICIO'],[pts[pts.length-1],'FIN']]){
        const x=p.x*w,y=p.y*h;if(x<0||x>w||y<0||y>h)continue;
        octx.fillStyle='#f5d49a';octx.beginPath();octx.arc(x,y,w*.009,0,Math.PI*2);octx.fill();
        octx.fillStyle='#fff';octx.font=`${Math.max(13,w*.019)}px sans-serif`;octx.fillText(label,x+w*.014,y-h*.013);
      }
      octx.restore();
    }
    if(state.target){const x=state.target.x*w,y=state.target.y*h;octx.save();octx.strokeStyle='#ffe69a';octx.lineWidth=2.8;octx.shadowBlur=14;octx.shadowColor='#ffb954';for(let k=1;k<=2;k++){octx.beginPath();octx.arc(x,y,k*13,0,Math.PI*2);octx.stroke();}octx.fillStyle='#ffe49b';octx.font='26px serif';octx.textAlign='center';octx.fillText('✦',x,y+8);octx.font='14px sans-serif';octx.fillText('DIENTE',x,y-37);octx.restore();}
  }

  function resizeCanvas(width=720){const height=Math.round(width*16/9);canvas.width=width;canvas.height=height;overlay.width=width;overlay.height=height;drawFrame();}
  function setMode(mode){$('lightPopover').hidden=true;state.mode=mode;stage.className=`stage mode-${mode}`;document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});const hints={draw:'Arrastra el dedo sobre la fotografía para dibujar el vuelo de Pérez.',target:'Toca la mesita donde está el diente. El globo reducirá su velocidad al acercarse.',pan:'Arrastra la imagen para encuadrar mejor la cama.'};setHint(hints[mode]);}

  let gesture=null;
  // iOS Safari can promote a vertical swipe into document scrolling before
  // pointermove fires. Reserve all touches begun inside the photo for the scene,
  // even when the finger crosses its boundary. This is intentionally scoped:
  // scrolling outside the scene must continue to work normally.
  const sceneTouches=new Set();
  stage.addEventListener('touchstart',event=>{
    if(!state.photo)return; // don't interfere with the native iPhone photo picker
    for(const touch of event.changedTouches)sceneTouches.add(touch.identifier);
  },{passive:true,capture:true});
  document.addEventListener('touchmove',event=>{
    if(!state.photo||!event.cancelable||!sceneTouches.size)return;
    // Range sliders retain their native drag behaviour; CSS touch-action:none
    // on the stage still prevents page panning under those controls.
    if(event.target?.closest?.('input[type="range"]'))return;
    for(const touch of event.changedTouches){
      if(sceneTouches.has(touch.identifier)){event.preventDefault();break;}
    }
  },{passive:false,capture:true});
  const endSceneTouches=event=>{
    for(const touch of event.changedTouches)sceneTouches.delete(touch.identifier);
  };
  document.addEventListener('touchend',endSceneTouches,{passive:true,capture:true});
  document.addEventListener('touchcancel',endSceneTouches,{passive:true,capture:true});
  window.addEventListener('blur',()=>sceneTouches.clear());
  function xy(ev){const r=overlay.getBoundingClientRect();return point(CLAMP((ev.clientX-r.left)/r.width,0,1),CLAMP((ev.clientY-r.top)/r.height,0,1));}
  overlay.addEventListener('pointerdown',ev=>{
    if(state.playing||state.recording||gesture)return;
    if(ev.pointerType==='touch'&&!ev.isPrimary)return;
    ev.preventDefault();overlay.setPointerCapture(ev.pointerId);const p=xy(ev);
    gesture={mode:state.mode, start:p,last:p,prevPath:state.path,panX:state.panX,panY:state.panY};
    if(state.mode==='draw'){state.path=[p];state.pathName='manual';state.hasDrawn=true;}
    if(state.mode==='target'){state.target=p;buildPath();toast('Diente marcado. Pérez se acercará despacio.');}
    drawFrame();
  });
  overlay.addEventListener('pointermove',ev=>{
    if(!gesture||!overlay.hasPointerCapture(ev.pointerId))return;ev.preventDefault();const p=xy(ev);
    if(gesture.mode==='draw'){
      if(dist(p,state.path[state.path.length-1])>.006){state.path.push(p);state.smoothPath=smoothed(state.path);}
    }else if(gesture.mode==='pan'){
      state.panX=CLAMP(gesture.panX+(p.x-gesture.start.x),-.9,.9);
      state.panY=CLAMP(gesture.panY+(p.y-gesture.start.y),-.9,.9);
      ambienceDirty=true;
    }
    gesture.last=p;drawFrame();
  });
  function endGesture(ev){if(!gesture)return;if(gesture.mode==='draw'){if(state.path.length<3){state.path=gesture.prevPath;toast('Mantén el dedo y dibuja una curva completa.');}else{buildPath();toast('Recorrido guardado. Pulsa ▶ para verlo.');}}gesture=null;drawFrame();}
  overlay.addEventListener('pointerup',endGesture);
  overlay.addEventListener('pointercancel',endGesture);


  /* ASISTENTE DE FOTO: foto tomada en el propio dispositivo, sin uploads.
     El encuadre 9:16 coincide exactamente con object-fit:cover del visor. */
  const cameraShell=$('magicCamera');
  const cameraVideo=$('cameraStream');
  const cameraPhoto=$('cameraPreview');
  let cameraMedia=null,cameraCapturedBlob=null,cameraPreviewURL=null,cameraScanTimer=null;
  let cameraAttempt=0,cameraPreviousFocus=null;
  const cameraCheckCanvas=document.createElement('canvas');
  cameraCheckCanvas.width=48;cameraCheckCanvas.height=84;
  const cameraCheckCtx=cameraCheckCanvas.getContext('2d',{willReadFrequently:true});

  function stopCameraFeed(){
    if(cameraScanTimer){clearInterval(cameraScanTimer);cameraScanTimer=null;}
    if(cameraMedia){
      for(const track of cameraMedia.getTracks())track.stop();
      cameraMedia=null;
    }
    cameraVideo.pause();
    cameraVideo.srcObject=null;
    $('cameraShutter').disabled=true;
  }
  function clearCameraPreview(){
    cameraCapturedBlob=null;
    if(cameraPreviewURL){URL.revokeObjectURL(cameraPreviewURL);cameraPreviewURL=null;}
    cameraPhoto.removeAttribute('src');
    cameraPhoto.hidden=true;
    $('cameraReviewLabel').hidden=true;
    $('cameraGuide').hidden=false;
  }
  function closeMagicCamera(){
    ++cameraAttempt;stopCameraFeed();clearCameraPreview();
    cameraShell.hidden=true;
    document.documentElement.classList.remove('camera-active');
    document.body.classList.remove('camera-active');
    $('cameraError').hidden=true;
    const f=cameraPreviousFocus;cameraPreviousFocus=null;
    if(f&&document.contains(f))try{f.focus({preventScroll:true});}catch{}
  }
  function cameraFailure(text){
    $('cameraError').textContent=text;
    $('cameraError').hidden=false;
    $('cameraRetryBtn').hidden=false;
    $('cameraTip').textContent='También puedes elegir una foto de tu galería.';
    $('cameraShutter').disabled=true;
  }
  function checkCameraIllumination(){
    if(!cameraMedia||cameraVideo.readyState<2||cameraPhoto.hidden===false||!cameraCheckCtx)return;
    try{
      cameraCheckCtx.drawImage(cameraVideo,0,0,48,84);
      const img=cameraCheckCtx.getImageData(0,0,48,84).data;
      let luminance=0,n=0;
      // Measure the lower part where the child and bed will be.
      for(let y=39;y<81;y+=3)for(let x=3;x<45;x+=3){
        const i=(y*48+x)*4;
        luminance+=.2126*img[i]+.7152*img[i+1]+.0722*img[i+2];n++;
      }
      $('cameraDarkWarning').hidden=!(n>0&&luminance/n<38);
    }catch(err){console.warn('Camera light preview unavailable',err);}
  }
  async function startCameraFeed(){
    const id=++cameraAttempt;
    stopCameraFeed();clearCameraPreview();
    $('cameraError').hidden=true;
    $('cameraRetryBtn').hidden=true;
    $('cameraDarkWarning').hidden=true;
    $('cameraLiveActions').hidden=false;
    $('cameraReviewActions').hidden=true;
    setCameraStep(1,'Busca un poco de cielo para Pérez');
    cameraVideo.hidden=false;
    $('cameraGuide').hidden=false;
    $('cameraTip').textContent='La cama abajo; el cielo de Pérez, arriba.';
    if(!window.isSecureContext){
      cameraFailure('La cámara necesita una conexión HTTPS. Abre esta página desde Safari o elige una foto de la galería.');
      return;
    }
    if(!navigator.mediaDevices||typeof navigator.mediaDevices.getUserMedia!=='function'){
      cameraFailure('Este navegador no permite abrir la cámara aquí. Puedes elegir una fotografía de la galería.');
      return;
    }
    let stream;
    try{
      // Prefer the rear camera. "ideal" still permits older iPhones to choose any camera.
      stream=await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}
      });
      if(id!==cameraAttempt||cameraShell.hidden){
        stream.getTracks().forEach(t=>t.stop());return;
      }
      cameraMedia=stream;
      cameraVideo.srcObject=stream;
      cameraVideo.muted=true;
      cameraVideo.setAttribute('playsinline','');
      cameraVideo.setAttribute('webkit-playsinline','');
      try{await cameraVideo.play();}catch(err){console.warn('Camera autoplay',err);}
      if(id!==cameraAttempt||cameraShell.hidden)return;
      $('cameraShutter').disabled=false;
      // The user may shoot even when the picture is dark: this is guidance, not a gate.
      checkCameraIllumination();
      cameraScanTimer=setInterval(checkCameraIllumination,1050);
    }catch(err){
      if(stream&&stream!==cameraMedia)stream.getTracks().forEach(t=>t.stop());
      if(id!==cameraAttempt||cameraShell.hidden)return;
      const name=err&&err.name||'';
      if(name==='NotAllowedError'||name==='PermissionDeniedError'){
        cameraFailure('Para hacer la foto, permite el acceso a la cámara en Safari. También puedes elegirla desde Fotos.');
      }else if(name==='NotFoundError'||name==='DevicesNotFoundError'){
        cameraFailure('No se ha encontrado una cámara disponible. Selecciona una fotografía existente.');
      }else{
        cameraFailure('No hemos podido activar la cámara. Reinténtalo o elige una foto de la galería.');
      }
      console.warn('Camera unavailable',err);
    }
  }
  function openMagicCamera(){
    if(state.recording)return;
    if(state.playing)pause();
    if(!cameraShell.hidden)return;
    cameraPreviousFocus=document.activeElement;
    cameraShell.hidden=false;
    document.documentElement.classList.add('camera-active');
    document.body.classList.add('camera-active');
    $('cameraCloseBtn').focus({preventScroll:true});
    startCameraFeed();
  }
  function captureMagicPhoto(){
    if(!cameraMedia||cameraVideo.readyState<2||!cameraVideo.videoWidth||!cameraVideo.videoHeight){
      cameraFailure('La cámara todavía se está preparando. Inténtalo de nuevo.');return;
    }
    if(window.matchMedia?.('(pointer:coarse) and (orientation:landscape)').matches){
      $('cameraTip').textContent='Gira el iPhone en vertical antes de hacer la foto.';
      return;
    }
    const vw=cameraVideo.videoWidth,vh=cameraVideo.videoHeight,aspect=9/16;
    let cropW=vw,cropH=vh;
    if(vw/vh>aspect)cropW=vh*aspect;
    else cropH=vw/aspect;
    const sx=(vw-cropW)/2,sy=(vh-cropH)/2;
    const width=Math.max(360,Math.min(1080,Math.round(cropW)));
    const height=Math.round(width/aspect);
    const c=document.createElement('canvas');c.width=width;c.height=height;
    const x=c.getContext('2d',{alpha:false});
    if(!x){cameraFailure('La fotografía no se ha podido preparar. Prueba a elegir una imagen de la galería.');return;}
    try{x.drawImage(cameraVideo,sx,sy,cropW,cropH,0,0,width,height);}
    catch(err){cameraFailure('La cámara no ha conseguido capturar la imagen. Intenta repetirla.');return;}
    $('cameraShutter').disabled=true;
    c.toBlob(blob=>{
      if(cameraShell.hidden)return;
      if(!blob){cameraFailure('La fotografía no se ha podido guardar. Prueba de nuevo.');return;}
      clearCameraPreview();
      cameraCapturedBlob=blob;
      cameraPreviewURL=URL.createObjectURL(blob);
      cameraPhoto.src=cameraPreviewURL;
      cameraPhoto.hidden=false;
      cameraVideo.hidden=true;
      stopCameraFeed();
      $('cameraDarkWarning').hidden=true;
      $('cameraLiveActions').hidden=true;
      $('cameraReviewActions').hidden=false;
      // Keep the translucent framing reference on screen, never in the captured JPEG.
      $('cameraGuide').hidden=false;
      $('cameraReviewLabel').hidden=false;
      setCameraStep(2,'Mira cómo ha quedado la foto');
      $('cameraTip').textContent='El globo semitransparente es una guía. No aparecerá duplicado en el vídeo.';
      $('cameraAcceptBtn').focus({preventScroll:true});
    },'image/jpeg',.91);
  }
  const guidedPath=[
    point(-.20,.20),point(.05,.20),point(.25,.16),point(.42,.23),
    point(.66,.19),point(.84,.29),point(1.12,.25)
  ];
  function acceptMagicPhoto(){
    if(!cameraCapturedBlob)return;
    const blob=cameraCapturedBlob;
    setCameraStep(3,'Pérez ya tiene un camino');
    // Suggested flight remains in the upper clear 40% of the guided image.
    state.path=guidedPath.map(p=>({...p}));
    state.pathName='sugerida';state.target=null;state.time=0;
    buildPath();setMode('draw');
    closeMagicCamera();
    openPhoto(new File([blob],'cámara-mágica-villa-pérez.jpg',{type:'image/jpeg'}),{guided:true});
  }
  $('openCameraSidebar').addEventListener('click',openMagicCamera);
  $('openCameraMain').addEventListener('click',openMagicCamera);
  $('openCameraAgain').addEventListener('click',openMagicCamera);
  $('cameraCloseBtn').addEventListener('click',closeMagicCamera);
  $('cameraRetryBtn').addEventListener('click',startCameraFeed);
  $('cameraShutter').addEventListener('click',captureMagicPhoto);
  $('cameraRetakeBtn').addEventListener('click',startCameraFeed);
  $('cameraAcceptBtn').addEventListener('click',acceptMagicPhoto);
  $('cameraGalleryInput').addEventListener('change',event=>{
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    closeMagicCamera();
    openPhoto(file);
  });
  window.addEventListener('pagehide',()=>{
    ++cameraAttempt;stopCameraFeed();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!cameraShell.hidden){e.preventDefault();closeMagicCamera();}
  });

  async function openPhoto(file,options={}){
    if(!file)return;
    if(file.type&&!file.type.startsWith('image/')&&!/\.(jpe?g|png|webp|heic|heif|avif|gif)$/i.test(file.name||'')){
      toast('Elige una fotografía JPG, PNG o HEIC.');return;
    }
    const status=$('photoStatus');status.textContent='Cargando…';
    toast('Abriendo fotografía…');
    const url=URL.createObjectURL(file);
    const img=new Image();let retried=false;
    const install=()=>{
      if(state.photoUrl)URL.revokeObjectURL(state.photoUrl);
      state.photoUrl=img.src.startsWith('blob:')?url:null;
      if(img.src!==url)URL.revokeObjectURL(url);
      state.photo=img;state.photoZoom=1;state.panX=0;state.panY=0;
      window.VPPhotoStore?.access('put',file).catch(()=>{});
      ambienceDirty=true;lightSmoothed=null;
      status.textContent='Lista';status.classList.add('state-ready');
      $('photoTitle').textContent=(file.name||'Foto seleccionada').length>26?(file.name||'Fotografía').slice(0,24)+'…':(file.name||'Fotografía lista');
      $('emptyOverlay').hidden=true;overlay.classList.add('photo-ready');scenePlayer.hidden=false;updatePlayUi();
      $('scenePill').textContent='LISTO PARA VOLAR';setJourneyStep(2);
      $('advancedSettings').open=false;
      $('zoomControl').value=100;$('zoomValue').textContent='100%';
      drawFrame();toast(options.guided?'Paso 2. Dibuja la ruta o prueba el recorrido sugerido con «Ver magia».':'Paso 2. Dibuja la ruta o pulsa «Ver magia».');
    };
    img.onload=install;
    img.onerror=()=>{
      if(!retried){
        retried=true;
        const reader=new FileReader();
        reader.onload=()=>{img.src=String(reader.result||'');};
        reader.onerror=()=>{status.textContent='Error';URL.revokeObjectURL(url);toast('No se puede leer esta foto. Prueba JPG o PNG.');};
        reader.readAsDataURL(file);
      }else{
        status.textContent='Error';URL.revokeObjectURL(url);
        toast('Safari no ha podido abrir el formato. Guarda la imagen como JPG y vuelve a probar.');
      }
    };
    img.src=url;
  }
  async function openVideo(file){
    if(!file)return;if(!file.type.startsWith('video/')&&!/\.(mp4|mov|webm)$/i.test(file.name)){toast('Selecciona un archivo de vídeo.');return;}
    if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);
    state.videoUrl=URL.createObjectURL(file);state.loadedVideo=false;
    video.src=state.videoUrl;video.load();
    video.onloadeddata=()=>{
      state.loadedVideo=true;try{keyer=makeKeyer();}catch(e){console.error(e);keyer=null;state.loadedVideo=false;toast('Este navegador no permite procesar el chroma. Se usará el arte original.');}
      $('assetInfo').textContent=state.loadedVideo?'Vídeo animado · transparente sobre tu foto':'Vídeo en preparación';$('chromaSection').hidden=!state.loadedVideo;
      video.pause();drawFrame();if(state.loadedVideo && state.videoUrl)toast('Vídeo cargado. Fondo verde eliminado automáticamente.');
    };
    video.onerror=()=>{ $('assetInfo').textContent='Vídeo no disponible; puedes cargar el MP4'; toast('No se pudo abrir el vídeo. Usa «Cargar otro vídeo».'); };
  }

  let audioCtx=null,audioSource=null,audioDestination=null,audioGain=null;
  async function initAudio(){
    if(!audioCtx){
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx)return null;
      audioCtx=new AudioCtx();audioDestination=audioCtx.createMediaStreamDestination();
      audioSource=audioCtx.createMediaElementSource(sound);
      audioGain=audioCtx.createGain();audioGain.gain.value=state.soundLevel;
      audioSource.connect(audioGain);audioGain.connect(audioCtx.destination);
      audioGain.connect(audioDestination);
    }
    if(audioCtx.state==='suspended')await audioCtx.resume();
    return audioDestination;
  }
  function startAudio(){
    if(state.silent||state.soundLevel<.005)return Promise.resolve();
    try{
      // Start inside a real user gesture for Safari audio permissions.
      if(sound.readyState>=1){
        const length=Number.isFinite(sound.duration)&&sound.duration>0?sound.duration:30;
        if(Math.abs(sound.currentTime-state.time)>.3)sound.currentTime=state.time%length;
      }
      const started=sound.play();
      const initialized=initAudio();
      return Promise.all([Promise.resolve(started),initialized]).catch(err=>console.warn('audio unavailable',err));
    }catch(err){console.warn('audio start unavailable',err);return Promise.resolve();}
  }
  function pauseAudio(){sound.pause();video.pause();}
  function pause(){if(!state.playing)return;state.time=CLAMP((performance.now()-state.startedAt)/1000,0,state.duration);state.playing=false;cancelAnimationFrame(state.frameRequest);pauseAudio();updatePlayUi();$('scenePill').textContent='EDITANDO';drawFrame();}
  async function play(fromZero=false){
    if(state.recording)return;
    if(!state.photo){toast('Primero sube una foto para ver el vuelo.');return;}
    if(fromZero||state.time>=state.duration-.05)state.time=0;
    $('lightPopover').hidden=true;
    if(state.playing)return;
    state.playing=true;state.startedAt=performance.now()-state.time*1000;
    updatePlayUi();$('scenePill').textContent='REPRODUCIENDO';
    // Safari puede ignorar preload=auto: arrancar el MP4 desde el toque real del padre.
    if(state.loadedVideo||video.src){
      try{
        if(state.loadedVideo&&video.readyState>=1)video.currentTime=state.time%Math.max(video.duration||15,1);
        const promise=video.play();
        if(promise?.catch)promise.catch(e=>console.warn('video play',e));
      }catch(e){console.warn('video play',e);}
    }
    startAudio().catch(e=>console.warn('audio start',e));ticker();
  }
  function ticker(){if(!state.playing)return;state.time=Math.min(state.duration,(performance.now()-state.startedAt)/1000);drawFrame();
    if(state.time>=state.duration){state.playing=false;pauseAudio();updatePlayUi();drawFrame();$('scenePill').textContent=state.recording?'EXPORTANDO':'EDITANDO';
      if(state.recording&&state.recorder?.state==='recording')setTimeout(()=>{if(state.recorder?.state==='recording')state.recorder.stop();},130);
      return;
    }
    if(state.recording){const percentage=Math.round(state.time/state.duration*100);$('progressFill').style.width=percentage+'%';$('progressValue').textContent=percentage+'%';}
    state.frameRequest=requestAnimationFrame(ticker);
  }
  async function exportVideo(){
    if(!state.photo){toast('Añade primero una fotografía de la habitación.');return;}
    if(!canvas.captureStream||!window.MediaRecorder){toast('Este navegador no puede grabar el vídeo. Prueba con Chrome o Safari actualizado.');return;}
    if(state.playing)pause();
    $('lightPopover').hidden=true;
    const exportWidth=Number($('qualitySelect').value)||720;resizeCanvas(exportWidth);
    const safari=/^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
    const mp4=['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4'];
    const webm=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
    const support=safari?[...mp4,...webm]:[...webm,...mp4];
    const mime=support.find(m=>typeof MediaRecorder.isTypeSupported==='function'&&MediaRecorder.isTypeSupported(m))||'';
    state.recording=true;state.exportCancelled=false;state.exportBlob=null;
    $('exportModal').hidden=false;$('progressFill').style.width='0%';$('progressValue').textContent='0%';$('exportMessage').textContent='Pérez está siguiendo el recorrido que has dibujado.';
    try{
      // Prime the recorded canvas so the very first frame already contains the HUD.
      state.time=0;drawFrame(0);
      const stream=canvas.captureStream(30);
      if(!state.silent){const audioStream=await initAudio();if(audioStream)for(const track of audioStream.stream.getAudioTracks())stream.addTrack(track);}
      const rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:exportWidth>=1080?9000000:5000000}:undefined);
      state.recorder=rec;const chunks=[];
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onerror=e=>{console.error('record',e);toast('Ha fallado la exportación. Prueba calidad HD.');};
      rec.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());state.recording=false;updatePlayUi();
        $('exportModal').hidden=true;$('scenePill').textContent='EDITANDO';
        if(state.exportCancelled||!chunks.length){resizeCanvas(720);return;}
        const blob=new Blob(chunks,{type:rec.mimeType||mime||'video/webm'});
        const ext=blob.type.includes('mp4')?'mp4':'webm';const name=`vuelo-raton-perez-${new Date().toISOString().slice(0,10)}.${ext}`;
        state.exportBlob=blob;state.exportName=name;
        $('shareBtn').hidden=false;
        $('prepareSpyBtn').disabled=false;
        $('prepareSpyBtn').textContent='Activar Cámara Mágica';
        $('prepareSpyStatus').hidden=true;
        saveBlob(blob,name);setJourneyStep(3);$('successModal').hidden=false;$('successDownload').focus({preventScroll:true});
        resizeCanvas(720);
      };
      rec.start(250);state.time=0;state.playing=true;state.startedAt=performance.now();
      updatePlayUi();$('scenePill').textContent='EXPORTANDO';
      if(state.loadedVideo||video.src){try{if(state.loadedVideo)video.currentTime=0;const run=video.play();if(run?.catch)run.catch(e=>console.warn('video asset',e));}catch(e){console.warn('video asset',e);}}
      startAudio();state.startedAt=performance.now();ticker();
    }catch(err){console.error(err);state.recording=false;state.playing=false;pauseAudio();updatePlayUi();$('exportModal').hidden=true;resizeCanvas(720);toast('No se pudo exportar el vídeo. Prueba otro navegador o calidad HD.');}
  }
  function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),45000);}
  function saveSnapshot(){if(!state.photo){toast('Sube una fotografía antes de guardar el fotograma.');return;}canvas.toBlob(b=>{if(b)saveBlob(b,'foto-vuelo-perez.png');else toast('No se pudo guardar la imagen.');},'image/png',.95);}
  function saveRoute(){const body={version:2,format:'villa-perez-flight',path:state.path,target:state.target,duration:state.duration,size:state.size,magic:state.magic,autoLight:state.autoLight,lightManual:state.lightManual,soundLevel:state.soundLevel};saveBlob(new Blob([JSON.stringify(body,null,2)],{type:'application/json'}),'vuelo-perez-recorrido.json');toast('Recorrido guardado. No contiene la fotografía.');}
  function loadRoute(file){if(!file)return;file.text().then(v=>{try{const j=JSON.parse(v);if(!Array.isArray(j.path)||j.path.length<2||j.path.length>3000)throw Error();if(!j.path.every(p=>typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)))throw Error();state.path=j.path;state.pathName='manual';state.target=j.target&&Number.isFinite(j.target.x)&&Number.isFinite(j.target.y)?j.target:null;state.duration=CLAMP(Number(j.duration)||15,8,30);state.size=CLAMP(Number(j.size)||.22,.1,.43);state.magic=CLAMP(j.magic===undefined ? .65 : Number(j.magic),0,1);if(typeof j.autoLight==='boolean')state.autoLight=j.autoLight;if(Number.isFinite(j.lightManual))state.lightManual=CLAMP(j.lightManual,.3,1.5);if(Number.isFinite(j.soundLevel))state.soundLevel=CLAMP(j.soundLevel,0,1);$('durationControl').value=state.duration;$('sizeControl').value=Math.round(state.size*100);$('sizeValue').textContent=Math.round(state.size*100)+'%';$('magicControl').value=Math.round(state.magic*100);$('magicValue').textContent=Math.round(state.magic*100)+'%';$('lightAutoToggle').checked=state.autoLight;$('lightControl').value=Math.round(state.lightManual*100);$('lightValue').textContent=Math.round(state.lightManual*100)+'%';$('soundLevel').value=Math.round(state.soundLevel*100);$('soundLevelValue').textContent=Math.round(state.soundLevel*100)+'%';lightSmoothed=null;buildPath();drawFrame();toast('Recorrido recuperado.');}catch{toast('El archivo de recorrido no es válido.');}});}

  const handlePhotoChoice=e=>{const file=e.target.files?.[0];if(file)openPhoto(file);e.target.value='';};
  $('photoInput').addEventListener('change',handlePhotoChoice);
  $('centerPhotoInput').addEventListener('change',handlePhotoChoice);
  $('replacePhotoInput').addEventListener('change',handlePhotoChoice);
  if(/iPad|iPhone|iPod/.test(navigator.userAgent))$('iphoneInfo').hidden=false;
  $('videoInput').addEventListener('change',e=>openVideo(e.target.files[0]));
  // Native label + visible file input: no programmatic file-picker click on iOS.
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{if(state.playing)pause();setMode(btn.dataset.mode);}));
  $('clearBtn').addEventListener('click',()=>{if(state.playing)pause();state.path=[point(.18,.37),point(.75,.4)];state.pathName='manual';state.target=null;buildPath();drawFrame();toast('Ruta borrada. Dibuja una nueva con el dedo.');});
  $('suggestBtn').addEventListener('click',()=>{if(state.playing)pause();state.path=suggested.map(p=>({...p}));state.pathName='sugerida';buildPath();drawFrame();toast('Vuelo sugerido aplicado.');});
  $('playBtn').addEventListener('click',()=>state.playing?pause():play());
  $('restartBtn').addEventListener('click',()=>{if(state.playing)pause();state.time=0;try{video.currentTime=0;}catch{}drawFrame();});
  $('scrub').addEventListener('input',e=>{if(state.playing)pause();state.time=+e.target.value/1000*state.duration;if(state.loadedVideo&&video.readyState>=1){try{video.currentTime=state.time%Math.max(video.duration||15,1)}catch{}}drawFrame();});
  $('sizeControl').addEventListener('input',e=>setSize(e.target.value));
  $('sizeMinus').addEventListener('click',()=>setSize(Math.round(state.size*100)-2));
  $('sizePlus').addEventListener('click',()=>setSize(Math.round(state.size*100)+2));
  let resizeGesture=null;
  const handle=$('resizeHandle');
  handle.addEventListener('pointerdown',ev=>{
    if(!state.photo||state.playing||state.recording)return;
    ev.preventDefault();ev.stopPropagation();
    handle.setPointerCapture(ev.pointerId);
    resizeGesture={id:ev.pointerId,startY:ev.clientY,startX:ev.clientX,startSize:state.size};
  });
  handle.addEventListener('pointermove',ev=>{
    if(!resizeGesture||resizeGesture.id!==ev.pointerId)return;
    ev.preventDefault();ev.stopPropagation();
    const delta=(ev.clientY-resizeGesture.startY)+(ev.clientX-resizeGesture.startX)*.35;
    setSize(Math.round(CLAMP(resizeGesture.startSize+delta/Math.max(stage.clientHeight,1),.1,.43)*100));
  });
  for(const kind of ['pointerup','pointercancel','lostpointercapture']){
    handle.addEventListener(kind,ev=>{if(resizeGesture?.id===ev.pointerId){resizeGesture=null;saveSettings();}});
  }
  $('durationControl').addEventListener('input',e=>{state.duration=+e.target.value;$('durationValue').textContent=e.target.value+' s';state.time=CLAMP(state.time,0,state.duration);buildPath();drawFrame();});
  $('magicControl').addEventListener('input',e=>{state.magic=+e.target.value/100;$('magicValue').textContent=e.target.value+'%';drawFrame();saveSettings();});
  $('zoomControl').addEventListener('input',e=>{state.photoZoom=+e.target.value/100;$('zoomValue').textContent=e.target.value+'%';ambienceDirty=true;lightSmoothed=null;drawFrame();});
  $('chromaControl').addEventListener('input',e=>{state.chromaStrength=+e.target.value/100;$('chromaValue').textContent=e.target.value+'%';if(keyer)keyer.crop=null;drawFrame();});
  $('soundToggle').addEventListener('change',e=>{state.silent=!e.target.checked;if(state.silent)sound.pause();else if(state.playing)startAudio();$('soundBtn').textContent=state.silent?'♫̸':'♫';$('soundBtn').setAttribute('aria-pressed',String(!state.silent));});
  $('soundBtn').addEventListener('click',()=>{const t=$('soundToggle');t.checked=!t.checked;t.dispatchEvent(new Event('change'));});
  $('lightBadge').addEventListener('click',()=>{$('lightPopover').hidden=!$('lightPopover').hidden;});
  $('lightCloseBtn').addEventListener('click',()=>{$('lightPopover').hidden=true;});
  $('lightAutoToggle').addEventListener('change',e=>{
    state.autoLight=e.target.checked;lightSmoothed=null;drawFrame();saveSettings();
    toast(state.autoLight?'Luz adaptada automáticamente a la fotografía.':'Ajusta ahora el brillo manualmente.');
  });
  $('lightControl').addEventListener('input',e=>{
    state.lightManual=+e.target.value/100;lightSmoothed=null;
    $('lightValue').textContent=e.target.value+'%';drawFrame();saveSettings();
  });
  $('soundLevel').addEventListener('input',e=>{
    state.soundLevel=+e.target.value/100;
    $('soundLevelValue').textContent=e.target.value+'%';
    if(audioGain)audioGain.gain.setTargetAtTime(state.soundLevel,audioCtx.currentTime,.025);
    if(state.playing&&state.soundLevel>.005&&!state.silent&&sound.paused)startAudio();
    saveSettings();
  });
  $('exportBtn').addEventListener('click',exportVideo);
  $('quickExportBtn').addEventListener('click',exportVideo);
  $('mobileExportBtn').addEventListener('click',exportVideo);
  $('snapshotBtn').addEventListener('click',saveSnapshot);
  $('successDownload').addEventListener('click',()=>{
    if(state.exportBlob)saveBlob(state.exportBlob,state.exportName||'vuelo-magico-perez.mp4');
    else toast('Todavía no hay ningún vídeo para guardar.');
  });
  // Enlace privado padre → cámara del niño. No requiere servicios externos:
  // en esta etapa se almacena en el MISMO Safari/dispositivo mediante IndexedDB.
  async function activateChildCamera(){
    if(!state.exportBlob){toast('Primero crea el vídeo mágico.');return;}
    const btn=$('prepareSpyBtn');
    const status=$('prepareSpyStatus');
    btn.disabled=true;btn.textContent='☾ Guardando la grabación…';
    try{
      const tomorrow=new Date();
      tomorrow.setDate(tomorrow.getDate()+1);
      tomorrow.setHours(7,0,0,0);
      const base={
        id:'captura-magica',createdAt:Date.now(),availableAt:tomorrow.getTime(),
        videoBlob:state.exportBlob,videoUrl:null,
        photoBlob:null,photoUrl:null,letterBlob:null,letterUrl:null
      };
      async function put(record){
        const db=await new Promise((resolve,reject)=>{
          const req=indexedDB.open('villa-perez-sorpresas-v1',1);
          req.onupgradeneeded=()=>{
            if(!req.result.objectStoreNames.contains('items'))
              req.result.createObjectStore('items',{keyPath:'id'});
          };
          req.onsuccess=()=>resolve(req.result);
          req.onerror=()=>reject(req.error||new Error('No se puede abrir la biblioteca'));
        });
        try{
          await new Promise((resolve,reject)=>{
            const tx=db.transaction('items','readwrite');
            tx.objectStore('items').put(record);
            tx.oncomplete=resolve;
            tx.onerror=()=>reject(tx.error||new Error('Guardado no disponible'));
            tx.onabort=()=>reject(tx.error||new Error('Guardado cancelado'));
          });
        }finally{db.close();}
      }
      try{await put(base);}
      catch(error){
        base.videoBytes=new Uint8Array(await state.exportBlob.arrayBuffer());
        base.videoMime=state.exportBlob.type||'video/mp4';
        base.videoBlob=null;
        await put(base);
      }
      localStorage.setItem('vp_cam_espia_mission_v1',String(Date.now()));
      localStorage.setItem('vp_cam_espia_capture_changed_v1',String(Date.now()));
      status.hidden=false;
      status.textContent='Cámara Mágica activa. Ábrela esta noche para mostrar la misión. Mañana desde las 7:00 aparecerá «Ver» en el mismo navegador y dispositivo.';
      btn.textContent='✓ Cámara Mágica activa';
      toast('¡Alerta mágica preparada para mañana!');
    }catch(error){
      console.warn('No se pudo preparar la cámara',error);
      status.hidden=false;status.textContent='No se ha guardado. Comprueba el espacio disponible y prueba de nuevo.';
      btn.textContent='Volver a intentar la activación';
      btn.disabled=false;
      toast('No se pudo guardar la grabación en este navegador.');
    }
  }
  $('prepareSpyBtn').addEventListener('click',activateChildCamera);
  $('successShare').addEventListener('click',()=>{
    if(!state.exportBlob)return;
    $('shareBtn').click();
  });
  $('successClose').addEventListener('click',()=>{
    $('successModal').hidden=true;
    $('playBtn').focus({preventScroll:true});
  });

  $('shareBtn').addEventListener('click',async()=>{
    if(!state.exportBlob)return;
    const f=new File([state.exportBlob],state.exportName,{type:state.exportBlob.type});
    try{if(navigator.share&&navigator.canShare?.({files:[f]})){await navigator.share({files:[f],title:'La visita del Ratón Pérez'});}else{saveBlob(state.exportBlob,state.exportName);toast('Vídeo guardado. Puedes compartirlo desde tus archivos.');}}
    catch(e){if(e.name!=='AbortError')toast('No se pudo compartir. Prueba descargándolo.');}
  });
  $('cancelExportBtn').addEventListener('click',()=>{state.exportCancelled=true;state.playing=false;cancelAnimationFrame(state.frameRequest);pauseAudio();if(state.recorder&&state.recorder.state==='recording')state.recorder.stop();else{state.recording=false;$('exportModal').hidden=true;}updatePlayUi();resizeCanvas(720);toast('Exportación cancelada.');});
  $('saveRouteBtn').addEventListener('click',saveRoute);
  $('loadRouteBtn').addEventListener('click',()=>$('routeInput').click());
  $('routeInput').addEventListener('change',e=>loadRoute(e.target.files[0]));
  function showHelp(on){$('helpModal').hidden=!on;}
  $('helpBtn').addEventListener('click',()=>showHelp(true));$('closeHelpBtn').addEventListener('click',()=>showHelp(false));$('helpDoneBtn').addEventListener('click',()=>showHelp(false));
  $('helpModal').addEventListener('click',e=>{if(e.target.id==='helpModal')showHelp(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('successModal').hidden=true;showHelp(false);}if(e.code==='Space'&&['INPUT','BUTTON','TEXTAREA'].indexOf(document.activeElement?.tagName)===-1){e.preventDefault();state.playing?pause():play();}});
  window.addEventListener('beforeunload',()=>{if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);if(state.photoUrl)URL.revokeObjectURL(state.photoUrl);});
  window.addEventListener('resize',()=>{if(state.photo)updateBalloonControls();});
  sprite.onload=()=>{state.spriteReady=true;drawFrame();};
  // Load our own first-party MP4 automatically on Safari/Chrome.
  // The source carries an ordinary green chroma, transformed into alpha by
  // applyKey() locally: no family photos or video frames leave the device.
  function loadDefaultVideo(){
    state.loadedVideo=false;
    video.crossOrigin='anonymous';
    video.preload='auto';
    video.src=DEFAULT_VIDEO;
    const onDefaultVideoReady=()=>{
      if(state.videoUrl)return; // user selected another video while downloading
      try{keyer=makeKeyer();state.loadedVideo=true;}
      catch(err){console.warn('Cannot initialize chroma video',err);state.loadedVideo=false;}
      $('assetInfo').textContent=state.loadedVideo?'Vídeo animado integrado · 8 s':'Vídeo no compatible en este navegador';
      $('chromaSection').hidden=!state.loadedVideo;
      if(!state.playing&&!state.recording)video.pause();drawFrame();
    };
    video.onloadedmetadata=onDefaultVideoReady;
    video.onloadeddata=onDefaultVideoReady;
    video.onerror=()=>{
      if(state.videoUrl)return;
      $('assetInfo').textContent='Vídeo no disponible; usa «Cargar otro vídeo»';
      $('chromaSection').hidden=true;
      console.warn('No se pudo cargar el MP4 integrado');
    };
    video.load();
  }
  setJourneyStep(1);updatePlayUi();restoreSettings();
  $('lightAutoToggle').checked=state.autoLight;
  $('lightControl').value=Math.round(state.lightManual*100);
  $('lightValue').textContent=Math.round(state.lightManual*100)+'%';
  $('soundLevel').value=Math.round(state.soundLevel*100);
  $('soundLevelValue').textContent=Math.round(state.soundLevel*100)+'%';
  if(window.matchMedia?.('(min-width:831px)').matches)$('advancedSettings').open=true;
  $('sizeControl').value=Math.round(state.size*100);$('sizeValue').textContent=Math.round(state.size*100)+'%';$('durationControl').value=state.duration;$('magicControl').value=Math.round(state.magic*100);$('magicValue').textContent=Math.round(state.magic*100)+'%';
  buildPath();resizeCanvas(720);setMode('draw');loadDefaultVideo();
  const entryParams=new URLSearchParams(location.search);
  if(entryParams.get('asistente')==='foto') openMagicCamera();
  else if(entryParams.get('desde')==='padres') window.VPPhotoStore?.access('get').then(file=>{if(file)openPhoto(file);}).catch(()=>{});
  window.VillaPerezFlight={ getDebug:()=>({videoReady:video.readyState,videoTime:video.currentTime,videoWidth:video.videoWidth,crop:keyer?.crop,renderMode:keyer?.cpuCtx?'canvas-2d':keyer?.gl?'webgl':'sprite',exposure:state.appliedExposure,lightMode:state.autoLight?'auto':'manual',soundReady:sound.readyState,soundTime:sound.currentTime}), getState:()=>({path:state.path,target:state.target,duration:state.duration,size:state.size,autoLight:state.autoLight,lightManual:state.lightManual,soundLevel:state.soundLevel,videoLoaded:state.loadedVideo,photoLoaded:!!state.photo}), sampleAt:(t)=>at(t), signalInterferenceAt:(t,duration)=>signalInterferenceAt(t,duration), version:'1.5.4' };
})();