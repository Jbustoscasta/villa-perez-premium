/** Villa Pérez — standalone nocturnal flight over real geographic coordinates. */
export const START = Object.freeze({name:'Puerta de Alcalá · clínica de prueba', coordinates:[-3.68845,40.42016]});
export const DEMO_END = Object.freeze({name:'Plaza Mayor · destino de prueba', coordinates:[-3.70736,40.41540]});
const R=6371008.8;
export function validLngLat(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;}
export function meters(a,b){if(!validLngLat(a)||!validLngLat(b))throw Error('Coordenadas incorrectas');const rad=Math.PI/180,dLat=(b[1]-a[1])*rad,dLon=(b[0]-a[0])*rad,aa=Math.sin(dLat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(aa)));}
export function pathFromPoints(points){if(!Array.isArray(points)||points.length<2||!points.every(validLngLat))throw Error('La ruta no tiene geometría válida.');const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+meters(points[i-1],points[i]));if(distances.at(-1)<2)throw Error('Las direcciones son demasiado cercanas.');return {points:points.map(x=>x.slice()),distances,length:distances.at(-1)};}
export function along(path,fraction){if(!path||!path.length)throw Error('La ruta no está preparada.');const f=Math.min(1,Math.max(0,Number(fraction)||0));const target=path.length*f;let lo=0,hi=path.distances.length-1;while(lo<hi){let m=Math.floor((lo+hi)/2);if(path.distances[m]<target)lo=m+1;else hi=m;}let i=Math.max(1,lo),start=path.distances[i-1],end=path.distances[i];const t=end>start?(target-start)/(end-start):0;const a=path.points[i-1],b=path.points[i];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
export function heading(path,fraction){let a=along(path,Math.max(0,fraction-.0025)),b=along(path,Math.min(1,fraction+.0025));let lat=(a[1]+b[1])*.5*Math.PI/180;let dx=(b[0]-a[0])*Math.cos(lat),dy=b[1]-a[1];return (Math.atan2(dx,dy)*180/Math.PI+360)%360;}
export function samplePath(path,count=220){const p=[];for(let i=0;i<=count;i++)p.push(along(path,i/count));return p;}
export function shortenForHome(path,metersBefore=180){if(path.length<250)return path;const frac=Math.max(.15,Math.min(.98,1-metersBefore/path.length));const partial=[];for(let i=0;i<path.points.length;i++){if(path.distances[i]<path.length*frac)partial.push(path.points[i]);else break;}partial.push(along(path,frac));return pathFromPoints(partial);}
export function easing(t){const x=Math.min(1,Math.max(0,Number(t)||0));return x*x*(3-2*x);}
export function colorNight(t){const p=Math.min(1,Math.max(0,Number(t)||0));return {zoom:16.3+Math.sin(Math.PI*p*4)*.55,pitch:69+4*Math.sin(p*6.28),scale:.87+.08*Math.sin(p*6.28)};}
export function sanitizePhoton(f){if(f?.geometry?.type!=='Point'||!Array.isArray(f.geometry.coordinates))return null;const [lon,lat]=f.geometry.coordinates.map(Number);if(!validLngLat([lon,lat]))return null;const p=f.properties||{};const label=[p.name,p.street&&p.street!==p.name?p.street:'',p.housenumber,p.city,p.state].filter(Boolean).join(', ');return {coordinates:[lon,lat],label:label||'Lugar seleccionado'};}
export function displayDistance(m){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1).replace('.',',')} km`;}
export const DEMO_APPROX = Object.freeze([
  START.coordinates,[-3.68931,40.41999],[-3.69135,40.41928],[-3.69335,40.41894],[-3.69568,40.4186],[-3.69825,40.4181],[-3.70025,40.41741],[-3.70273,40.41695],[-3.70484,40.41621],DEMO_END.coordinates
]);
