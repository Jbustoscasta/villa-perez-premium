/**
 * Villa Pérez · Arquitectura de cuento v2
 *
 * Real OSM footprints ONLY. Never fabricates streets, blocks or building positions.
 * Artistic additions: architectural cornices, smaller windows, rooftop trim,
 * occasional modest pitched roofs and chimneys. All share MapLibre's WebGL context.
 * Designed to avoid an additional WebGL renderer on iPhone Safari.
 */
const DEG=Math.PI/180,EARTH=40075016.6856;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hash=(a,b=0)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x)};
const project=(lon,lat)=>({x:(lon+180)/360,y:(1-Math.log(Math.tan(lat*DEG)+1/Math.cos(lat*DEG))/Math.PI)/2,scale:1/(EARTH*Math.max(.12,Math.cos(lat*DEG)))});
const meters=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos((a[1]+b[1])*.5*DEG),(a[1]-b[1])*111320);
const finite=p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
function mappedHeight(props={}){
 const n=v=>{const t=Number(v);return Number.isFinite(t)&&t>0?t:0};
 const height=n(props.render_height)||n(props.height);
 const levels=n(props['building:levels'])||n(props.levels)||n(props.render_levels);
 return clamp(height>2?height:levels>0?levels*3.2:16,6,110);
}
function polygonArea(ring){
 let a=0;for(let i=0;i<ring.length;i++){
  const p=ring[i],q=ring[(i+1)%ring.length];a+=p[0]*q[1]-q[0]*p[1];
 }return Math.abs(a)*.5;
}
function convex(ring){
 let prev=0;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],c=ring[(i+2)%ring.length];
  const d=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
  if(Math.abs(d)<1e-6)continue;
  const sign=Math.sign(d);if(prev&&sign!==prev)return false;prev=sign;
 }
 return true;
}
export function extractMappedBuildings(map,source,sourceLayer,focus,{max=90,radius=540}={}){
 if(!source||!map?.querySourceFeatures||!finite(focus))return[];
 let features=[];
 try{features=map.querySourceFeatures(source,{sourceLayer})||[]}catch(e){return[]}
 const seen=new Set(),mapped=[];
 for(const f of features){
  if(mapped.length>=max)break;
  const geometry=f.geometry,raw=geometry?.type==='Polygon'?geometry.coordinates?.[0]:
   geometry?.type==='MultiPolygon'?geometry.coordinates?.[0]?.[0]:null;
  if(!Array.isArray(raw)||raw.length<4)continue;
  let ring=raw.filter(finite);
  if(ring.length>30)ring=ring.filter((_,i)=>i%Math.ceil(ring.length/30)===0);
  if(ring.length>=4&&meters(ring[0],ring.at(-1))<.05)ring=ring.slice(0,-1);
  if(ring.length<3||ring.length>30)continue;
  const center=ring.reduce((a,p)=>[a[0]+p[0]/ring.length,a[1]+p[1]/ring.length],[0,0]);
  if(!finite(center)||meters(center,focus)>radius)continue;
  const key=Math.round(center[0]*110000)+':'+Math.round(center[1]*110000);
  if(seen.has(key))continue;seen.add(key);
  const local=ring.map(p=>[(p[0]-center[0])*111320*Math.cos(center[1]*DEG),(p[1]-center[1])*111320]);
  const area=polygonArea(local);
  if(area<15||area>9000)continue;
  const properties=f.properties||{},seed=hash(Math.round(center[0]*1e5),Math.round(center[1]*1e5));
  mapped.push({center,ring,height:mappedHeight(properties),seed,
   area,convex:convex(local),roofShape:properties['roof:shape']||properties.roof_shape||'',
   roofHeight:Number(properties['roof:height']||0)||0,material:properties['building:material']||''});
 }
 return mapped;
}
const vertexShader=[
 'attribute vec3 a_position;','attribute vec4 a_color;',
 'uniform mat4 u_matrix;','varying vec4 v_color;',
 'void main(){gl_Position=u_matrix*vec4(a_position,1.0);v_color=a_color;}'
].join('\n');
const fragmentShader=[
 'precision mediump float;','varying vec4 v_color;',
 'uniform float u_seconds;','uniform float u_magic;',
 'void main(){',
 ' float isWindow=step(0.60,v_color.a);',
 ' float pulse=0.88+0.12*sin(u_seconds*0.64+v_color.a*24.0);',
 ' vec3 col=mix(v_color.rgb,v_color.rgb*pulse,isWindow*u_magic);',
 ' col=mix(col,col*vec3(.77,.84,.93),isWindow*(1.0-u_magic));',
 ' gl_FragColor=vec4(col,0.97);',
 '}'
].join('\n');
function composeMatrix(P,origin){
 const sc=origin.scale;
 // Local east/north/up in metres -> world Mercator.
 const M=[sc,0,0,0,0,-sc,0,0,0,0,sc,0,origin.x,origin.y,0,1];
 const A=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++){
  let v=0;for(let k=0;k<4;k++)v+=P[k*4+r]*M[c*4+k];
  A[c*4+r]=v;
 }
 return A;
}
const rgb={
 stone:[.52,.56,.62,.12],roof:[.38,.50,.58,.21],terracotta:[.56,.31,.26,.21],
 copper:[.44,.57,.51,.22],brass:[.78,.62,.37,.25],gold:[1,.77,.35,.94],
 bright:[1,.91,.65,.99],glass:[.18,.31,.44,.34],frame:[.28,.36,.43,.22],
 ledge:[.39,.48,.56,.20],chimney:[.43,.40,.42,.16]
};
export function buildArchitectureGeometry(buildings,focus,{maxVertices=100000,quality='mobile'}={}){
 const base=project(...focus),scale=base.scale,verts=[];
 const place=(lnglat,z=0)=>{
  const v=project(...lnglat);
  return [(v.x-base.x)/scale,(base.y-v.y)/scale,z];
 };
 const tri=(a,b,c,color)=>{
  if(verts.length/7+3>maxVertices)return;
  for(const p of [a,b,c])verts.push(...p,...color);
 };
 const quad=(a,b,c,d,color)=>{tri(a,b,c,color);tri(a,c,d,color)};
 const trim=(a,b,z,thick,out,color)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(len<.1)return;
  const n=[-dy/len,dx/len],aa=[a[0]+n[0]*out,a[1]+n[1]*out],bb=[b[0]+n[0]*out,b[1]+n[1]*out];
  quad([aa[0],aa[1],z],[bb[0],bb[1],z],[bb[0],bb[1],z+thick],[aa[0],aa[1],z+thick],color);
 };
 let windows=0,roofAccents=0,facades=0,modeled=0;
 for(const b of buildings){
  if(verts.length/7>=maxVertices-1800)break;
  const p=place(b.center,0),h=b.height,ring=b.ring.map(c=>place(c,0));
  if(ring.length<3)continue;
  modeled++;
  const edgeColors=[rgb.stone,rgb.ledge,rgb.roof];
  const roofColor=b.seed>.74?rgb.terracotta:b.seed>.36?rgb.roof:rgb.copper;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],c=ring[(i+1)%ring.length],dx=c[0]-a[0],dy=c[1]-a[1];
   const len=Math.hypot(dx,dy);if(len<5)continue;
   // Make the normal point OUTWARD even if the polygon winding changes.
   const mid=[(a[0]+c[0])*.5,(a[1]+c[1])*.5];
   let nx=-dy/len,ny=dx/len;
   if((mid[0]-p[0])*nx+(mid[1]-p[1])*ny<0){nx=-nx;ny=-ny}
   const u=[dx/len,dy/len],out=(v,z)=>[v[0]+nx*z,v[1]+ny*z];
   const extrusion=(xx,z,offset=.3)=>[a[0]+u[0]*xx+nx*offset,a[1]+u[1]*xx+ny*offset,z];
   const trimQuad=(height,thick,shift,shade)=>{
    const x0=[a[0]+nx*shift,a[1]+ny*shift,height],x1=[c[0]+nx*shift,c[1]+ny*shift,height];
    quad(x0,x1,[x1[0],x1[1],height+thick],[x0[0],x0[1],height+thick],shade);
   };
   // Parapet, moulding and cornice occupy the REAL roof footprint perimeter.
   trimQuad(h-.72,.24,.20,rgb.stone);
   trimQuad(h-.32,.22,.23,roofColor);
   if(h>15&&b.seed>.20)trimQuad(h-2.55,.18,.12,rgb.ledge);
   facades++;
   const cols=Math.min(7,Math.max(1,Math.floor((len-2.5)/4.25)));
   const rows=Math.min(7,Math.max(1,Math.floor((h-4.5)/3.5)));
   for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const r=hash(b.seed*1000+i*17+col*11,row*29),z=2.6+row*3.5;
    if(z+1.65>h-1.4)continue;
    const along=(col+1)*len/(cols+1),width=.88+hash(b.seed*49+col,row)*.18;
    // Decorative window recess and architectural frame.
    const x0=extrusion(along-width*.65,z-.14,.31);
    const x1=extrusion(along+width*.65,z-.14,.31);
    quad(x0,x1,[x1[0],x1[1],z+1.66],[x0[0],x0[1],z+1.66],rgb.frame);
    const u0=extrusion(along-width*.48,z,.35);
    const u1=extrusion(along+width*.48,z,.35);
    const color=r>.67?(r>.92?rgb.bright:[rgb.gold[0],rgb.gold[1]*(.9+.1*r),rgb.gold[2],.7+r*.25]):rgb.glass;
    quad(u0,u1,[u1[0],u1[1],z+1.42],[u0[0],u0[1],z+1.42],color);
    if(r>.67)windows++;
    if(r>.94){
     const m=extrusion(along,z,.39);
     quad([m[0]-.028*u[0],m[1]-.028*u[1],z],
      [m[0]+.028*u[0],m[1]+.028*u[1],z],
      [m[0]+.028*u[0],m[1]+.028*u[1],z+1.42],
      [m[0]-.028*u[0],m[1]-.028*u[1],z+1.42],rgb.ledge);
    }
    // Discrete balcony sill, every other row on some historic-looking facades.
    if(b.seed>.41&&b.seed<.65&&row%2===1&&col%2===0){
     const l=extrusion(along-width*.72,z-.29,.48),r=extrusion(along+width*.72,z-.29,.48);
     quad(l,r,[r[0],r[1],z-.21],[l[0],l[1],z-.21],rgb.stone);
    }
   }
  }
  // Each capped real roof acquires a slight architectural parapet.
  // Pitched roof only on compact convex real footprints; avoids crossing streets.
  const roofsAllowed=b.convex&&ring.length>=3&&ring.length<=6&&b.area<1050&&h<29;
  const pitched=roofsAllowed&&(
   /gabled|hipped|pyramidal|skillion|mansard/i.test(String(b.roofShape))||
   (b.seed>.78&&b.area<600)
  );
  if(pitched){
   const rise=clamp(b.roofHeight||1.2+hash(b.seed*80)*1.6,1,3);
   for(let i=0;i<ring.length;i++){
    const a=ring[i],c=ring[(i+1)%ring.length];
    tri([a[0],a[1],h+.08],[c[0],c[1],h+.08],[p[0],p[1],h+rise],roofColor);
   }
   roofAccents++;
  }
  // Small rooftop features are decorative, never fabricated buildings.
  if(b.area>120&&b.area<1800&&b.seed>.79&&h<45&&!pitched){
   const cx=p[0]+1.5,cy=p[1]-.4,top=h+1.9;
   const w=.6,d=.7,zz=h+.06;
   const a=[cx-w,cy-d,zz],c=[cx+w,cy-d,zz],e=[cx+w,cy+d,zz],f=[cx-w,cy+d,zz];
   quad(a,c,[c[0],c[1],top],[a[0],a[1],top],rgb.chimney);
   quad(c,e,[e[0],e[1],top],[c[0],c[1],top],rgb.stone);
   quad(e,f,[f[0],f[1],top],[e[0],e[1],top],rgb.chimney);
   roofAccents++;
  }
  if(b.seed>.90&&b.area>80){
   const z=h+.48,cx=p[0],cy=p[1],w=.45;
   // Tiny double-sided roof lantern, stays georeferenced.
   quad([cx-w,cy,z-.5],[cx+w,cy,z-.5],[cx+w,cy,z+.5],[cx-w,cy,z+.5],rgb.gold);
   quad([cx,cy-w,z-.5],[cx,cy+w,z-.5],[cx,cy+w,z+.5],[cx,cy-w,z+.5],rgb.bright);
   roofAccents++;
  }
 }
 return {data:new Float32Array(verts),origin:base,real:modeled,windows,facades,roofAccents,vertices:verts.length/7};
}
export function createArchitecture3D(map,{getSource=()=>null,getSourceLayer=()=> 'building',onStats=()=>{}}={}){
 return {
  id:'vp-architecture-v2',type:'custom',renderingMode:'3d',
  active:true,ready:false,magic:true,focus:null,map,program:null,buffer:null,gl:null,count:0,origin:null,
  onAdd(m,gl){
   this.map=m;this.gl=gl;
   const compile=(type,source)=>{
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error('Architecture shader: '+msg)}
    return s;
   };
   const v=compile(gl.VERTEX_SHADER,vertexShader),f=compile(gl.FRAGMENT_SHADER,fragmentShader);
   const prg=gl.createProgram();gl.attachShader(prg,v);gl.attachShader(prg,f);gl.linkProgram(prg);
   gl.deleteShader(v);gl.deleteShader(f);
   if(!gl.getProgramParameter(prg,gl.LINK_STATUS))throw Error('Architectural shader could not link');
   this.program=prg;this.buffer=gl.createBuffer();
   this.ap=gl.getAttribLocation(prg,'a_position');this.ac=gl.getAttribLocation(prg,'a_color');
   this.um=gl.getUniformLocation(prg,'u_matrix');this.ut=gl.getUniformLocation(prg,'u_seconds');
   this.ug=gl.getUniformLocation(prg,'u_magic');
   const c=m.getCenter();this.focus=[c.lng,c.lat];
  },
  setFocus(coords){
   if(!finite(coords))return;
   if(!this.focus||meters(this.focus,coords)>150){
    this.focus=[...coords];this.ready=false;this.map?.triggerRepaint?.();
   }
  },
  setActive(value){this.active=Boolean(value);this.map?.triggerRepaint?.()},
  setMagic(value){this.magic=Boolean(value);this.map?.triggerRepaint?.()},
  rebuild(){
   const mapped=extractMappedBuildings(this.map,getSource(),getSourceLayer(),this.focus,{
    max:Math.min(90,Math.max(45,Math.round(window.innerWidth<650?70:85))),radius:550
   });
   const shape=buildArchitectureGeometry(mapped,this.focus,{maxVertices:window.innerWidth<650?85000:115000});
   this.origin=shape.origin;this.count=shape.vertices;
   const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   gl.bufferData(gl.ARRAY_BUFFER,shape.data,gl.DYNAMIC_DRAW);
   this.ready=true;onStats(shape);
  },
  render(gl,args){
   if(!this.active||!this.program)return;
   if(!this.ready)try{this.rebuild()}catch(e){this.ready=true;console.warn('3D architecture enhancement unavailable:',e)}
   if(!this.count||!this.origin)return;
   const P=args?.defaultProjectionData?.mainMatrix||args?.modelViewProjectionMatrix;
   if(!P)return;
   // MapLibre owns this WebGL context. Restore every GL state we change:
   // leaking depthMask(true) and disabled culling can hide the real buildings.
   const prev={
    blend:gl.isEnabled(gl.BLEND),depth:gl.isEnabled(gl.DEPTH_TEST),
    cull:gl.isEnabled(gl.CULL_FACE),depthWrite:gl.getParameter(gl.DEPTH_WRITEMASK),
    blendSrcRGB:gl.getParameter(gl.BLEND_SRC_RGB),blendDstRGB:gl.getParameter(gl.BLEND_DST_RGB),
    blendSrcA:gl.getParameter(gl.BLEND_SRC_ALPHA),blendDstA:gl.getParameter(gl.BLEND_DST_ALPHA)
   };
   try{
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.enableVertexAttribArray(this.ap);gl.enableVertexAttribArray(this.ac);
    gl.vertexAttribPointer(this.ap,3,gl.FLOAT,false,28,0);
    gl.vertexAttribPointer(this.ac,4,gl.FLOAT,false,28,12);
    gl.uniformMatrix4fv(this.um,false,composeMatrix(P,this.origin));
    gl.uniform1f(this.ut,performance.now()/1000);
    gl.uniform1f(this.ug,this.magic?1:0);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES,0,this.count);
   }finally{
    gl.depthMask(prev.depthWrite);
    if(prev.depth)gl.enable(gl.DEPTH_TEST);else gl.disable(gl.DEPTH_TEST);
    if(prev.blend)gl.enable(gl.BLEND);else gl.disable(gl.BLEND);
    if(prev.cull)gl.enable(gl.CULL_FACE);else gl.disable(gl.CULL_FACE);
    gl.blendFuncSeparate(prev.blendSrcRGB,prev.blendDstRGB,prev.blendSrcA,prev.blendDstA);
    gl.disableVertexAttribArray(this.ap);gl.disableVertexAttribArray(this.ac);
    gl.bindBuffer(gl.ARRAY_BUFFER,null);
   }
  },
  onRemove(m,gl){
   try{gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program)}catch(e){}
   this.ready=false;this.program=null;this.buffer=null;
  }
 };
}
