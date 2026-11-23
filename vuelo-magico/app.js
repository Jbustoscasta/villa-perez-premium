/*
 * VILLA PÉREZ — El vuelo mágico | v1.2.0
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
  const DEFAULT_VIDEO = 'assets/raton-perez-vuelo.mp4?v=110';
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
    playing:false, seeking:false, time:0, startedAt:0, frameRequest:0,
    recording:false, recorder:null, exportCancelled:false, exportBlob:null, exportName:null,
    spriteReady:false, silent:false, hasDrawn:false,
  };
  let toastTimer;
  function toast(text) { const t=$('toast');t.textContent=text;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3700); }
  const formatTime = sec=>`00:${String(Math.floor(sec)).padStart(2,'0')}`;
  const setHint = msg=>$('contextHint').innerHTML=`✦ <span>${msg}</span>`;
  const saveSettings = () => {try {localStorage.setItem('villaperez-flight-v1', JSON.stringify({path:state.path,target:state.target,duration:state.duration,size:state.size,magic:state.magic}));} catch {} };
  function restoreSettings() {try {const a=JSON.parse(localStorage.getItem('villaperez-flight-v1')||'null');if(!a)return;if(Array.isArray(a.path)&&a.path.length>1&&a.path.length<3000){const safe=a.path.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));if(safe.length>=2)state.path=safe;}if(a.target&&Number.isFinite(a.target.x))state.target=a.target;if(Number.isFinite(a.duration))state.duration=CLAMP(a.duration,8,30);if(Number.isFinite(a.size))state.size=CLAMP(a.size,.1,.43);if(Number.isFinite(a.magic))state.magic=CLAMP(a.magic,0,1);}catch{} }
  function setProgressUi() {$('scrub').value=Math.round(state.time/state.duration*1000);$('elapsed').textContent=formatTime(state.time);$('totalTime').textContent=formatTime(state.duration);$('durationValue').textContent=`${state.duration} s`; }

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
      glowingStar(px,py,rad,a);
    }
  }

  // GPU green-screen compositor: only the user's local video blob is read.
  let keyer=null;
  function makeKeyer(){
    const keyCanvas=document.createElement('canvas');keyCanvas.width=360;keyCanvas.height=640;
    const gl=keyCanvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false});
    if(!gl)return {keyCanvas,cpuCtx:keyCanvas.getContext('2d',{willReadFrequently:true}),crop:null};
    const vs='attribute vec2 pos;varying vec2 uv;void main(){uv=(pos+1.0)*0.5;gl_Position=vec4(pos,0.0,1.0);}';
    const fs='precision mediump float;varying vec2 uv;uniform sampler2D tex;uniform float threshold;void main(){vec4 c=texture2D(tex,uv);float dom=c.g-max(c.r,c.b);float green=smoothstep(threshold-.095,threshold+.095,dom);float a=1.0-green;float leak=max(0.0,c.g-max(c.r,c.b));c.g-=leak*.60*green;gl_FragColor=vec4(c.rgb,a);}';
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
    return {gl,keyCanvas,threshold:gl.getUniformLocation(program,'threshold'),crop:null,frameReady:false};
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
        }
        kc.putImageData(imageData,0,0);
      } else {
        const gl=keyer.gl;gl.viewport(0,0,keyCanvas.width,keyCanvas.height);
        gl.uniform1f(keyer.threshold,threshold);
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
    if(Number.isFinite(p.x)&&p.x>=.20&&p.x<=.77&&p.y>=.20&&p.y<=.72)return p;
    let best=null,bestCost=Infinity;
    for(let i=0;i<=48;i++){
      const candidate=at(state.duration*i/48);
      if(!Number.isFinite(candidate.x)||!Number.isFinite(candidate.y))continue;
      if(candidate.x<.20||candidate.x>.77||candidate.y<.20||candidate.y>.72)continue;
      const score=Math.abs(candidate.x-.50)*1.5+Math.abs(candidate.y-.43)*.65;
      if(score<bestCost){bestCost=score;best=candidate;}
    }
    return best||point(.5,.42);
  }
  function updateBalloonControls(){
    const visible=!!state.photo&&!state.playing&&!state.recording;
    transform.hidden=!visible; sizePanel.hidden=!visible;scenePlayer.hidden=!state.photo;
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
    btn.textContent=state.playing?'Ⅱ Pausa':'▶ Ver vuelo';
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
      const h=spriteHeight, w=h*aspect;
      if(crop)ctx.drawImage(source,crop.x,crop.y,crop.w,crop.h,-w/2,-h/2,w,h);
      else ctx.drawImage(source,-w/2,-h/2,w,h);
    }
    ctx.restore();
  }
  function drawFrame(t=state.time) {
    ctx.save();ctx.clearRect(0,0,W(),H());drawBackdrop();drawParticles(t);drawBalloon(t);ctx.restore();
    drawOverlay();setProgressUi();updateBalloonControls();
  }
  function drawOverlay() {
    const w=overlay.width,h=overlay.height;octx.clearRect(0,0,w,h);
    if(state.playing||state.recording)return;
    const pts=state.smoothPath;
    if(pts.length>1) {
      octx.save();octx.beginPath();octx.moveTo(pts[0].x*w,pts[0].y*h);
      for(let i=1;i<pts.length;i++)octx.lineTo(pts[i].x*w,pts[i].y*h);
      octx.lineWidth=Math.max(2,w*.003);octx.setLineDash([w*.012,w*.01]);octx.strokeStyle='#ffe4a4';octx.shadowBlur=10;octx.shadowColor='#dda66a';octx.stroke();octx.setLineDash([]);
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
  function setMode(mode){state.mode=mode;stage.className=`stage mode-${mode}`;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));const hints={draw:'Arrastra el dedo sobre la fotografía para dibujar el vuelo de Pérez.',target:'Toca la mesita donde está el diente. El globo reducirá su velocidad al acercarse.',pan:'Arrastra la imagen para encuadrar mejor la cama.'};setHint(hints[mode]);}

  let gesture=null;
  function xy(ev){const r=overlay.getBoundingClientRect();return point(CLAMP((ev.clientX-r.left)/r.width,0,1),CLAMP((ev.clientY-r.top)/r.height,0,1));}
  overlay.addEventListener('pointerdown',ev=>{
    if(state.playing||state.recording)return;
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
    }
    gesture.last=p;drawFrame();
  });
  function endGesture(ev){if(!gesture)return;if(gesture.mode==='draw'){if(state.path.length<3){state.path=gesture.prevPath;toast('Mantén el dedo y dibuja una curva completa.');}else{buildPath();toast('Recorrido guardado. Pulsa ▶ para verlo.');}}gesture=null;drawFrame();}
  overlay.addEventListener('pointerup',endGesture);
  overlay.addEventListener('pointercancel',endGesture);

  async function openPhoto(file){
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
      status.textContent='Lista';status.classList.add('state-ready');
      $('photoTitle').textContent=(file.name||'Foto seleccionada').length>26?(file.name||'Fotografía').slice(0,24)+'…':(file.name||'Fotografía lista');
      $('emptyOverlay').hidden=true;overlay.classList.add('photo-ready');scenePlayer.hidden=false;updatePlayUi();
      $('zoomControl').value=100;$('zoomValue').textContent='100%';
      drawFrame();toast('¡Foto cargada! Ahora dibuja el recorrido con el dedo.');
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

  let audioCtx=null,audioSource=null,audioDestination=null;
  async function initAudio(){
    if(!audioCtx){const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return null;audioCtx=new AudioCtx();
      audioDestination=audioCtx.createMediaStreamDestination();audioSource=audioCtx.createMediaElementSource(sound);
      const gain=audioCtx.createGain();gain.gain.value=.85;audioSource.connect(gain);gain.connect(audioCtx.destination);gain.connect(audioDestination);
    }
    if(audioCtx.state==='suspended')await audioCtx.resume();return audioDestination;
  }
  async function startAudio(){if(state.silent)return;try {await initAudio();sound.currentTime=0;await sound.play();}catch(e){console.warn('audio unavailable',e);}}
  function pauseAudio(){sound.pause();video.pause();}
  function pause(){if(!state.playing)return;state.time=CLAMP((performance.now()-state.startedAt)/1000,0,state.duration);state.playing=false;cancelAnimationFrame(state.frameRequest);pauseAudio();updatePlayUi();$('scenePill').textContent='EDITANDO';drawFrame();}
  async function play(fromZero=false){
    if(state.recording)return;
    if(fromZero||state.time>=state.duration-.05)state.time=0;
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
    if(state.time>=state.duration){state.playing=false;pauseAudio();updatePlayUi();$('scenePill').textContent=state.recording?'EXPORTANDO':'EDITANDO';
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
    const exportWidth=Number($('qualitySelect').value)||720;resizeCanvas(exportWidth);
    const safari=/^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
    const mp4=['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4'];
    const webm=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
    const support=safari?[...mp4,...webm]:[...webm,...mp4];
    const mime=support.find(m=>typeof MediaRecorder.isTypeSupported==='function'&&MediaRecorder.isTypeSupported(m))||'';
    state.recording=true;state.exportCancelled=false;state.exportBlob=null;
    $('exportModal').hidden=false;$('progressFill').style.width='0%';$('progressValue').textContent='0%';$('exportMessage').textContent='Pérez está siguiendo el recorrido que has dibujado.';
    try{
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
        saveBlob(blob,name);toast('¡Vídeo terminado! Se ha guardado en tu dispositivo.');
        resizeCanvas(720);
      };
      rec.start(250);state.time=0;state.playing=true;state.startedAt=performance.now();
      updatePlayUi();$('scenePill').textContent='EXPORTANDO';
      if(state.loadedVideo||video.src){try{if(state.loadedVideo)video.currentTime=0;await video.play();}catch(e){console.warn('video asset',e);}}
      await startAudio();state.startedAt=performance.now();ticker();
    }catch(err){console.error(err);state.recording=false;state.playing=false;pauseAudio();updatePlayUi();$('exportModal').hidden=true;resizeCanvas(720);toast('No se pudo exportar el vídeo. Prueba otro navegador o calidad HD.');}
  }
  function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),45000);}
  function saveSnapshot(){if(!state.photo){toast('Sube una fotografía antes de guardar el fotograma.');return;}canvas.toBlob(b=>{if(b)saveBlob(b,'foto-vuelo-perez.png');else toast('No se pudo guardar la imagen.');},'image/png',.95);}
  function saveRoute(){const body={version:1,format:'villa-perez-flight',path:state.path,target:state.target,duration:state.duration,size:state.size,magic:state.magic};saveBlob(new Blob([JSON.stringify(body,null,2)],{type:'application/json'}),'vuelo-perez-recorrido.json');toast('Recorrido guardado. No contiene la fotografía.');}
  function loadRoute(file){if(!file)return;file.text().then(v=>{try{const j=JSON.parse(v);if(!Array.isArray(j.path)||j.path.length<2||j.path.length>3000)throw Error();if(!j.path.every(p=>typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)))throw Error();state.path=j.path;state.pathName='manual';state.target=j.target||null;state.duration=CLAMP(Number(j.duration)||15,8,30);state.size=CLAMP(Number(j.size)||.22,.1,.43);state.magic=CLAMP(Number(j.magic)||.65,0,1);$('durationControl').value=state.duration;$('sizeControl').value=Math.round(state.size*100);$('sizeValue').textContent=Math.round(state.size*100)+'%';$('magicControl').value=Math.round(state.magic*100);$('magicValue').textContent=Math.round(state.magic*100)+'%';buildPath();drawFrame();toast('Recorrido recuperado.');}catch{toast('El archivo de recorrido no es válido.');}});}

  const handlePhotoChoice=e=>{const file=e.target.files?.[0];if(file)openPhoto(file);e.target.value='';};
  $('photoInput').addEventListener('change',handlePhotoChoice);
  $('centerPhotoInput').addEventListener('change',handlePhotoChoice);
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
  $('zoomControl').addEventListener('input',e=>{state.photoZoom=+e.target.value/100;$('zoomValue').textContent=e.target.value+'%';drawFrame();});
  $('chromaControl').addEventListener('input',e=>{state.chromaStrength=+e.target.value/100;$('chromaValue').textContent=e.target.value+'%';if(keyer)keyer.crop=null;drawFrame();});
  $('soundToggle').addEventListener('change',e=>{state.silent=!e.target.checked;if(state.silent)pauseAudio();else if(state.playing)startAudio();$('soundBtn').textContent=state.silent?'♫̸':'♫';});
  $('soundBtn').addEventListener('click',()=>{const t=$('soundToggle');t.checked=!t.checked;t.dispatchEvent(new Event('change'));});
  $('exportBtn').addEventListener('click',exportVideo);
  $('snapshotBtn').addEventListener('click',saveSnapshot);
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
  document.addEventListener('keydown',e=>{if(e.key==='Escape')showHelp(false);if(e.code==='Space'&&['INPUT','BUTTON','TEXTAREA'].indexOf(document.activeElement?.tagName)===-1){e.preventDefault();state.playing?pause():play();}});
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
      $('assetInfo').textContent=state.loadedVideo?'Vídeo animado integrado · 15 s':'Vídeo no compatible en este navegador';
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
  updatePlayUi();restoreSettings();$('sizeControl').value=Math.round(state.size*100);$('sizeValue').textContent=Math.round(state.size*100)+'%';$('durationControl').value=state.duration;$('magicControl').value=Math.round(state.magic*100);$('magicValue').textContent=Math.round(state.magic*100)+'%';
  buildPath();resizeCanvas(720);setMode('draw');loadDefaultVideo();
  window.VillaPerezFlight={ getDebug:()=>({videoReady:video.readyState,videoTime:video.currentTime,videoWidth:video.videoWidth,crop:keyer?.crop,renderMode:keyer?.cpuCtx?'canvas-2d':keyer?.gl?'webgl':'sprite'}), getState:()=>({path:state.path,target:state.target,duration:state.duration,size:state.size,videoLoaded:state.loadedVideo,photoLoaded:!!state.photo}), sampleAt:(t)=>at(t), version:'1.2.0' };
})();