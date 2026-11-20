/**
 * Villa Pérez | City of Dreams
 * Real OSM building footprints gain pitched/hipped roofs and lit windows.
 * Never invents architecture: lighting sits on actual mapped building footprints.
 * Renders in MapLibre's existing WebGL context (NO second renderer).
 */
const DEG=Math.PI/180,EARTH=40075016.6856;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=(a,b=0)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x)};
const mCoord=(lon,lat)=>({x:(lon+180)/360,y:(1-Math.log(Math.tan(lat*DEG)+1/Math.cos(lat*DEG))/Math.PI)/2,scale:1/(EARTH*Math.max(.1,Math.cos(lat*DEG)))});
const meters=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos((a[1]+b[1])*.5*DEG),(a[1]-b[1])*111320);
const vShader=[
 'attribute vec3 a_position;','attribute vec4 a_color;','uniform mat4 u_matrix;',
 'uniform float u_day;','varying vec4 v_color;',
 'void main(){gl_Position=u_matrix*vec4(a_position,1.);',
 'v_color=vec4(mix(a_color.rgb,a_color.rgb*vec3(1.12,1.1,1.06),u_day*.28),a_color.a);}'
].join('\n');
const fShader=['precision mediump float;','varying vec4 v_color;','uniform float u_time;', 'void main(){float pulse=0.89+0.11*sin(u_time*0.70+v_color.a*31.0);gl_FragColor=vec4(v_color.rgb*pulse,0.92);}'].join('\n');
const roofColors=[[.12,.28,.31,1],[.47,.17,.21,1],[.42,.26,.19,1],[.25,.28,.43,1],[.48,.32,.25,1]];
const wallColors=[[.30,.34,.41,1],[.43,.35,.32,1],[.29,.39,.39,1],[.38,.32,.39,1]];
const lit=[.98,.74,.35,1],bright=[1,.90,.63,1],windowDark=[.08,.15,.22,1];
function getBuildings(map,src,focus){
 if(!src||!map.querySourceFeatures)return[];
 let features=[];try{features=map.querySourceFeatures(src,{sourceLayer:'building'})||[]}catch(e){}
 const found=[],seen=new Set();
 for(const f of features){
  if(found.length>=120)break;
  const geo=f.geometry;
  const raw=geo?.type==='Polygon'?geo.coordinates?.[0]:geo?.type==='MultiPolygon'?geo.coordinates?.[0]?.[0]:null;
  if(!raw||raw.length<4)continue;
  let ring=raw.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])).slice(0,28);
  if(ring.length>=4&&meters(ring[0],ring[ring.length-1])<.01)ring.pop();
  if(ring.length<3)continue;
  const center=ring.reduce((a,p)=>[a[0]+p[0]/ring.length,a[1]+p[1]/ring.length],[0,0]);
  if(meters(center,focus)>680)continue;
  const key=Math.round(center[0]*1e5)+':'+Math.round(center[1]*1e5);
  if(seen.has(key))continue;seen.add(key);
  const h=Number(f.properties?.render_height||f.properties?.height)||17;
  found.push({center,ring,height:clamp(h,10,70),seed:hash(+key.split(':')[0],+key.split(':')[1]),fictitious:false});
 }
 return found;
}
function projectionMatrix(P,o,scale){
 const M=[scale,0,0,0,0,-scale,0,0,0,0,scale,0,o.x,o.y,0,1];
 const A=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++){
  let v=0;for(let k=0;k<4;k++)v+=P[k*4+r]*M[c*4+k];
  A[c*4+r]=v;
 }
 return A;
}
function buildGeometry(map,focus,route,source,day){
 const center=mCoord(...focus),scale=center.scale,vertices=[];
 const loc=(p,h=0)=>{const z=mCoord(...p);return[(z.x-center.x)/scale,(center.y-z.y)/scale,h]};
 const tri=(a,b,c,color)=>{for(const v of [a,b,c])vertices.push(...v,...color)};
 const quad=(a,b,c,d,color)=>{tri(a,b,c,color);tri(a,c,d,color)};
 const shade=(color,f)=>[color[0]*f,color[1]*f,color[2]*f,1];
 const mapped=getBuildings(map,source,focus);
 for(const b of mapped){
  const points=b.ring.map(p=>loc(p)),p=loc(b.center);
  const roofColor=roofColors[Math.floor(b.seed*roofColors.length)%roofColors.length];
  const h=b.height;
  // Actual OSM building extrusions remain the only walls.
  // Original roof shape and PNOA photo stay untouched.
  // Warm lit windows project from the building faces (not a screen filter).
  for(let i=0;i<Math.min(10,points.length);i++){
   const a=points[i],q=points[(i+1)%points.length];
   const dx=q[0]-a[0],dy=q[1]-a[1],len=Math.hypot(dx,dy);
   if(len<8)continue;
   const dir=[dx/len,dy/len],mid=[(a[0]+q[0])/2,(a[1]+q[1])/2];
   let norm=[-dir[1],dir[0]];
   if((mid[0]-p[0])*norm[0]+(mid[1]-p[1])*norm[1]<0)norm=norm.map(v=>-v);
   const cols=Math.min(5,Math.floor(len/4.5)),rows=Math.min(5,Math.floor((h-2)/4));
   for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const litSeed=hash(col*3+row*7+i*13,b.seed*99);
    if(litSeed<.47)continue;
    const along=(col+1)/(cols+1)*len,ww=.95;
    const x=a[0]+dir[0]*along+norm[0]*.7,y=a[1]+dir[1]*along+norm[1]*.7;
    const z=2.2+row*4;
    if(z+1.8>h)continue;
    const v=[x-dir[0]*ww/2,y-dir[1]*ww/2,z],
      u=[x+dir[0]*ww/2,y+dir[1]*ww/2,z];
    const rgb=day?[.39,.58,.67]:litSeed>.83?bright:lit;
    const color=[rgb[0],rgb[1],rgb[2],litSeed];
    quad(v,u,[u[0],u[1],z+1.75],[v[0],v[1],z+1.75],color);
    // Window muntin adds architectural detail at close range.
    if(litSeed>.91){
     const mx=x,my=y,off=.042;
     quad([mx-dir[0]*off,my-dir[1]*off,z],[mx+dir[0]*off,my+dir[1]*off,z],
      [mx+dir[0]*off,my+dir[1]*off,z+1.75],
      [mx-dir[0]*off,my-dir[1]*off,z+1.75],windowDark);
    }
   }
  }

 }
 return {data:new Float32Array(vertices),origin:center,real:mapped.length,fantasy:0};
}
export function createCinemaCity(map,{getRoute=()=>[],getSource=()=>null,onStats=()=>{}}={}){
 const obj={
  id:'vp-cinema-city',type:'custom',renderingMode:'3d',
  active:true,day:false,ready:false,frame:null,map,gl:null,buffer:null,program:null,count:0,focus:null,origin:null,
  onAdd(m,gl){
   this.map=m;this.gl=gl;
   const shader=(type,src)=>{
    const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'3D shader error');
    return s;
   };
   const v=shader(gl.VERTEX_SHADER,vShader),f=shader(gl.FRAGMENT_SHADER,fShader);
   const program=gl.createProgram();
   gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
   gl.deleteShader(v);gl.deleteShader(f);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('City shader link failure');
   this.program=program;this.buffer=gl.createBuffer();
   this.ap=gl.getAttribLocation(program,'a_position');
   this.ac=gl.getAttribLocation(program,'a_color');
   this.um=gl.getUniformLocation(program,'u_matrix');
   this.ud=gl.getUniformLocation(program,'u_day');
   this.ut=gl.getUniformLocation(program,'u_time');
   const c=m.getCenter();this.focus=[c.lng,c.lat];
   this.ready=false;
  },
  setFocus(coords){
   if(!coords||coords.length!==2)return;
   if(!this.focus||meters(this.focus,coords)>230){
    this.focus=[...coords];this.ready=false;this.map?.triggerRepaint?.();
   }
  },
  setDay(day){this.day=!!day;this.ready=false;this.map?.triggerRepaint?.()},
  setActive(active){this.active=!!active;this.map?.triggerRepaint?.()},
  rebuild(){
   const geometry=buildGeometry(this.map,this.focus,getRoute(),getSource(),this.day);
   this.origin=geometry.origin;
   this.count=geometry.data.length/7;
   this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer);
   this.gl.bufferData(this.gl.ARRAY_BUFFER,geometry.data,this.gl.DYNAMIC_DRAW);
   this.ready=true;
   onStats({real:geometry.real,fantasy:geometry.fantasy,vertices:this.count});
  },
  render(gl,args){
   if(!this.active||!this.program)return;
   if(!this.ready)try{this.rebuild()}catch(e){console.warn('3D enhancement unavailable:',e);this.ready=true}
   if(!this.count||!this.origin)return;
   const P=args?.defaultProjectionData?.mainMatrix;
   if(!P)return;
   gl.useProgram(this.program);
   gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   gl.enableVertexAttribArray(this.ap);
   gl.enableVertexAttribArray(this.ac);
   gl.vertexAttribPointer(this.ap,3,gl.FLOAT,false,28,0);
   gl.vertexAttribPointer(this.ac,4,gl.FLOAT,false,28,12);
   gl.uniformMatrix4fv(this.um,false,projectionMatrix(P,this.origin,this.origin.scale));
   gl.uniform1f(this.ud,this.day?1:0);
   gl.uniform1f(this.ut,performance.now()/1000);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   gl.enable(gl.DEPTH_TEST);
   gl.depthMask(false);
   gl.disable(gl.CULL_FACE);
   gl.drawArrays(gl.TRIANGLES,0,this.count);
   gl.depthMask(true);
   gl.disableVertexAttribArray(this.ap);
   gl.disableVertexAttribArray(this.ac);
   gl.bindBuffer(gl.ARRAY_BUFFER,null);
  },
  onRemove(m,gl){
   try{gl?.deleteBuffer(this.buffer);gl?.deleteProgram(this.program)}catch(e){}
   this.program=null;this.buffer=null;this.gl=null;this.ready=false;
  }
 };
 return obj;
}
