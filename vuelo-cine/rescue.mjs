/**
 * Respaldo autónomo de mapa: funciona aun si MapLibre, los estilos vectoriales
 * o el segundo contexto WebGL fallan en Safari. Usa teselas raster de OSM
 * sin clave, conserva la atribución y dibuja ruta/partículas en un canvas.
 * NO inventa las calles si hay tiles reales; sin tiles, avisa del esquema.
 */
const TILE=256,DEG=Math.PI/180;
const merc=(lng,lat)=>({
  x:(lng+180)/360,
  y:(1-Math.log(Math.tan(lat*DEG)+1/Math.cos(lat*DEG))/Math.PI)/2
});
function pointPx(coord,center,z,w,h){
  const p=merc(coord[0],coord[1]),c=merc(center[0],center[1]),f=TILE*Math.pow(2,z);
  return [(p.x-c.x)*f+w/2,(p.y-c.y)*f+h/2];
}
class LocalSource{
 constructor(map,id,data){this.map=map;this.id=id;this.data=data}
 setData(data){this.data=data;this.map.schedule()}
}
export class RescueMarker{
 constructor(opts){this.element=opts.element;this.map=null;this.coord=[0,0]}
 setLngLat(x){this.coord=Array.isArray(x)?x:[x.lng,x.lat];this.update();return this}
 addTo(map){this.map=map;map.markers.add(this);map.layer.append(this.element);
   this.element.style.position='absolute';this.element.style.zIndex='5';
   this.element.style.transform='translate(-50%,-100%)';this.element.style.pointerEvents='none';this.update();return this}
 getElement(){return this.element}
 update(){if(!this.map)return;const [x,y]=this.map.project(this.coord);
   this.element.style.left=x+'px';this.element.style.top=y+'px'}
 remove(){if(this.map){this.map.markers.delete(this);this.map=null;this.element.remove()}return this}
}
export class RescueMap{
 constructor(container,center,day=false){
  this.el=container;this.center=center.slice();this.zoom=14;this.day=day;
  this.markers=new Set();this.sources={};this.layers={};this.images=new Map();
  this.isRescue=true;this.drawToken=0;this.hasTiles=false;this.tileFailures=0;
  container.innerHTML='';container.classList.add('rescue-map');
  this.tiles=document.createElement('div');this.tiles.className='rescue-tiles';
  this.layer=document.createElement('div');this.layer.className='rescue-overlay';
  this.canvas=document.createElement('canvas');this.canvas.className='rescue-line';
  this.caption=document.createElement('div');this.caption.className='rescue-credits';
  this.caption.textContent='© OpenStreetMap contributors · modo compatible';
  container.append(this.tiles,this.canvas,this.layer,this.caption);
  this.ctx=this.canvas.getContext('2d');
  this.resizeBound=()=>this.resize();
  window.addEventListener('resize',this.resizeBound,{passive:true});
  this.resize();this.schedule();
 }
 on(){}
 isStyleLoaded(){return true}
 getStyle(){return {sources:{},layers:[]}}
 getSource(id){return this.sources[id]||null}
 addSource(id,opt){this.sources[id]=new LocalSource(this,id,opt.data);this.schedule()}
 getLayer(id){return this.layers[id]||null}
 addLayer(l){this.layers[l.id]=l;this.schedule()}
 querySourceFeatures(){return[]}
 getZoom(){return this.zoom}
 getBounds(){return {contains:()=>true}}
 project(coord){return pointPx(coord,this.center,this.zoom,this.w,this.h)}
 resize(){
  this.w=Math.max(200,this.el.clientWidth||window.innerWidth);
  this.h=Math.max(250,this.el.clientHeight||window.innerHeight);
  const scale=Math.min(window.devicePixelRatio||1,1.5);
  this.canvas.width=Math.round(this.w*scale);this.canvas.height=Math.round(this.h*scale);
  this.canvas.style.width=this.w+'px';this.canvas.style.height=this.h+'px';
  this.ctx?.setTransform(scale,0,0,scale,0,0);
  this.schedule();
 }
 jumpTo(opts){if(opts.center)this.center=[...opts.center];if(Number.isFinite(opts.zoom))this.zoom=opts.zoom;this.schedule()}
 easeTo(opts){this.jumpTo(opts)}
 fitBounds(bounds,opt={}){
  const [a,b]=bounds,w=this.w-(opt.padding?.left||0)-(opt.padding?.right||0),
   h=this.h-(opt.padding?.top||0)-(opt.padding?.bottom||0);
  const p=merc(a[0],a[1]),q=merc(b[0],b[1]);
  const dx=Math.max(1e-8,Math.abs(p.x-q.x)),dy=Math.max(1e-8,Math.abs(p.y-q.y));
  this.zoom=Math.max(10,Math.min(opt.maxZoom||16,Math.floor(Math.log2(Math.min(w/(dx*TILE),h/(dy*TILE))))));
  this.center=[(a[0]+b[0])/2,(a[1]+b[1])/2];this.schedule();
 }
 setStyle(name){this.day=String(name).includes('bright');this.schedule()}
 schedule(){if(this.drawToken)return;this.drawToken=requestAnimationFrame(()=>{this.drawToken=0;this.draw()})}
 tileElement(z,x,y){
  const max=Math.pow(2,z),wrap=((x%max)+max)%max;
  const key=z+'/'+wrap+'/'+y;
  let img=this.images.get(key);
  if(!img){
   img=document.createElement('img');
   img.alt='';img.decoding='async';img.loading='eager';img.draggable=false;
   img.className='rescue-tile';img.style.position='absolute';img.style.width='256px';img.style.height='256px';
   img.src='https://tile.openstreetmap.org/'+z+'/'+wrap+'/'+y+'.png';
   img.onload=()=>{this.hasTiles=true;this.caption.textContent='© OpenStreetMap contributors · calles reales (vista compatible)'};
   img.onerror=()=>{this.tileFailures++;img.style.opacity='0'};
   this.images.set(key,img);this.tiles.append(img);
  }
  return img;
 }
 drawTiles(){
  const z=Math.max(1,Math.min(18,Math.round(this.zoom)));
  const c=merc(this.center[0],this.center[1]),scale=Math.pow(2,z)*TILE;
  const wx=c.x*scale,wy=c.y*scale;
  const sx=Math.floor((wx-this.w/2)/TILE)-1,ex=Math.ceil((wx+this.w/2)/TILE)+1;
  const sy=Math.floor((wy-this.h/2)/TILE)-1,ey=Math.ceil((wy+this.h/2)/TILE)+1;
  const keep=new Set();
  for(let x=sx;x<=ex;x++)for(let y=sy;y<=ey;y++){
   if(y<0||y>=Math.pow(2,z))continue;
   const el=this.tileElement(z,x,y),id=z+'/'+(((x%(2**z))+(2**z))%(2**z))+'/'+y;
   keep.add(id);
   el.style.left=(this.w/2+x*TILE-wx)+'px';
   el.style.top=(this.h/2+y*TILE-wy)+'px';
  }
  for(const [k,img] of this.images)if(!keep.has(k)){img.remove();this.images.delete(k)}
  this.tiles.classList.toggle('rescue-day',this.day);
 }
 coordinates(sourceId){
  const features=this.sources[sourceId]?.data?.features;
  return features?.[0]?.geometry?.coordinates||[];
 }
 draw(){
  this.drawTiles();
  const c=this.ctx;if(!c)return;
  c.clearRect(0,0,this.w,this.h);
  if(!this.hasTiles){
   c.save();c.fillStyle=this.day?'#314d64':'#0b2541';c.fillRect(0,0,this.w,this.h);
   c.strokeStyle=this.day?'#9ab2b0':'#46617a';c.lineWidth=2.5;
   for(let x=0;x<this.w+70;x+=55){c.beginPath();c.moveTo(x,0);c.lineTo(x+this.h*.4,this.h);c.stroke()}
   for(let y=0;y<this.h+80;y+=78){c.beginPath();c.moveTo(0,y);c.lineTo(this.w,y+30);c.stroke()}
   c.restore();
  }
  const lineData=this.coordinates('vp-route'),prog=this.coordinates('vp-progress');
  const plot=(pts,color,width,blur=0)=>{
   if(pts.length<2)return;
   c.beginPath();
   pts.forEach((p,i)=>{const [x,y]=this.project(p);if(i)c.lineTo(x,y);else c.moveTo(x,y)});
   c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.shadowBlur=blur;c.shadowColor=color;c.stroke();c.shadowBlur=0;
  };
  plot(lineData,'rgba(241,164,73,.40)',17,15);
  plot(lineData,'rgba(255,191,98,.86)',7,4);
  plot(lineData,'#fff2c4',2.7,2);
  plot(prog,'#ffffff',4,8);
  const glints=this.sources['vp-glints']?.data?.features||[];
  for(let i=0;i<glints.length;i++){const xy=glints[i].geometry?.coordinates;if(!xy)continue;
   const [x,y]=this.project(xy);c.beginPath();c.arc(x,y,i%3===0?2.2:1.1,0,Math.PI*2);
   c.fillStyle='#fff6c0';c.shadowColor='#ffc56e';c.shadowBlur=8;c.fill();c.shadowBlur=0;
  }
  for(const marker of this.markers)marker.update();
 }
 remove(){cancelAnimationFrame(this.drawToken);window.removeEventListener('resize',this.resizeBound);this.el.innerHTML=''}
}
export function enableRescue(container,center,day){const map=new RescueMap(container,center,day);return {map,Marker:RescueMarker}}
