/* Huellas de Pérez v3: solo tres estilos, tamaño e intensidad.
   Todo el procesado es local; nunca subimos fotos a un servidor. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('footprintCanvas');
  const ctx = canvas.getContext('2d',{alpha:false});
  if(!ctx){$('status').textContent='Este navegador no puede editar fotografías.';return;}
  const state={photo:null,paths:[],draft:null,pointerId:null,style:'normal',size:60,opacity:.75,frame:0,loading:false,exporting:false};
  const clamp=(x,low,high)=>Math.max(low,Math.min(high,x));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const random=(n,s=0)=>{const v=Math.sin((n+1)*127.1+(s+17)*311.7)*43758.5453;return v-Math.floor(v);};
  const palette={
    normal:{pad:'#322b27',toe:'#4c4036',light:'#7b6859',shadow:'rgba(16,12,9,.5)'},
    inverse:{pad:'#f3ebdd',toe:'#fffaf1',light:'#d0c6b6',shadow:'rgba(245,235,216,.25)'},
    magic:{pad:'#e4bc73',toe:'#ffe1a0',light:'#fff8d9',shadow:'rgba(245,198,107,.9)'}
  };
  function message(text){$('status').textContent=text;}
  function point(event){
    const box=canvas.getBoundingClientRect();
    return {x:clamp((event.clientX-box.left)/box.width,0,1),y:clamp((event.clientY-box.top)/box.height,0,1)};
  }
  function pixels(track){return track.map(p=>({x:p.x*canvas.width,y:p.y*canvas.height}));}
  function soften(pts){
    if(pts.length<3)return pts;
    let result=pts;
    for(let pass=0;pass<2;pass++){
      const next=[result[0]];
      for(let i=0;i<result.length-1;i++){
        const a=result[i],b=result[i+1];
        next.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25});
        next.push({x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75});
      }
      next.push(result[result.length-1]);result=next;
    }
    return result;
  }
  function oval(x,y,rx,ry,rotate=0){
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotate,0,Math.PI*2);ctx.fill();
  }
  function paw(x,y,angle,unit,index){
    const c=palette[state.style];
    const alpha=state.opacity*(.77+.23*random(index,3));
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle+(random(index,4)-.5)*.2);
    ctx.scale(unit,unit);
    ctx.globalAlpha=alpha;
    ctx.shadowColor=c.shadow;
    ctx.shadowBlur=state.style==='magic'?.34:.09;
    ctx.shadowOffsetY=state.style==='normal'?.055:0;
    ctx.fillStyle=c.pad;
    // Almohadilla asimétrica, como una pisada real y no un icono repetido.
    oval(0,.12,.205,.25,-.1);
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.fillStyle=c.toe;
    const toes=[[-.235,-.16,.082,.128,-.25],[-.085,-.277,.075,.123,-.09],[.09,-.286,.074,.13,.09],[.233,-.166,.08,.12,.27]];
    for(let t=0;t<toes.length;t++){
      const [tx,ty,rx,ry,rot]=toes[t];
      ctx.globalAlpha=alpha*(.77+.23*random(index,t+9));
      oval(tx,ty,rx*(.9+.19*random(index,t+22)),ry,rot);
    }
    // Unas zonas de desgaste dan relieve sin llenar la fotografía de partículas.
    ctx.globalAlpha=alpha*.23;ctx.fillStyle=c.light;
    oval(-.052,.055,.083,.102,-.2);
    if(state.style==='magic'){
      ctx.fillStyle=c.light;
      for(let j=0;j<3;j++){
        ctx.globalAlpha=alpha*(.19+.22*random(index,j+50));
        oval((random(index,j+28)-.5)*1.35,(random(index,j+37)-.5)*1.35,.012+.012*random(index,j+42),.012);
      }
    }
    ctx.restore();
  }
  function trackOnCanvas(track,trackIndex){
    if(track.length<2)return;
    const pts=soften(pixels(track));
    const parts=[];let total=0;
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],length=dist(a,b);
      if(length>.001){parts.push({a,b,length,start:total,end:total+length});total+=length;}
    }
    if(!parts.length)return;
    const base=Math.min(canvas.width,canvas.height)*state.size/3000;
    let offset=0,step=0,segment=0;
    const maxCount=Math.min(320,Math.ceil(total/(base*.8)));
    while(offset<total-base*.15 && step<maxCount){
      while(segment<parts.length-1&&parts[segment].end<offset)segment++;
      const s=parts[segment],ratio=clamp((offset-s.start)/s.length,0,1);
      const dx=(s.b.x-s.a.x)/s.length,dy=(s.b.y-s.a.y)/s.length;
      const side=step%2===0?-1:1;
      const unit=base*(.84+.27*random(step,trackIndex+15));
      const sideways=unit*(.21+.11*random(step,trackIndex+20))*side;
      const advance=unit*(random(step,trackIndex+26)-.5)*.16;
      const x=s.a.x+(s.b.x-s.a.x)*ratio-dy*sideways+dx*advance;
      const y=s.a.y+(s.b.y-s.a.y)*ratio+dx*sideways+dy*advance;
      paw(x,y,Math.atan2(dy,dx)+Math.PI/2,unit,step+trackIndex*677);
      offset+=base*(1.25+.36*random(step,trackIndex+31));
      step++;
    }
  }
  function render(withGuide=true){
    state.frame=0;
    if(!state.photo)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(state.photo,0,0,canvas.width,canvas.height);
    state.paths.forEach((path,i)=>trackOnCanvas(path,i));
    if(withGuide && state.draft?.length>1){
      trackOnCanvas(state.draft,state.paths.length);
      const pts=pixels(state.draft);
      ctx.save();ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
      ctx.strokeStyle='rgba(244,220,167,.48)';
      ctx.lineWidth=Math.max(2,Math.min(canvas.width,canvas.height)*.0024);
      ctx.setLineDash([5,12]);ctx.stroke();ctx.restore();
    }
  }
  function schedule(){if(!state.frame&&!state.exporting)state.frame=requestAnimationFrame(()=>{state.frame=0;if(!state.exporting)render();});}
  function update(){
    const photo=!!state.photo,drawn=state.paths.length>0;
    $('placeholder').hidden=photo;
    canvas.hidden=!photo;
    $('hint').hidden=!photo||drawn;
    $('undoBtn').disabled=!drawn;
    $('clearBtn').disabled=!drawn;
    $('downloadBtn').disabled=!drawn;
    $('shareBtn').disabled=!drawn;
  }
  function load(file){
    if(!file)return;
    if(!file.type.startsWith('image/')&&!/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)){
      message('Elige una fotografía válida.');return;
    }
    if(state.loading||state.exporting)return;
    state.loading=true;message('Preparando tu foto…');
    const objectUrl=URL.createObjectURL(file),image=new Image();
    image.onload=()=>{
      URL.revokeObjectURL(objectUrl);state.loading=false;
      if(!image.naturalWidth||!image.naturalHeight){message('No se pudo abrir la foto.');return;}
      const ratio=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
      state.photo=image;state.paths=[];state.draft=null;state.pointerId=null;
      update();schedule();message('Foto lista. Dibuja por dónde pasó Pérez.');
    };
    image.onerror=()=>{URL.revokeObjectURL(objectUrl);state.loading=false;message('No hemos podido abrir esta foto. Prueba con JPG o PNG.');};
    image.src=objectUrl;
  }
  ['cameraInput','galleryInput'].forEach(id=>$(id).addEventListener('change',event=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';load(file);
  }));
  canvas.addEventListener('pointerdown',event=>{
    if(!state.photo||state.exporting||state.pointerId!==null||event.isPrimary===false)return;
    event.preventDefault();state.pointerId=event.pointerId;state.draft=[point(event)];
    try{canvas.setPointerCapture(event.pointerId);}catch(_){}
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId!==state.pointerId||!state.draft)return;
    event.preventDefault();
    const next=point(event),prev=state.draft[state.draft.length-1];
    if(Math.hypot((next.x-prev.x)*canvas.width,(next.y-prev.y)*canvas.height)>=Math.max(2,Math.min(canvas.width,canvas.height)*.004)){
      state.draft.push(next);
      if(state.draft.length>400)state.draft=state.draft.filter((_,i)=>i%2===0);
      schedule();
    }
  });
  function finish(event,cancel=false){
    if(event.pointerId!==state.pointerId||!state.draft)return;
    event.preventDefault();
    const draft=state.draft,pts=pixels(draft);
    const length=pts.reduce((v,p,i)=>i?v+dist(p,pts[i-1]):0,0);
    state.draft=null;state.pointerId=null;
    try{canvas.releasePointerCapture(event.pointerId);}catch(_){}
    if(!cancel&&length>=Math.min(canvas.width,canvas.height)*.04){
      state.paths.push(draft);
      message('Huellas añadidas. Guarda la foto o dibuja otro tramo.');
    }else if(!cancel){message('Dibuja un recorrido un poco más largo.');}
    update();schedule();
  }
  canvas.addEventListener('pointerup',event=>finish(event));
  canvas.addEventListener('pointercancel',event=>finish(event,true));
  canvas.addEventListener('lostpointercapture',event=>{if(event.pointerId===state.pointerId){state.pointerId=null;state.draft=null;schedule();}});
  document.querySelectorAll('[data-style]').forEach(button=>button.addEventListener('click',()=>{
    state.style=button.dataset.style;
    document.querySelectorAll('[data-style]').forEach(b=>{
      const active=b===button;
      b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
    schedule();
  }));
  $('sizeRange').addEventListener('input',event=>{state.size=Number(event.target.value);schedule();});
  $('opacityRange').addEventListener('input',event=>{state.opacity=Number(event.target.value)/100;schedule();});
  $('undoBtn').addEventListener('click',()=>{state.paths.pop();update();schedule();message('Último tramo deshecho.');});
  $('clearBtn').addEventListener('click',()=>{state.paths=[];update();schedule();message('Huellas borradas.');});
  async function exportPng(){
    if(!state.photo||!state.paths.length)throw new Error('Dibuja primero las huellas.');
    if(state.pointerId!==null)throw new Error('Termina de dibujar antes de guardar.');
    state.exporting=true;
    render(false);
    return new Promise((resolve,reject)=>{
      const done=(blob,error)=>{state.exporting=false;schedule();if(error)reject(error);else resolve(blob);};
      try{canvas.toBlob(blob=>blob?done(blob):done(null,new Error('No se pudo generar la imagen.')),'image/png');}
      catch(e){done(null,e);}
    });
  }
  function name(){return 'huellas-raton-perez-'+new Date().toISOString().slice(0,10)+'.png';}
  function save(blob,filename){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  $('downloadBtn').addEventListener('click',async()=>{
    const b=$('downloadBtn');b.disabled=true;
    try{const blob=await exportPng();save(blob,name());message('¡Foto guardada! En iPhone puedes encontrarla en Descargas.');}
    catch(error){message(error.message||'No se pudo guardar la foto.');}
    finally{b.disabled=!state.paths.length;}
  });
  $('shareBtn').addEventListener('click',async()=>{
    const b=$('shareBtn');b.disabled=true;
    try{
      const blob=await exportPng(),filename=name(),file=new File([blob],filename,{type:'image/png'});
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        await navigator.share({files:[file],title:'Las huellas del Ratón Pérez'});
        message('Foto compartida.');
      }else{save(blob,filename);message('No se puede compartir directamente. Hemos descargado la imagen.');}
    }catch(error){if(error.name!=='AbortError')message(error.message||'No se pudo compartir la foto.');}
    finally{b.disabled=!state.paths.length;}
  });
  update();
  const initialStyle=new URLSearchParams(location.search).get('estilo');
  if(['normal','inverse','magic'].includes(initialStyle)) document.querySelector('[data-style="'+initialStyle+'"]').click();
})();