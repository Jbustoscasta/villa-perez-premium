/* Huellas de Pérez: la fotografía y las huellas se procesan SOLO en el navegador.
   Sin librerías externas, red, almacenamiento ni reconocimiento facial. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('footprintCanvas');
  const ctx = canvas.getContext('2d', {alpha: false});
  const state = { image: null, paths: [], draft: null, pointerId: null, style: 'moon', size: 65, opacity: .75, frame: 0, loading: false };
  const palettes = {
    moon: {pad: '#dbd1bf', toe: '#f9f3e6', highlight: '#fff8ed'},
    shadow: {pad: '#272a30', toe: '#22252c', highlight: '#6f7379'},
    magic: {pad: '#c7a365', toe: '#f8db9d', highlight: '#fff4d0'}
  };

  function message(text) { $('status').textContent = text || ''; }
  const distance = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
  const clamp = (v,min,max) => Math.max(min, Math.min(max,v));
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1)};
  }
  function pixels(normalized) { return normalized.map(p=>({x:p.x*canvas.width,y:p.y*canvas.height})); }

  // Suaviza el trazo sin perder sus extremos: el dedo dirige el camino, no las patas individualmente.
  function smooth(points) {
    if (points.length < 3) return points;
    let result=points;
    for(let pass=0;pass<2;pass++){
      const next=[result[0]];
      for(let i=0;i<result.length-1;i++){
        const a=result[i],b=result[i+1];
        next.push({x:.75*a.x+.25*b.x,y:.75*a.y+.25*b.y});
        next.push({x:.25*a.x+.75*b.x,y:.25*a.y+.75*b.y});
      }
      next.push(result[result.length-1]);
      result=next;
    }
    return result;
  }

  function seed(i, salt=0) { const v=Math.sin((i+1)*127.1+salt*311.7)*43758.5453; return v-Math.floor(v); }
  function ellipse(x,y,rx,ry,rot=0) {
    ctx.beginPath(); ctx.ellipse(x,y,rx,ry,rot,0,Math.PI*2); ctx.fill();
  }
  function paw(x,y,rotation,size,opacity,index) {
    const style=palettes[state.style];
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rotation + (seed(index,1)-.5)*.14);
    ctx.scale(size,size);
    ctx.globalAlpha = opacity * (.86 + seed(index,3)*.14);
    ctx.shadowColor=state.style==='magic'?'rgba(247,215,141,.68)':'rgba(10,13,22,.22)';
    ctx.shadowBlur=state.style==='magic'?.24:.1;
    ctx.shadowOffsetY=.05;
    ctx.fillStyle=style.pad;
    // Una almohadilla y cuatro deditos ovalados, como un rastro de pequeño roedor.
    ellipse(0,.17,.205,.255,-.1);
    ctx.shadowBlur=0; ctx.shadowOffsetY=0;
    ctx.fillStyle=style.toe;
    ellipse(-.245,-.16,.088,.13,-.27);
    ellipse(-.092,-.28,.078,.128,-.1);
    ellipse(.09,-.295,.081,.132,.1);
    ellipse(.245,-.17,.088,.125,.28);
    ctx.globalAlpha*=.24;
    ctx.fillStyle=style.highlight;
    ellipse(-.07,.065,.082,.105,-.18);
    if(state.style==='magic'){
      ctx.globalAlpha=opacity*.6;
      for(let j=0;j<3;j++){
        const dx=(seed(index,j+7)-.5)*1.8,dy=(seed(index,j+14)-.5)*1.9;
        ellipse(dx,dy,.015+seed(index,j+25)*.019,.016);
      }
    }
    ctx.restore();
  }

  // Coloca patitas alternas a distancias regulares, siguiendo la tangente del trazo.
  function renderTrack(track, offset=0) {
    if (!track || track.length<2) return;
    const pts=smooth(pixels(track));
    const minSide=Math.min(canvas.width,canvas.height);
    const size=minSide*(state.size/3000);
    const stride=size*1.38;
    const segs=[]; let total=0;
    for(let i=1;i<pts.length;i++){
      const d=distance(pts[i],pts[i-1]);
      if(d<.001) continue;
      segs.push({a:pts[i-1],b:pts[i],begin:total,end:total+d,len:d});
      total+=d;
    }
    if(!segs.length)return;
    let segment=0,stamps=0;
    const start=Math.min(size*.6,total*.2);
    for(let at=start;at<=total-size*.1 && stamps<260;at+=stride){
      while(segment<segs.length-1 && segs[segment].end<at) segment++;
      const s=segs[segment],f=clamp((at-s.begin)/s.len,0,1);
      const dx=(s.b.x-s.a.x)/s.len,dy=(s.b.y-s.a.y)/s.len;
      const side=stamps%2===0?-1:1;
      const spread=size*.29*side;
      const px=s.a.x+(s.b.x-s.a.x)*f-dy*spread;
      const py=s.a.y+(s.b.y-s.a.y)*f+dx*spread;
      // Ligerísima irregularidad, pero sin que las huellas se salgan del camino dibujado.
      const scale=.88+seed(stamps,offset+10)*.19;
      paw(px,py,Math.atan2(dy,dx)+Math.PI/2,size*scale,state.opacity,stamps+offset*401);
      stamps++;
    }
  }

  function render() {
    state.frame=0;
    if(!state.image) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(state.image,0,0,canvas.width,canvas.height);
    state.paths.forEach((path,i)=>renderTrack(path,i));
    if(state.draft?.length>1) {
      renderTrack(state.draft,state.paths.length);
      const line=pixels(state.draft);
      ctx.save();
      ctx.beginPath();ctx.moveTo(line[0].x,line[0].y);
      for(let i=1;i<line.length;i++)ctx.lineTo(line[i].x,line[i].y);
      ctx.strokeStyle='rgba(248,219,160,.45)';
      ctx.lineWidth=Math.max(2,Math.min(canvas.width,canvas.height)*.003);
      ctx.setLineDash([5,12]);ctx.stroke();ctx.restore();
    }
  }
  function scheduleRender(){if(!state.frame)state.frame=requestAnimationFrame(render);}
  function updateUI(){
    const hasPhoto=!!state.image,hasPath=state.paths.length>0;
    $('editorTools').hidden=!hasPhoto;
    $('emptyInstructions').hidden=hasPhoto;
    $('footprintCanvas').hidden=!hasPhoto;
    $('placeholder').hidden=hasPhoto;
    $('canvasHint').hidden=!hasPhoto||hasPath;
    $('undoBtn').disabled=!hasPath;
    $('clearBtn').disabled=!hasPath;
    $('downloadBtn').disabled=!hasPath;
    $('shareBtn').disabled=!hasPath;
    $('exportText').textContent=hasPath
      ? '¡Las huellas ya están en la foto! Descárgala o compártela para enseñar la pista mañana.'
      : 'Cuando dibujes las huellas, podrás guardar la fotografía final para enseñarla mañana.';
    $('step1').classList.toggle('is-active',!hasPhoto);
    $('step2').classList.toggle('is-active',hasPhoto&&!hasPath);
    $('step3').classList.toggle('is-active',hasPath);
    $('photoNote').textContent=hasPhoto?'Puedes trazar varios caminos. Para empezar otra foto, usa los botones de abajo.':'Consejo: fotografía de cerca una superficie donde unas huellas pequeñas se puedan distinguir. Evita los reflejos.';
  }

  function loadPhoto(file){
    if(!file)return;
    if(!file.type.startsWith('image/') && !/\.(heic|heif|jpg|jpeg|png|webp)$/i.test(file.name)){
      message('Elige una imagen válida.');return;
    }
    if(state.loading)return;
    state.loading=true;message('Preparando tu fotografía…');
    const url=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{
      URL.revokeObjectURL(url);state.loading=false;
      const w=image.naturalWidth,h=image.naturalHeight;
      if(!(w>0&&h>0)){message('No se ha podido leer la fotografía.');return;}
      // Limitar resolución para proteger la memoria de Safari con fotos de 48 MP.
      const scale=Math.min(1,2048/Math.max(w,h));
      canvas.width=Math.max(1,Math.round(w*scale));
      canvas.height=Math.max(1,Math.round(h*scale));
      state.image=image;state.paths=[];state.draft=null;state.pointerId=null;
      updateUI();scheduleRender();
      message('Foto lista. Arrastra el dedo por donde quieras que haya caminado Pérez.');
      $('editor').scrollIntoView({block:'nearest',behavior:'smooth'});
    };
    image.onerror=()=>{
      URL.revokeObjectURL(url);state.loading=false;
      message('Safari no ha podido abrir esta foto. Prueba guardándola en JPG o elige otra imagen.');
    };
    image.src=url;
  }
  ['cameraInput','galleryInput'].forEach(id=>{
    $(id).addEventListener('change',event=>{
      const file=event.currentTarget.files?.[0];
      event.currentTarget.value='';
      loadPhoto(file);
    });
  });

  canvas.addEventListener('pointerdown',event=>{
    if(!state.image||state.pointerId!==null||event.isPrimary===false)return;
    event.preventDefault();
    state.pointerId=event.pointerId;
    state.draft=[point(event)];
    try{canvas.setPointerCapture(event.pointerId);}catch(_){}
    scheduleRender();
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==state.pointerId||!state.draft)return;
    event.preventDefault();
    const next=point(event),prev=state.draft[state.draft.length-1];
    if(distance({x:next.x*canvas.width,y:next.y*canvas.height},{x:prev.x*canvas.width,y:prev.y*canvas.height})>=Math.max(2,Math.min(canvas.width,canvas.height)*.004)){
      state.draft.push(next);
      scheduleRender();
    }
  });
  function finish(event,cancelled=false){
    if(event.pointerId!==state.pointerId||!state.draft)return;
    event.preventDefault();
    try{canvas.releasePointerCapture(event.pointerId);}catch(_){}
    const path=state.draft;
    const coords=pixels(path);
    const traveled=coords.reduce((n,p,i)=>i?n+distance(p,coords[i-1]):0,0);
    state.pointerId=null;state.draft=null;
    if(!cancelled && traveled>=Math.min(canvas.width,canvas.height)*.04){
      state.paths.push(path);message(state.paths.length===1?'¡Ya se ven sus primeras huellas! Puedes dibujar otro tramo o guardar la foto.':'Otro tramo añadido. Puedes deshacerlo o guardar la foto.');
    } else if(!cancelled){
      message('Dibuja un recorrido un poco más largo con el dedo.');
    }
    updateUI();scheduleRender();
  }
  canvas.addEventListener('pointerup',event=>finish(event));
  canvas.addEventListener('pointercancel',event=>finish(event,true));
  canvas.addEventListener('lostpointercapture',event=>{if(state.pointerId===event.pointerId){state.pointerId=null;state.draft=null;scheduleRender();}});
  $('undoBtn').addEventListener('click',()=>{state.paths.pop();updateUI();scheduleRender();message('Se ha quitado el último tramo.');});
  $('clearBtn').addEventListener('click',()=>{state.paths=[];updateUI();scheduleRender();message('Huellas borradas. Puedes dibujarlas de nuevo.');});
  document.querySelectorAll('[data-style]').forEach(button=>{
    button.addEventListener('click',()=>{
      state.style=button.dataset.style;
      document.querySelectorAll('[data-style]').forEach(b=>{
        const active=b===button;b.classList.toggle('is-selected',active);b.setAttribute('aria-pressed',String(active));
      });
      scheduleRender();
    });
  });
  $('sizeRange').addEventListener('input',event=>{
    state.size=Number(event.target.value);
    $('sizeValue').textContent=state.size<55?'Muy pequeñas':state.size<85?'Pequeñas':'Más visibles';
    scheduleRender();
  });
  $('opacityRange').addEventListener('input',event=>{
    state.opacity=Number(event.target.value)/100;
    $('opacityValue').textContent=event.target.value+' %';
    scheduleRender();
  });

  async function exportBlob(){
    if(!state.image||!state.paths.length) throw new Error('Primero dibuja un recorrido.');
    // El trazo amarillo de edición no aparece en la imagen exportada.
    state.draft=null;render();
    return new Promise((resolve,reject)=>{
      try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No se pudo exportar la foto.')),'image/png');}
      catch(error){reject(error);}
    });
  }
  const filename=()=>`huellas-raton-perez-${new Date().toISOString().slice(0,10)}.png`;
  function save(blob,name){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  $('downloadBtn').addEventListener('click',async()=>{
    const button=$('downloadBtn');button.disabled=true;
    try{const blob=await exportBlob();save(blob,filename());message('Foto creada. En iPhone la encontrarás en Descargas; también puedes usar Compartir para guardarla en Fotos.');}
    catch(error){message(error.message||'No se pudo guardar la foto.');}
    finally{button.disabled=!state.paths.length;}
  });
  $('shareBtn').addEventListener('click',async()=>{
    const button=$('shareBtn');button.disabled=true;
    try{
      const blob=await exportBlob(),name=filename();
      const file=new File([blob],name,{type:'image/png'});
      if(navigator.share && navigator.canShare?.({files:[file]})){
        await navigator.share({files:[file],title:'Las huellas del Ratón Pérez'});
        message('Foto compartida desde el menú de tu móvil.');
      }else{
        save(blob,name);
        message('Este navegador no permite compartir archivos directamente. Hemos descargado la foto.');
      }
    }catch(error){if(error.name!=='AbortError')message(error.message||'No se pudo compartir la foto.');}
    finally{button.disabled=!state.paths.length;}
  });
  updateUI();
})();