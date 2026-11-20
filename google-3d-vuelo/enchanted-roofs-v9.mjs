/**
 * Villa Pérez · Tejados encantados v9
 *
 * Art-directed decorative markers in Google's real photogrammetric 3D world.
 * Icons are stylized miniature architecture (doors, dormers, chimneys,
 * observatories, enchanted lanterns). They sit on the photogrammetric MESH,
 * NOT on fake new OSM buildings. The Maps 3D API does not expose roof polygons:
 * geographic positions are approximate, not guaranteed to hit a rooftop.
 *
 * Each tiny SVG is rasterized by Google inside a Marker3DElement template.
 * Maximum 12 architectural ornaments, no CSS animations, no second WebGL.
 */
const DEG=Math.PI/180;
const distance=(a,b)=>{
 const x=(b.lng-a.lng)*111320*Math.cos((a.lat+b.lat)*DEG*.5);
 const y=(b.lat-a.lat)*111320;return Math.hypot(x,y);
};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function alongRoute(points,metres){
 let travel=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],d=distance(a,b);
  if(travel+d>=metres||i===points.length-1){
   const t=clamp((metres-travel)/Math.max(d,.01),0,1);
   const p={lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t};
   const dx=(b.lng-a.lng)*111320*Math.cos(p.lat*DEG);
   const dy=(b.lat-a.lat)*111320,L=Math.max(.001,Math.hypot(dx,dy));
   return {...p,right:[dy/L,-dx/L]};
  }
  travel+=d;
 }
 return null;
}
export function planEnchantedRoofs(points,{max=12}={}){
 const p=(points||[]).filter(q=>Number.isFinite(q?.lat)&&Number.isFinite(q?.lng));
 if(p.length<2)return [];
 let total=0;for(let i=1;i<p.length;i++)total+=distance(p[i-1],p[i]);
 if(total<105)return [];
 const count=Math.min(max,Math.max(5,Math.floor(total/215)));
 const types=['dormer','door','lantern','chimney','observatory','tower'];
 const planned=[];
 for(let i=0;i<count;i++){
  // Alternate sides to avoid a row of identical ornaments on the street.
  const pos=alongRoute(p,total*(i+.55)/(count+1));if(!pos)continue;
  const side=i%2===0?1:-1;
  // Approximately 25–52 metres laterally from the real route: rooftops
  // are LIKELY, but the Maps JS API has no roof-footprint query.
  const lateral=24+(i%4)*8;
  const east=pos.right[0]*lateral*side,north=pos.right[1]*lateral*side;
  const lat=pos.lat+north/111320;
  const lng=pos.lng+east/(111320*Math.max(.2,Math.cos(lat*DEG)));
  const special=i===2||i===Math.floor(count*.7)||i===count-2;
  planned.push({
   lat,lng,altitude:special?3.3:1.8,
   type:special?['observatory','tower','door'][planned.filter(q=>q.special).length%3]:types[i%types.length],
   special,index:i
  });
 }
 return planned;
}
function roofSVG(type,index,special){
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('xmlns',ns);svg.setAttribute('viewBox','0 0 100 115');
 const physical=special?87:65;
 svg.setAttribute('width',String(physical));
 svg.setAttribute('height',String(Math.round(physical*1.15)));
 svg.setAttribute('aria-hidden','true');
 const id='vp-gradient-'+index;
 // Static, local art: no external resources / faces / text in map.
 const defs='<defs>'
  +'<linearGradient id="'+id+'-roof" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b3f2d7"/><stop offset=".5" stop-color="#438da1"/><stop offset="1" stop-color="#274e83"/></linearGradient>'
  +'<linearGradient id="'+id+'-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6bd"/><stop offset=".65" stop-color="#e7ac5a"/><stop offset="1" stop-color="#ac6544"/></linearGradient>'
  +'<radialGradient id="'+id+'-shine"><stop offset="0" stop-color="#fff5bf" stop-opacity=".9"/><stop offset=".45" stop-color="#efb869" stop-opacity=".23"/><stop offset="1" stop-color="#e8aa55" stop-opacity="0"/></radialGradient>'
  +'</defs>';
 const roof='url(#'+id+'-roof)', gold='url(#'+id+'-gold)',shine='url(#'+id+'-shine)';
 const glint=(x,y,r=13)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+shine+'"/><path d="M'+x+' '+(y-5)+' L'+(x+1.4)+' '+(y-1.4)+' L'+(x+5)+' '+y+' L'+(x+1.4)+' '+(y+1.4)+' L'+x+' '+(y+5)+' L'+(x-1.4)+' '+(y+1.4)+' L'+(x-5)+' '+y+' L'+(x-1.4)+' '+(y-1.4)+'Z" fill="#fff3bc"/>';
 const window='<path d="M36 64 Q50 43 64 64 V86 H36Z" fill="#26375b" stroke="#f5ce86" stroke-width="3"/><path d="M40 67 Q50 51 60 67 V82 H40Z" fill="#ffdb7e"/><path d="M50 56 V83 M40 70 H60" stroke="#9d6d53" stroke-width="2"/>';
 let draw='';
 switch(type){
  case 'door':
   draw='<path d="M22 105 V61 Q22 21 50 19 Q78 21 78 61 V105Z" fill="#a895ae" stroke="#d7bda3" stroke-width="3"/>'
    +'<path d="M31 104 V60 Q31 36 50 34 Q69 36 69 60 V104Z" fill="'+roof+'" stroke="#f9c879" stroke-width="4"/>'
    +'<path d="M37 104 V65 Q37 47 50 47 Q63 47 63 65 V104Z" fill="#684e5b" stroke="#e3b67a" stroke-width="3"/>'
    +'<circle cx="57" cy="78" r="2.7" fill="#ffecb8"/><path d="M27 45 Q50 9 73 45" fill="none" stroke="'+gold+'" stroke-width="5"/>'
    +glint(73,23,13);
   break;
  case 'chimney':
   draw='<path d="M29 101 L29 38 L68 38 L68 101Z" fill="#b28686" stroke="#efd0ad" stroke-width="3"/>'
    +'<path d="M24 42 H73 V32 H24Z" fill="'+gold+'" stroke="#ffe2ac" stroke-width="2"/>'
    +'<path d="M34 62 H63 M34 76 H63 M48 43 V98" stroke="#8a5a66" stroke-width="2" opacity=".65"/>'
    +'<path d="M46 29 C27 17 62 14 50 7 M62 32 C76 20 55 9 70 5" fill="none" stroke="#c3dff5" stroke-width="3" stroke-linecap="round" opacity=".74"/>'
    +glint(74,15,12)+glint(22,34,10);
   break;
  case 'lantern':
   draw='<path d="M44 104 V31 M54 104 V31" stroke="'+gold+'" stroke-width="5"/>'
    +'<path d="M29 46 L50 18 L71 46 L63 80 L37 80Z" fill="'+roof+'" stroke="#f7d89f" stroke-width="3"/>'
    +'<path d="M38 48 H62 L59 72 H41Z" fill="#ffe4a0" stroke="#ca8758" stroke-width="2"/>'
    +'<path d="M50 39 V76" stroke="#855e53" stroke-width="2"/>'
    +'<path d="M27 86 Q50 94 73 86" fill="none" stroke="#f1bd74" stroke-width="3"/>'
    +glint(72,28,13);
   break;
  case 'observatory':
   draw='<path d="M20 103 V67 Q22 35 50 34 Q78 35 80 67 V103Z" fill="#7694aa" stroke="#e1c19a" stroke-width="3"/>'
    +'<path d="M22 67 Q26 32 50 23 Q74 32 78 67Z" fill="'+roof+'" stroke="'+gold+'" stroke-width="3"/>'
    +'<path d="M36 70 L64 70 L64 98 L36 98Z" fill="#2e4b71" stroke="#e2c59c" stroke-width="3"/>'
    +'<circle cx="50" cy="84" r="9" fill="#f8d68f"/><path d="M50 23 V9 M43 13 H57" stroke="'+gold+'" stroke-width="3"/>'
    +glint(74,25,14)+glint(19,50,11);
   break;
  case 'tower':
   draw='<path d="M29 102 V40 L39 35 L61 35 L71 40 V102Z" fill="#8a91a7" stroke="#f0c99a" stroke-width="3"/>'
    +'<path d="M20 44 L50 7 L80 44Z" fill="'+roof+'" stroke="#e9bf80" stroke-width="3"/>'
    +'<path d="M35 61 H45 V76 H35Z M55 61 H65 V76 H55Z" fill="#ffe0a3" stroke="#dfae75" stroke-width="2"/>'
    +'<path d="M41 103 V87 Q50 75 59 87 V103Z" fill="#4d5878" stroke="#ecc589" stroke-width="2"/>'
    +'<path d="M50 7 V0" stroke="'+gold+'" stroke-width="3"/>'
    +glint(75,27,15);
   break;
  default:
   draw='<path d="M18 102 V53 L50 19 L82 53 V102Z" fill="#a5a6ae" stroke="#e5caa7" stroke-width="3"/>'
    +'<path d="M12 57 L50 11 L88 57 L78 60 L50 28 L22 60Z" fill="'+roof+'" stroke="#f4d69c" stroke-width="3"/>'
    +'<path d="M27 103 H73 V58 H27Z" fill="#8996a8" stroke="#e3c59c" stroke-width="2"/>'
    +window+'<path d="M18 102 H82" stroke="'+gold+'" stroke-width="4"/>'
    +glint(72,27,12);
 }
 const background='<circle cx="50" cy="66" r="'+(special?49:40)+'" fill="'+shine+'" opacity="'+(special?'.86':'.57')+'"/><ellipse cx="50" cy="106" rx="29" ry="7" fill="#ffca7e" opacity=".18"/>';
 // SVG defs and art are static, the viewBox includes the complete silhouette.
 svg.innerHTML=defs+background+draw;
 return svg;
}
export class EnchantedRoofScene{
 constructor(map,Marker3DElement){
  this.map=map;this.Marker3DElement=Marker3DElement;
  this.markers=[];this.night=true;this.magic=true;this.lastCount=0;
 }
 clear(){
  for(const m of this.markers)try{m.remove()}catch(e){}
  this.markers=[];this.lastCount=0;
 }
 populate(points){
  this.clear();
  if(!this.map||!this.Marker3DElement)return 0;
  const positions=planEnchantedRoofs(points);
  for(const p of positions){
   try{
    const marker=new this.Marker3DElement({
     position:{lat:p.lat,lng:p.lng,altitude:p.altitude},
     altitudeMode:'RELATIVE_TO_MESH',
     drawsWhenOccluded:false,
     sizePreserved:Boolean(p.special),
     zIndex:p.special?12:8
    });
    const template=document.createElement('template');
    template.content.append(roofSVG(p.type,p.index,p.special));
    marker.append(template);
    this.markers.push(marker);
   }catch(e){console.warn('Enchanted rooftop skipped:',e)}
  }
  this.lastCount=this.markers.length;
  this.sync();return this.lastCount;
 }
 sync(){
  const show=this.magic&&this.night;
  for(const m of this.markers){
   try{
    if(show&&!m.isConnected)this.map?.append(m);
    if(!show&&m.isConnected)m.remove();
   }catch(e){console.warn('Enchanted rooftop visibility unavailable:',e)}
  }
 }
 setNight(v){this.night=Boolean(v);this.sync()}
 setMagic(v){this.magic=Boolean(v);this.sync()}
 destroy(){this.clear();this.map=null}
}
