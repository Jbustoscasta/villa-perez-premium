/**
 * Villa Pérez · Premium Map renderer v0.5.
 * Enhances REAL vector-map streets and real route geometry. No fabricated geography.
 * Compatible with OpenFreeMap/MapLibre. Keeps all map attribution.
 */
import {pointAt} from './route-utils.mjs';

function tryPaint(map,id,property,value) {
  try { map.setPaintProperty(id,property,value); } catch(e) { /* layer style may not support property */ }
}
function isRoad(layer) {
  const id=String(layer.id||'').toLowerCase();
  const source=String(layer['source-layer']||'').toLowerCase();
  return layer.type==='line' && !/rail|ferry|boundary|admin|tunnel_outline|water|waterway|airport|aeroway|contour/.test(id) &&
    (/road|street|highway|motorway|trunk|primary|secondary|tertiary|residential|service|path|bridge|transportation/.test(id) || source==='transportation');
}
function roadRank(id) {
  const s=String(id).toLowerCase();
  if(/casing|outline|edge/.test(s))return 'casing';
  if(/motorway|trunk|primary|highway|major/.test(s))return 'major';
  if(/secondary|tertiary|medium|minor|residential|street/.test(s))return 'local';
  if(/path|pedestrian|foot|cycle|track/.test(s))return 'path';
  return 'other';
}

/** Repaint the basemap *after its style loaded*: street visibility comes first. */
export function applyPremiumStreetStyle(map) {
  const layers=(map.getStyle()?.layers||[]).slice();
  const stats={roads:0,labels:0,parks:0,buildings:0};
  for(const layer of layers) {
    const id=String(layer.id||'');
    const name=id.toLowerCase();
    const source=String(layer['source-layer']||'').toLowerCase();
    if(layer.type==='background'){
      tryPaint(map,id,'background-color','#102b37');
    } else if(layer.type==='fill') {
      if(/water|lake|ocean|river/.test(name)||source==='water'){
        tryPaint(map,id,'fill-color','#244d65');tryPaint(map,id,'fill-opacity',.98);
      }else if(/park|grass|forest|wood|garden|green|landcover|landuse/.test(name)||/landcover|landuse|park/.test(source)){
        tryPaint(map,id,'fill-color','#284b43');tryPaint(map,id,'fill-opacity',.93);stats.parks++;
      }else if(/building/.test(name)||source==='building'){
        tryPaint(map,id,'fill-color','#335360');tryPaint(map,id,'fill-opacity',.79);stats.buildings++;
      }else if(/land|residential|urban|background/.test(name)){
        tryPaint(map,id,'fill-color','#193847');
      }
    }else if(isRoad(layer)){
      const rank=roadRank(id);
      const c=rank==='casing'?'#0c2934':rank==='major'?'#e5dbb7':rank==='path'?'#648e94':rank==='local'?'#b3cad0':'#a2bbc4';
      tryPaint(map,id,'line-color',c);
      if(rank!=='casing')tryPaint(map,id,'line-opacity',rank==='path'?.9:1);
      stats.roads++;
    }else if(layer.type==='symbol' && (layer.layout?.['text-field']!=null)) {
      const roadName=/road|street|place|settlement|transportation/.test(name)||/transportation_name|place/.test(source);
      tryPaint(map,id,'text-color',roadName?'#fff1d6':'#e6ece4');
      tryPaint(map,id,'text-halo-color','#0b2a34');
      tryPaint(map,id,'text-halo-width',roadName?2.3:1.7);
      tryPaint(map,id,'text-halo-blur',.65);
      stats.labels++;
    }
  }
  return stats;
}

/** Verified OpenFreeMap planet includes transportation + building vector source-layers.
 * Prefer style source to avoid duplicate tile requests. */
function findVectorSource(map) {
  const sources=map.getStyle()?.sources||{};
  for(const [id,source] of Object.entries(sources)){
    if(source?.type==='vector' && /openfreemap|openmaptiles|planet/.test(String(source.url||'')+' '+id))
      return id;
  }
  for(const [id,source] of Object.entries(sources))if(source?.type==='vector')return id;
  const id='vp-planet-vector';
  if(!map.getSource(id))map.addSource(id,{type:'vector',url:'https://tiles.openfreemap.org/planet'});
  return id;
}

/** Real 3D buildings (no fake geometry), plus highlighted streets; beneath label text. */
export function installPremiumCityLayers(map) {
  const source=findVectorSource(map);
  const label=(map.getStyle()?.layers||[]).find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
  let buildings=false,avenues=false;
  if(!map.getLayer('vp-avenue-highlight')){
    try{
      map.addLayer({
        id:'vp-avenue-highlight',type:'line',source,'source-layer':'transportation',minzoom:12.5,
        filter:['match',['get','class'],['motorway','trunk','primary','secondary','tertiary'],true,false],
        paint:{'line-color':'#e6cf9c','line-width':['interpolate',['linear'],['zoom'],12,.5,15,1.8,17,3.5],
          'line-opacity':.54,'line-blur':.4}
      },label);avenues=true;
    }catch(e){console.warn('Premium: carriles adicionales no disponibles',e)}
  }
  if(!map.getLayer('vp-city-3d')){
    try{
      map.addLayer({
        id:'vp-city-3d',type:'fill-extrusion',source,'source-layer':'building',minzoom:14.3,
        filter:['!=',['get','hide_3d'],true],
        paint:{
          'fill-extrusion-color':['interpolate',['linear'],['to-number',['get','render_height'],12],0,'#527481',28,'#759398',100,'#b5a685'],
          'fill-extrusion-height':['interpolate',['linear'],['zoom'],14.3,0,15.4,['to-number',['get','render_height'],12]],
          'fill-extrusion-base':['to-number',['get','render_min_height'],0],
          'fill-extrusion-opacity':.82,
          'fill-extrusion-vertical-gradient':true
        }
      },label);buildings=true;
    }catch(e){console.warn('Premium: edificios 3D no disponibles',e)}
  }
  return {source,avenues,buildings};
}

/** Brighter route readably distinct from streets on a phone. */
export function premiumRoutePaint(map) {
  const custom=[
    ['route-shadow',{'line-color':'#071c2a','line-width':24,'line-opacity':.96,'line-blur':1.7}],
    ['route-pending',{'line-color':'#a6d3cf','line-width':4.8,'line-opacity':.66}],
    ['route-glow',{'line-color':'#f5b84f','line-width':34,'line-opacity':.58,'line-blur':17}],
    ['route-halo',{'line-color':'#ffe09a','line-width':17,'line-opacity':.82,'line-blur':6}],
    ['route-gold',{'line-color':'#fff6c9','line-width':6.2,'line-opacity':1}],
    ['route-sparkle-aura',{'circle-radius':['*',['get','size'],2.5],'circle-opacity':['get','alpha'],'circle-color':'#ffe5a3','circle-blur':.7}],
    ['route-sparkle-core',{'circle-radius':3.2,'circle-color':'#ffffff','circle-opacity':['get','alpha']}]
  ];
  for(const [id,properties] of custom){
    if(map.getLayer(id))for(const [property,value] of Object.entries(properties))tryPaint(map,id,property,value);
  }
}

/** Screen-space gold glints with 1:1 geographic anchoring, not a randomly drawn trail.
 * Called by the same requestAnimationFrame as the real route movement. */
export function drawGoldenRouteFx(map,path,progress,canvas,time,reducedMotion=false) {
  if(!canvas||!map||!path?.points||!path.total)return;
  const w=canvas.clientWidth, h=canvas.clientHeight;
  if(w<8||h<8)return;
  const dpr=Math.min(1.7,(typeof window!=='undefined'&&window.devicePixelRatio)||1);
  const width=Math.round(w*dpr),height=Math.round(h*dpr);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  if(reducedMotion)return;
  ctx.globalCompositeOperation='screen';
  const f=Math.min(1,Math.max(0,progress));
  const mouse=map.project(pointAt(path,f).coordinate);
  if(!Number.isFinite(mouse.x)||!Number.isFinite(mouse.y))return;
  const t=time*.001;
  // A concentrated luminous aura around the character, no excessive map obscuring.
  const glow=ctx.createRadialGradient(mouse.x,mouse.y,1,mouse.x,mouse.y,48);
  glow.addColorStop(0,'rgba(255,248,198,.7)');
  glow.addColorStop(.24,'rgba(254,194,80,.43)');
  glow.addColorStop(1,'rgba(255,194,77,0)');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(mouse.x,mouse.y,48,0,Math.PI*2);ctx.fill();
  const n=24, spacing=.004;
  for(let i=0;i<n;i++){
    const q=f-i*spacing;
    if(q<0)break;
    const p=map.project(pointAt(path,q).coordinate);
    if(p.x<-30||p.y<-30||p.x>w+30||p.y>h+30)continue;
    const wave=Math.sin(t*5.3+i*1.7),radius=(i%4===0?3.6:2)+wave*.8;
    const strength=(1-i/n)*(.58+.26*Math.max(0,wave));
    ctx.save();ctx.globalAlpha=strength;
    ctx.fillStyle=i%3===0?'#fffef1':'#ffd27f';
    ctx.shadowColor='#ffc25b';ctx.shadowBlur=i%4===0?19:12;
    ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.7,radius),0,Math.PI*2);ctx.fill();
    if(i%4===0){
      ctx.shadowBlur=7;ctx.strokeStyle='#fff8cc';ctx.lineWidth=1.45;
      const a=6.5+Math.sin(t*3+i)*2;
      ctx.beginPath();ctx.moveTo(p.x-a,p.y);ctx.lineTo(p.x+a,p.y);
      ctx.moveTo(p.x,p.y-a);ctx.lineTo(p.x,p.y+a);ctx.stroke();
    }
    ctx.restore();
  }
  // A travelling golden wave along the remaining true streets.
  const ahead=Math.min(1,f+.024+Math.sin(t*1.8)*.003);
  const marker=map.project(pointAt(path,ahead).coordinate);
  if(Number.isFinite(marker.x)&&Number.isFinite(marker.y)){
    const r=5+2*Math.sin(t*4);
    ctx.strokeStyle='rgba(255,238,165,.8)';ctx.lineWidth=2;
    ctx.shadowColor='#ffe0a0';ctx.shadowBlur=16;
    ctx.beginPath();ctx.arc(marker.x,marker.y,r,0,Math.PI*2);ctx.stroke();
  }
  ctx.globalCompositeOperation='source-over';
  ctx.shadowBlur=0;ctx.globalAlpha=1;
}
