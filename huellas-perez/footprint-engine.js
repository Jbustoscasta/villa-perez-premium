/* Motor gráfico Huellas Pérez v2: texturas, clima, perspectiva y gestos.
 * No accede a red, ubicación ni almacenamiento. Render determinista en Canvas. */
(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const length=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
 const rand=(i,salt=0)=>{const v=Math.sin((i+1)*127.1+(salt+13)*311.7)*43758.5453;return v-Math.floor(v);};
 const shape=(ctx,x,y,rx,ry,angle=0)=>{
   ctx.beginPath();ctx.ellipse(x,y,Math.max(.001,rx),Math.max(.001,ry),angle,0,Math.PI*2);ctx.fill();
 };
 function smooth(points) {
   if(points.length<3)return points.slice();
   let out=points.slice();
   for(let p=0;p<2;p++){
     const next=[out[0]];
     for(let i=0;i<out.length-1;i++){
       const a=out[i],b=out[i+1];
       next.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25});
       next.push({x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75});
     }
     next.push(out[out.length-1]);out=next;
   }
   return out;
 }
 function geometry(points,width,height) {
   const raw=smooth(points.map(p=>({x:clamp(p.x,0,1)*width,y:clamp(p.y,0,1)*height})));
   const segments=[];let total=0;
   for(let i=1;i<raw.length;i++){
     const a=raw[i-1],b=raw[i],d=length(a,b);
     if(d>.001){segments.push({a,b,start:total,end:total+d,d});total+=d;}
   }
   return {segments,total};
 }
 function at(geo,t){
   if(!geo?.segments?.length)return null;
   const d=clamp(t,0,1)*geo.total,parts=geo.segments;
   let lo=0,hi=parts.length-1;
   while(lo<hi){const mid=(lo+hi)>>1;if(parts[mid].end<d)lo=mid+1;else hi=mid;}
   const seg=parts[lo],pct=clamp((d-seg.start)/seg.d,0,1);
   const dx=(seg.b.x-seg.a.x)/seg.d,dy=(seg.b.y-seg.a.y)/seg.d;
   return {x:seg.a.x+(seg.b.x-seg.a.x)*pct,y:seg.a.y+(seg.b.y-seg.a.y)*pct,dx,dy,t};
 }
 function closest(geo,x,y){
   if(!geo?.segments?.length)return null;
   let nearest=null;
   for(const seg of geo.segments){
     const vx=seg.b.x-seg.a.x,vy=seg.b.y-seg.a.y;
     const f=clamp(((x-seg.a.x)*vx+(y-seg.a.y)*vy)/(seg.d*seg.d),0,1);
     const px=seg.a.x+vx*f,py=seg.a.y+vy*f,d=Math.hypot(x-px,y-py);
     if(!nearest||d<nearest.distance)nearest={distance:d,t:(seg.start+seg.d*f)/geo.total,x:px,y:py};
   }
   return nearest;
 }
 const types={
   powder:{base:'#e9dfd1',toe:'#faf4e8',edge:'#897c6b',alpha:.65},
   fabric:{base:'#3b4353',toe:'#505869',edge:'#c1c8d3',alpha:.55},
   chalk:{base:'#d9d5c9',toe:'#f0eee8',edge:'#77726b',alpha:.54},
   dust:{base:'#aaa196',toe:'#ded4c8',edge:'#72685d',alpha:.70},
   damp:{base:'#3a4350',toe:'#5f6a73',edge:'#88929a',alpha:.61},
   dew:{base:'#bacbd2',toe:'#e4f2f5',edge:'#778b96',alpha:.58},
   water:{base:'#536979',toe:'#b2cbd7',edge:'#253a4d',alpha:.62},
   mud:{base:'#514236',toe:'#73604d',edge:'#29251e',alpha:.83},
   snow:{base:'#e6eef4',toe:'#ffffff',edge:'#8aa1b8',alpha:.82},
   frost:{base:'#c8e5ee',toe:'#f5fcff',edge:'#8da9bb',alpha:.80}
 };
 function effectFor(surface='wood',weather='dry'){
   const presets={
     dry:{wood:'powder',fabric:'fabric',tile:'chalk',glass:'dew',outside:'dust'},
     rain:{wood:'mud',fabric:'damp',tile:'mud',glass:'water',outside:'mud'},
     snow:{wood:'snow',fabric:'snow',tile:'snow',glass:'frost',outside:'snow'}
   };
   return (presets[weather]||presets.dry)[surface]||'powder';
 }
 function texturedOval(ctx,x,y,rx,ry,angle,index,effect,alpha){
   const material=types[effect];
   ctx.save();const inheritedAlpha=ctx.globalAlpha;ctx.globalAlpha=inheritedAlpha*alpha;
   // Base difusa: borde irregular y humedad con sombra suave en la superficie.
   ctx.fillStyle=material.base;shape(ctx,x,y,rx,ry,angle);
   ctx.fillStyle=material.toe;ctx.globalAlpha=inheritedAlpha*alpha*.35;
   shape(ctx,x-rx*.16,y-ry*.1,rx*.68,ry*.64,angle);
   // Puntos de grano y bordes rotos (semillas constantes para que no parpadeen).
   ctx.globalAlpha=clamp(inheritedAlpha*alpha*.58,0,1);
   for(let k=0;k<9;k++){
     const a=rand(index,k+101)*Math.PI*2,r=Math.sqrt(rand(index,k+140))*.96;
     const u=Math.cos(a)*r*rx,v=Math.sin(a)*r*ry;
     const xx=x+u*Math.cos(angle)-v*Math.sin(angle);
     const yy=y+u*Math.sin(angle)+v*Math.cos(angle);
     ctx.fillStyle=k%3===0?material.edge:material.toe;
     shape(ctx,xx,yy,rx*(.025+rand(index,k+180)*.045),ry*(.025+rand(index,k+190)*.05));
   }
   ctx.restore();
 }
 function print(ctx,x,y,angle,unit,opacity,index,opts){
   const effect=opts.effect;
   const material=types[effect]||types.powder;
   const mood=opts.mood||'natural';
   const isWet=['mud','damp','water'].includes(effect),isCold=['snow','frost'].includes(effect);
   const isGlow=mood==='magic',isSubtle=mood==='subtle';
   ctx.save();
   ctx.translate(x,y);
   ctx.rotate(angle+(rand(index,1)-.5)*.17);
   ctx.scale(unit,unit);
   ctx.globalAlpha=clamp(opacity*material.alpha*(.75+rand(index,2)*.35)*(isSubtle?.66:1),0,1);
   const inheritedFootAlpha=ctx.globalAlpha;
   if(isGlow){ctx.shadowColor='rgba(255,212,132,.75)';ctx.shadowBlur=unit*.3;ctx.shadowOffsetY=0;}
   else if(isCold){ctx.shadowColor='rgba(45,66,90,.65)';ctx.shadowBlur=unit*.12;ctx.shadowOffsetY=unit*.03;}
   else if(isWet){ctx.shadowColor='rgba(32,28,24,.55)';ctx.shadowBlur=unit*.13;ctx.shadowOffsetY=unit*.03;}
   else{ctx.shadowColor='rgba(15,19,28,.35)';ctx.shadowBlur=unit*.08;ctx.shadowOffsetY=unit*.02;}
   // Escala al tamaño de una impresión: almohadilla y cuatro o cinco dedos, nunca símbolo emoji.
   if(isCold){
     ctx.fillStyle=material.edge;ctx.globalAlpha*=.5;
     shape(ctx,0,.14,.32,.37);ctx.globalAlpha=inheritedFootAlpha;
   }else if(isWet){
     ctx.fillStyle=material.edge;ctx.globalAlpha*=.26;shape(ctx,.02,.15,.33,.38);
     ctx.globalAlpha=inheritedFootAlpha;
   }
   texturedOval(ctx,0,.16,.22,.27,-.12,index,effect,.93);
   const toes=[[-.24,-.13,.075,.13,-.32],[-.095,-.285,.072,.125,-.12],[.074,-.303,.072,.13,.05],[.232,-.18,.073,.12,.28]];
   if(index%3===0)toes.push([.298,-.034,.053,.085,.32]); // Pata posterior de cinco dedos.
   toes.forEach(([tx,ty,rx,ry,rot],i)=>{
     if(rand(index,i+32)>.965&&!isCold)return; // Desgaste natural: algún dedo casi desaparece.
     texturedOval(ctx,tx,ty,rx*(.9+rand(index,i+35)*.18),ry,rot,index*7+i,effect,.92);
   });
   ctx.shadowBlur=0;ctx.shadowOffsetY=0;
   // Restos físicos: salpicaduras de barro, cristal húmedo, granos de nieve/polvo.
   const grains=effect==='mud'?13:effect==='snow'||effect==='frost'?18:effect==='powder'||effect==='dust'?10:5;
   ctx.fillStyle=isGlow?'#ffe6af':isCold?'#f8ffff':isWet?material.base:material.toe;
   for(let j=0;j<grains;j++){
     const a=rand(index,j+71)*Math.PI*2,r=.28+rand(index,j+83)*(effect==='mud'?.5:.31);
     const gx=Math.cos(a)*r,gy=Math.sin(a)*r;
     ctx.globalAlpha=clamp(inheritedFootAlpha*(isCold?.27:.14)*(1+rand(index,j+23)),0,.6);
     shape(ctx,gx,gy,.008+rand(index,j+94)*.023,.008+rand(index,j+108)*.024);
   }
   if(isWet) {
     ctx.globalAlpha=inheritedFootAlpha*.12;ctx.strokeStyle=material.edge;ctx.lineWidth=.027;
     ctx.beginPath();ctx.moveTo(-.22,.24);ctx.quadraticCurveTo(-.17,.53,-.1,.61);ctx.stroke();
   }
   if(isGlow){
     ctx.shadowBlur=0;ctx.globalAlpha=opacity*.45;ctx.fillStyle='#fff6d7';
     for(let j=0;j<3;j++){
       shape(ctx,(rand(index,j+11)-.5)*1.5,(rand(index,j+21)-.5)*1.5,.018,.018);
     }
   }
   ctx.restore();
 }
 function drawPath(ctx,points,opts={}){
   if(!Array.isArray(points)||points.length<2)return null;
   const geo=geometry(points,opts.width,opts.height);
   if(!geo.total)return geo;
   const min=Math.min(opts.width,opts.height),base=min*(clamp(opts.size??65,30,120)/3000);
   const perspective=clamp(opts.perspective??25,0,100)/100;
   const opacity=clamp(opts.opacity??.75,0,1);
   const marks=opts.marks||[];
   const markRegions=marks.map((m,i)=>({type:m.type,pos:clamp(m.t,0,1)*geo.total,index:i,span:base*(m.type==='jump'?3.15:1.55)}));
   const offset=opts.index||0;
   let distanceWalked=base*.55,steps=0;
   while(distanceWalked<geo.total-base*.14&&steps<240){
     const pos=at(geo,distanceWalked/geo.total);
     let hidden=false;
     for(const m of markRegions){if(Math.abs(distanceWalked-m.pos)<m.span){hidden=true;break;}}
     if(!hidden && pos){
       const depth=1+perspective*(.5-distanceWalked/geo.total)*.75;
       const unit=base*depth*(.83+rand(steps,offset+1)*.30);
       const side=steps%2?-1:1;
       const lateral=unit*(.23+rand(steps,offset+3)*.13)*side;
       const advance=unit*(rand(steps,offset+4)-.5)*.16;
       const x=pos.x-pos.dy*lateral+pos.dx*advance;
       const y=pos.y+pos.dx*lateral+pos.dy*advance;
       print(ctx,x,y,Math.atan2(pos.dy,pos.dx)+Math.PI/2,unit,opacity,steps+offset*241,opts);
     }
     const sizeVariation=.82+rand(steps,offset+9)*.32;
     distanceWalked+=base*(steps%7===0?1.32:1.49)*sizeVariation;
     steps++;
   }
   // Gestos colocados por el padre; se dibujan SOBRE las pisadas normales.
   for(const m of markRegions){
     const center=at(geo,m.pos/geo.total);
     if(!center)continue;
     const angle=Math.atan2(center.dy,center.dx)+Math.PI/2;
     const direction=(t)=>at(geo,clamp(t/geo.total,0,1));
     const count=m.type==='stop'?4:m.type==='turn'?4:4;
     for(let i=0;i<count;i++){
       let d=m.pos,side=i%2?-1:1,rotation=0,scale=1,extra=0;
       if(m.type==='stop'){d+=(Math.floor(i/2)-.5)*base*.7;rotation=(i-1.5)*.22;scale=.91;extra=.18;}
       else if(m.type==='jump'){d+=(i<2?-base*2.1:base*2.1)+(i%2)*base*.23;scale=i<2?1.15:1.3;extra=.2;}
       else if(m.type==='turn'){d+=(i-1.5)*base*.56;rotation=(i-1.5)*.4;scale=.95;extra=.2;}
       const p=direction(d);if(!p)continue;
       const px=p.x-p.dy*base*(.22+extra)*side,py=p.y+p.dx*base*(.22+extra)*side;
       print(ctx,px,py,angle+rotation,base*scale,opacity,7500+m.index*9+i+offset*300,opts);
     }
     if(m.type==='jump'){
       // Marcas de impacto: apenas 2 o 3 partículas en el aterrizaje, no una estela falsa.
       const land=direction(m.pos+base*2.25);
       if(land){
         ctx.save();ctx.fillStyle=types[opts.effect||'powder'].toe;
         for(let i=0;i<4;i++){ctx.globalAlpha=opacity*.17;shape(ctx,land.x+(rand(i,22)-.5)*base*1.4,land.y+(rand(i,33)-.5)*base*1.4,base*.035,base*.03);}
         ctx.restore();
       }
     }
   }
   return geo;
 }
 function marker(ctx,geo,mark,width,height){
   const p=at(geo,mark.t);if(!p)return;
   const r=Math.max(12,Math.min(width,height)*.014);
   const label={stop:'Ⅱ',jump:'↗',turn:'↶'}[mark.type]||'•';
   ctx.save();ctx.fillStyle='rgba(16,28,47,.88)';ctx.strokeStyle='#f1d49e';ctx.lineWidth=Math.max(1.3,r*.13);
   ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.font='bold '+Math.round(r*1.25)+'px sans-serif';ctx.fillStyle='#f4dcad';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(label,p.x,p.y);ctx.restore();
 }
 const api={effectFor,geometry,at,closest,drawPath,marker};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.VPHuellasEngine=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
