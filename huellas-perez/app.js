/* Huellas de Pérez v2. Todo se renderiza en el dispositivo: sin API ni fotos subidas. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const E=window.VPHuellasEngine;
  const canvas=$('footprintCanvas');
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx||!E){$('status').textContent='No se ha podido iniciar el editor. Actualiza la página.';return;}
  const state={
    image:null,paths:[],history:[],draft:null,pointerId:null,mode:'draw',
    surface:'wood',weather:'dry',style:'natural',size:65,perspective:25,opacity:.75,
    frame:0,loading:false,exporting:false
  };
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const surfaceNames={wood:'madera',fabric:'tela',tile:'baldosa',glass:'cristal',outside:'suelo exterior'};
  const descriptions={
    powder:'Polvo fino con sombra suave',fabric:'Huellas suaves en las fibras',chalk:'Polvo tenue sobre la baldosa',
    dust:'Tierra seca y motitas dispersas',damp:'Marcas húmedas, menos definidas',dew:'Pequeñas marcas en el vaho',
    water:'Gotitas de agua sobre el cristal',mud:'Barro húmedo con salpicaduras y pisadas irregulares',
    snow:'Nieve compactada, borde helado y pequeños cristales',frost:'Escarcha fría y nieve en el cristal'
  };
  const gestureHelp={
    draw:'Dibuja con el dedo el recorrido. Después marca paradas, saltos o giros tocando las huellas.',
    stop:'Ahora toca un punto del recorrido donde Pérez se detuvo. Aparecerán pisadas agrupadas.',
    jump:'Toca el recorrido donde Pérez dio un salto. Verás el hueco entre impulso y aterrizaje.',
    turn:'Toca el recorrido donde Pérez giró. Las patitas se orientarán al cambiar de dirección.'
  };
  function message(text){$('status').textContent=text||'';}
  function point(event){
    const box=canvas.getBoundingClientRect();
    return {x:clamp((event.clientX-box.left)/box.width,0,1),y:clamp((event.clientY-box.top)/box.height,0,1)};
  }
  function pixels(points){return points.map(p=>({x:p.x*canvas.width,y:p.y*canvas.height}));}
  function params(index=0,marks=[]){
    return {width:canvas.width,height:canvas.height,index,marks,
      effect:E.effectFor(state.surface,state.weather),
      mood:state.style,size:state.size,opacity:state.opacity,perspective:state.perspective};
  }
  function render(includeGuides=true){
    state.frame=0;
    if(!state.image)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(state.image,0,0,canvas.width,canvas.height);
    for(let i=0;i<state.paths.length;i++){
      const path=state.paths[i];
      const geo=E.drawPath(ctx,path.points,params(i,path.marks));
      if(includeGuides&&geo){for(const mark of path.marks)E.marker(ctx,geo,mark,canvas.width,canvas.height);}
    }
    if(includeGuides&&state.draft?.length>1){
      E.drawPath(ctx,state.draft,params(state.paths.length));
      const pts=pixels(state.draft);
      ctx.save();ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
      ctx.strokeStyle='rgba(248,220,167,.46)';
      ctx.lineWidth=Math.max(2,Math.min(canvas.width,canvas.height)*.0025);
      ctx.setLineDash([5,12]);ctx.stroke();ctx.restore();
    }
  }
  function scheduleRender(){if(!state.frame&&!state.exporting)state.frame=requestAnimationFrame(()=>render(true));}
  function selectGroup(attr,value){
    document.querySelectorAll('[data-'+attr+']').forEach(button=>{
      const active=button.dataset[attr]===value;
      button.classList.toggle('is-selected',active);
      button.setAttribute('aria-pressed',String(active));
    });
  }
  function setMode(mode){
    state.mode=mode;selectGroup('gesture',mode);
    $('gestureHelp').textContent=gestureHelp[mode];
    canvas.style.cursor=mode==='draw'?'crosshair':'pointer';
    updateUI();
  }
  function updateUI(){
    const hasPhoto=!!state.image,hasPath=state.paths.length>0,hasHistory=state.history.length>0;
    $('editorTools').hidden=!hasPhoto;
    $('emptyInstructions').hidden=hasPhoto;
    canvas.hidden=!hasPhoto;
    $('placeholder').hidden=hasPhoto;
    $('canvasHint').hidden=!hasPhoto||(hasPath&&state.mode==='draw');
    $('canvasHint').textContent=state.mode==='draw'?'☝ Dibuja el camino con el dedo':'☝ Toca las huellas para marcar el gesto';
    $('undoBtn').disabled=!hasHistory;
    $('clearBtn').disabled=!hasPath;
    $('downloadBtn').disabled=!hasPath;
    $('shareBtn').disabled=!hasPath;
    $('exportText').textContent=hasPath
      ? '¡El rastro está listo! Puedes modificar su superficie o clima antes de descargarlo o compartirlo.'
      : 'Cuando dibujes las huellas, podrás guardar la fotografía final para enseñarla mañana.';
    $('step1').classList.toggle('is-active',!hasPhoto);
    $('step2').classList.toggle('is-active',hasPhoto&&!hasPath);
    $('step3').classList.toggle('is-active',hasPath);
    $('photoNote').textContent=hasPhoto?'Dibuja todos los tramos que quieras. Las huellas se actualizan al cambiar de superficie o de tiempo.':'Consejo: fotografía de cerca una superficie donde unas huellas pequeñas se puedan distinguir. Evita los reflejos.';
    const effect=E.effectFor(state.surface,state.weather);
    $('weatherSummary').textContent='✧ '+(descriptions[effect]||'Huellas naturales')+' · '+surfaceNames[state.surface]+'.';
    for(const button of document.querySelectorAll('[data-gesture]'))button.disabled=!hasPath&&button.dataset.gesture!=='draw';
  }
  function loadPhoto(file){
    if(!file)return;
    if(!file.type.startsWith('image/')&&!/\.(heic|heif|jpg|jpeg|png|webp)$/i.test(file.name)){
      message('Elige una fotografía válida.');return;
    }
    if(state.loading||state.exporting)return;
    state.loading=true;message('Preparando tu fotografía…');
    const url=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{
      URL.revokeObjectURL(url);state.loading=false;
      const w=image.naturalWidth,h=image.naturalHeight;
      if(!(w>0&&h>0)){message('No hemos podido leer la fotografía.');return;}
      const ratio=Math.min(1,2048/Math.max(w,h));
      canvas.width=Math.max(1,Math.round(w*ratio));
      canvas.height=Math.max(1,Math.round(h*ratio));
      state.image=image;state.paths=[];state.history=[];state.draft=null;state.pointerId=null;
      setMode('draw');updateUI();scheduleRender();
      message('Foto lista. Dibuja con el dedo dónde caminó Pérez.');
      $('editor').scrollIntoView({block:'nearest',behavior:'smooth'});
    };
    image.onerror=()=>{
      URL.revokeObjectURL(url);state.loading=false;
      message('Safari no puede abrir esa foto. Prueba con un JPG o elige otra imagen.');
    };
    image.src=url;
  }
  ['cameraInput','galleryInput'].forEach(id=>{
    $(id).addEventListener('change',event=>{
      const file=event.currentTarget.files?.[0];
      event.currentTarget.value='';loadPhoto(file);
    });
  });
  function markGesture(normalized){
    if(!state.paths.length){message('Dibuja primero el recorrido de Pérez.');return;}
    const x=normalized.x*canvas.width,y=normalized.y*canvas.height;
    let closest=null;
    state.paths.forEach((path,index)=>{
      const geo=E.geometry(path.points,canvas.width,canvas.height);
      const found=E.closest(geo,x,y);
      if(found&&(!closest||found.distance<closest.distance))closest={...found,index};
    });
    const tolerance=Math.max(24,Math.min(canvas.width,canvas.height)*.09);
    if(!closest||closest.distance>tolerance){message('Toca sobre una huella del recorrido para colocar ese gesto.');return;}
    const marks=state.paths[closest.index].marks;
    if(marks.length>=15){message('Este tramo ya tiene muchas marcas; utiliza otro recorrido.');return;}
    marks.push({type:state.mode,t:closest.t});
    state.history.push({kind:'mark',index:closest.index});
    const label={stop:'Parada',jump:'Salto',turn:'Giro'}[state.mode];
    setMode('draw');updateUI();scheduleRender();
    message(label+' añadido. Puedes seguir dibujando o marcar otro gesto.');
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!state.image||state.exporting||event.isPrimary===false)return;
    if(state.mode!=='draw'){event.preventDefault();markGesture(point(event));return;}
    if(state.pointerId!==null)return;
    event.preventDefault();state.pointerId=event.pointerId;state.draft=[point(event)];
    try{canvas.setPointerCapture(event.pointerId);}catch(_){}
    scheduleRender();
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==state.pointerId||!state.draft)return;
    event.preventDefault();
    const next=point(event),prev=state.draft[state.draft.length-1];
    const dx=(next.x-prev.x)*canvas.width,dy=(next.y-prev.y)*canvas.height;
    if(Math.hypot(dx,dy)>=Math.max(2,Math.min(canvas.width,canvas.height)*.004)){
      state.draft.push(next);if(state.draft.length>350)state.draft=state.draft.filter((_,i)=>i%2===0);
      scheduleRender();
    }
  });
  function finish(event,cancelled=false){
    if(event.pointerId!==state.pointerId||!state.draft)return;
    event.preventDefault();
    try{canvas.releasePointerCapture(event.pointerId);}catch(_){}
    const path=state.draft,coords=pixels(path);
    const traveled=coords.reduce((v,p,i)=>i?v+distance(p,coords[i-1]):0,0);
    state.pointerId=null;state.draft=null;
    if(!cancelled&&traveled>=Math.min(canvas.width,canvas.height)*.04){
      state.paths.push({points:path,marks:[]});
      state.history.push({kind:'path'});
      message('¡Huellas añadidas! Ahora puedes marcar dónde Pérez paró, saltó o giró.');
    }else if(!cancelled){message('Haz un recorrido un poco más largo para que se vean sus huellas.');}
    updateUI();scheduleRender();
  }
  canvas.addEventListener('pointerup',event=>finish(event));
  canvas.addEventListener('pointercancel',event=>finish(event,true));
  canvas.addEventListener('lostpointercapture',event=>{if(event.pointerId===state.pointerId){state.pointerId=null;state.draft=null;scheduleRender();}});
  $('undoBtn').addEventListener('click',()=>{
    const action=state.history.pop();if(!action)return;
    if(action.kind==='path')state.paths.pop();
    else if(action.kind==='mark')state.paths[action.index]?.marks.pop();
    if(!state.paths.length)setMode('draw');
    updateUI();scheduleRender();message('Se ha deshecho el último cambio.');
  });
  $('clearBtn').addEventListener('click',()=>{
    state.paths=[];state.history=[];setMode('draw');updateUI();scheduleRender();
    message('Las huellas se han borrado. Vuelve a dibujar cuando quieras.');
  });
  for(const attr of ['surface','weather','style','gesture']){
    document.querySelectorAll('[data-'+attr+']').forEach(button=>{
      button.addEventListener('click',()=>{
        const value=button.dataset[attr];
        if(attr==='gesture')setMode(value);
        else {state[attr]=value;selectGroup(attr,value);updateUI();scheduleRender();}
      });
    });
  }
  $('sizeRange').addEventListener('input',event=>{
    state.size=Number(event.target.value);
    $('sizeValue').textContent=state.size<55?'Muy pequeñas':state.size<85?'Pequeñas':'Más visibles';scheduleRender();
  });
  $('perspectiveRange').addEventListener('input',event=>{
    state.perspective=Number(event.target.value);
    $('perspectiveValue').textContent=state.perspective===0?'Plana':state.perspective<50?'Natural':'Marcada';scheduleRender();
  });
  $('opacityRange').addEventListener('input',event=>{
    state.opacity=Number(event.target.value)/100;
    $('opacityValue').textContent=event.target.value+' %';scheduleRender();
  });
  async function exportBlob(){
    if(!state.image||!state.paths.length)throw new Error('Dibuja primero las huellas.');
    if(state.pointerId!==null)throw new Error('Termina de dibujar antes de guardar.');
    state.exporting=true;
    render(false); // Sin guías ni iconos de edición.
    return new Promise((resolve,reject)=>{
      const done=(value,error)=>{
        state.exporting=false;scheduleRender();
        if(error)reject(error);else resolve(value);
      };
      try{canvas.toBlob(blob=>blob?done(blob):done(null,new Error('No se ha podido guardar el resultado.')),'image/png');}
      catch(error){done(null,error);}
    });
  }
  const filename=()=>`huellas-raton-perez-${new Date().toISOString().slice(0,10)}.png`;
  function save(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  $('downloadBtn').addEventListener('click',async()=>{
    const button=$('downloadBtn');button.disabled=true;
    try{const blob=await exportBlob();save(blob,filename());message('Foto creada. En iPhone puedes encontrarla en Descargas o guardarla en Fotos desde Compartir.');}
    catch(error){message(error.message||'No se pudo guardar.');}
    finally{button.disabled=!state.paths.length;}
  });
  $('shareBtn').addEventListener('click',async()=>{
    const button=$('shareBtn');button.disabled=true;
    try{
      const blob=await exportBlob(),name=filename();
      const file=new File([blob],name,{type:'image/png'});
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        await navigator.share({files:[file],title:'Las huellas del Ratón Pérez'});
        message('Has compartido la foto desde el menú de tu móvil.');
      }else{
        save(blob,name);message('Este navegador no permite compartir archivos: hemos descargado la foto.');
      }
    }catch(error){if(error.name!=='AbortError')message(error.message||'No se pudo compartir la foto.');}
    finally{button.disabled=!state.paths.length;}
  });
  updateUI();
})();
