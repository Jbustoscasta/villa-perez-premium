/**
 * Villa Pérez: Cinematic WebGL blue hour / night atmosphere.
 * Independent canvas over Google Maps 3D. It does not extract imagery,
 * sample the map frame buffer or relight buildings at geometry level.
 */
const VERT=[
'attribute vec2 a_position;',
'void main(){gl_Position=vec4(a_position,0.,1.);}'
].join('\n');
const FRAG=[
'precision mediump float;',
'uniform vec2 u_resolution;',
'uniform float u_time;',
'uniform float u_night;',
'uniform float u_motion;',
'float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
'float glow(vec2 p,float radius){return exp(-dot(p,p)/max(radius,.00001));}',
'void main(){',
'  vec2 xy=gl_FragCoord.xy/u_resolution;',
'  float t=clamp(u_night,0.,1.);',
'  float sky=smoothstep(.40,.94,xy.y);',
'  float horizon=exp(-pow((xy.y-.47)/.18,2.));',
'  float sunset=exp(-pow((xy.y-.30)/.22,2.));',
'  vec3 navy=vec3(.025,.075,.18);',
'  vec3 mid=vec3(.065,.13,.27);',
'  vec3 lower=vec3(.07,.13,.22);',
'  vec3 air=mix(lower,mid,smoothstep(.1,.55,xy.y));',
'  air=mix(air,navy,sky*.67);',
'  air=mix(air,vec3(.32,.18,.18),horizon*(.25+.12*(1.-t)));',
'  air=mix(air,vec3(.62,.30,.14),sunset*.12*(1.-t));',
'  float vignette=pow(length((xy-.5)*vec2(1.,.9)),1.25);',
'  float alpha=t*(.38+.09*(1.-sky)+vignette*.15);',
'  vec2 grid=vec2(xy.x*45.,xy.y*23.);',
'  vec2 id=floor(grid);',
'  vec2 center=fract(grid)-.5;',
'  float seed=hash21(id+vec2(12.,33.));',
'  float lightsRegion=1.-smoothstep(.22,.52,xy.y);',
'  float lightMask=step(.948,seed)*lightsRegion;',
'  vec2 jitter=vec2(hash21(id+4.12)-.5,hash21(id+8.39)-.5)*.57;',
'  float bokeh=lightMask*glow(center-jitter,.028);',
'  float roadGlimmer=bokeh*(.78+.22*sin(u_time*.7+seed*21.))*t;',
'  air=mix(air,vec3(1.,.68,.33),clamp(roadGlimmer*.84,0.,1.));',
'  alpha=max(alpha,roadGlimmer*.62);',
'  vec2 st=xy*vec2(70.,41.);',
'  vec2 sid=floor(st);',
'  float starN=hash21(sid+15.7);',
'  float star=step(.979,starN)*step(.62,xy.y);',
'  vec2 local=fract(st)-.5;',
'  float point=glow(local-vec2(hash21(sid+2.)-.5,hash21(sid+3.)-.5)*.5,.012);',
'  float sparkle=star*point*(.72+.28*sin(u_time*.42+starN*17.))*smoothstep(.45,.94,t);',
'  air=mix(air,vec3(.87,.94,1.),clamp(sparkle,0.,1.));',
'  alpha=max(alpha,sparkle*.75);',
'  float drift=sin((xy.x*.9+xy.y*.36)*14.+u_time*.065+u_motion*.2);',
'  alpha+=t*.013*drift*horizon;',
'  gl_FragColor=vec4(clamp(air,0.,1.),clamp(alpha,0.,.74));',
'}'
].join('\n');
export class CinemaNight {
 constructor(canvas){
  this.canvas=canvas;this.gl=null;this.program=null;
  this.level=0;this.target=0;this.phase=0;this.raf=0;
  this.last=0;this.lastDraw=0;this.disabled=false;this.resizeBound=this.resize.bind(this);
  this.frameBound=this.frame.bind(this);
  this.contextLost=e=>{e.preventDefault();this.disabled=true;this.stop();this.useFallback()};
  this.contextRestored=()=>{this.disabled=false;this.gl=null;this.program=null;this.init();this.setNight(this.target>.01)};
  canvas.addEventListener('webglcontextlost',this.contextLost);
  canvas.addEventListener('webglcontextrestored',this.contextRestored);
  window.addEventListener('resize',this.resizeBound,{passive:true});
  document.addEventListener('visibilitychange',()=>{
   if(document.hidden)this.stop();
   else if(this.target>.01||this.level>.01)this.run();
  });
 }
 shader(gl,type,src){
  const obj=gl.createShader(type);
  gl.shaderSource(obj,src);gl.compileShader(obj);
  if(!gl.getShaderParameter(obj,gl.COMPILE_STATUS)){
   const log=gl.getShaderInfoLog(obj);gl.deleteShader(obj);
   throw new Error('WebGL shader: '+log);
  }
  return obj;
 }
 init(){
  if(this.disabled)return false;
  if(this.gl&&this.program)return true;
  try{
   const gl=this.canvas.getContext('webgl',{
    alpha:true,depth:false,stencil:false,antialias:false,
    preserveDrawingBuffer:false,premultipliedAlpha:false,powerPreference:'low-power'
   });
   if(!gl)throw Error('WebGL not available');
   const vs=this.shader(gl,gl.VERTEX_SHADER,VERT),fs=this.shader(gl,gl.FRAGMENT_SHADER,FRAG),p=gl.createProgram();
   gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);
   gl.deleteShader(vs);gl.deleteShader(fs);
   if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('WebGL program link');
   this.gl=gl;this.program=p;
   const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   const loc=gl.getAttribLocation(p,'a_position');
   this.pos=loc;this.res=gl.getUniformLocation(p,'u_resolution');
   this.time=gl.getUniformLocation(p,'u_time');
   this.night=gl.getUniformLocation(p,'u_night');
   this.motion=gl.getUniformLocation(p,'u_motion');
   gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   gl.disable(gl.DEPTH_TEST);
   document.documentElement.classList.remove('night-css-fallback');
   this.resize();return true;
  }catch(e){console.warn('Night WebGL fallback:',e);this.disabled=true;this.useFallback();return false}
 }
 useFallback(){
  this.canvas.hidden=true;
  document.documentElement.classList.toggle('night-css-fallback',this.target>.01);
 }
 resize(){
  if(!this.gl)return;
  const dpr=Math.min(window.devicePixelRatio||1,1.25);
  const width=Math.max(1,Math.round(this.canvas.clientWidth*dpr));
  const height=Math.max(1,Math.round(this.canvas.clientHeight*dpr));
  if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height}
  this.gl.viewport(0,0,width,height);
 }
 setNight(on){
  this.target=on?1:0;
  if(this.disabled){this.useFallback();return}
  // Safari reports 0px when the canvas has [hidden]; reveal before sizing.
  this.canvas.hidden=false;
  document.documentElement.classList.remove('night-css-fallback');
  if(!this.gl&&!this.init())return;
  this.resize();this.last=0;this.lastDraw=0;this.run();
 }
 setProgress(v){this.phase=Number.isFinite(v)?Math.max(0,Math.min(1,v)):0}
 run(){if(!this.raf)this.raf=requestAnimationFrame(this.frameBound)}
 stop(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0}
 frame(now){
  this.raf=0;if(document.hidden)return;
  const dt=this.last?Math.min(90,now-this.last):16;
  this.last=now;
  const amount=dt/2500; // perceptible blue-hour transition on mobile
  if(this.target>this.level)this.level=Math.min(this.target,this.level+amount);
  else if(this.target<this.level)this.level=Math.max(this.target,this.level-amount);
  if(this.level<.0001&&this.target===0){this.canvas.hidden=true;return}
  const gl=this.gl;if(!gl||!this.program)return;
  // Keep WebGL atmosphere around 20 FPS while Google Maps 3D renders.
  if(now-this.lastDraw<46){this.raf=requestAnimationFrame(this.frameBound);return}
  this.lastDraw=now;
  gl.useProgram(this.program);
  gl.viewport(0,0,this.canvas.width,this.canvas.height);
  gl.uniform2f(this.res,this.canvas.width,this.canvas.height);
  gl.uniform1f(this.time,now*.001);gl.uniform1f(this.night,this.level);
  gl.uniform1f(this.motion,this.phase);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES,0,6);
  // Animation throttled to 20 fps to share GPU budget with Google 3D on iPhone.
  this.raf=requestAnimationFrame(this.frameBound);
 }
 destroy(){
  this.stop();window.removeEventListener('resize',this.resizeBound);
  this.canvas.removeEventListener('webglcontextlost',this.contextLost);
  this.canvas.removeEventListener('webglcontextrestored',this.contextRestored);
  document.documentElement.classList.remove('night-css-fallback');
 }
}