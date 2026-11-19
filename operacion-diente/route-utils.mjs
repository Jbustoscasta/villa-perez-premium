/** Route geometry helpers: pure, deterministic and safe to unit-test. Coordinates are [longitude, latitude]. */
export const EARTH_RADIUS_M = 6371008.8;
export function validCoordinate(pair) {
  return Array.isArray(pair) && pair.length >= 2 && pair.slice(0,2).every(Number.isFinite) &&
    pair[0] >= -180 && pair[0] <= 180 && pair[1] >= -90 && pair[1] <= 90;
}
export function haversineMeters(a, b) {
  if (!validCoordinate(a) || !validCoordinate(b)) throw new Error('Coordenadas inválidas');
  const rad = Math.PI / 180;
  const lat1 = a[1] * rad, lat2 = b[1] * rad;
  const dl = (b[1] - a[1]) * rad, dn = (b[0] - a[0]) * rad;
  const h = Math.sin(dl/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dn/2)**2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function createPath(points) {
  if (!Array.isArray(points) || points.length < 2 || !points.every(validCoordinate)) throw new Error('La ruta no contiene puntos válidos');
  const cumulative = [0];
  for (let i=1;i<points.length;i++) cumulative.push(cumulative[i-1]+haversineMeters(points[i-1],points[i]));
  const total = cumulative.at(-1);
  if (!Number.isFinite(total) || total <= 0) throw new Error('La ruta está vacía');
  return { points, cumulative, total };
}
export function pointAt(path, fraction) {
  if (!path || !Number.isFinite(path.total)) throw new Error('Ruta inválida');
  const f = Math.min(1,Math.max(0,Number(fraction)||0));
  const target = f*path.total, c = path.cumulative, pts=path.points;
  if (f === 1) return { coordinate: pts.at(-1), index: pts.length-1, partial:pts.slice(), fraction:f };
  let low=0, high=c.length-1;
  while (low+1 < high) { const mid = (low+high) >> 1; if (c[mid] <= target) low=mid; else high=mid; }
  const seg = c[low+1]-c[low];
  const t=seg>0?(target-c[low])/seg:0;
  const coordinate=[pts[low][0]+(pts[low+1][0]-pts[low][0])*t, pts[low][1]+(pts[low+1][1]-pts[low][1])*t];
  return { coordinate, index:low, partial:[...pts.slice(0,low+1),coordinate], fraction:f };
}
export function compactAddress(place) {
  const p = place?.properties || {};
  const parts = [p.name, p.housenumber, p.street, p.postcode, p.city||p.town||p.village||p.county, p.state].filter(Boolean);
  return [...new Set(parts.map(String))].join(', ').slice(0,180);
}
export function formatDistance(meters) {
  return Number.isFinite(meters) ? (meters < 1000 ? `${Math.round(meters)} m` : `${(meters/1000).toLocaleString('es-ES',{maximumFractionDigits:1})} km`) : '—';
}
export function escapeXml(input) {
  return String(input ?? '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}
/** Points on the ACTUAL walked route behind the current position, to render magical sparks on the map. */
export function trailParticles(path, progress, count=13, spacing=.0035) {
  if (!path?.points || !Number.isFinite(path.total) || path.total <= 0) return {type:'FeatureCollection',features:[]};
  const fraction = Math.min(1,Math.max(0,Number(progress)||0));
  const features=[];
  for(let i=0;i<count;i++) {
    const f = fraction - i*spacing;
    if (f < 0 || (fraction===0 && i===0)) continue;
    features.push({type:'Feature',properties:{size:Math.max(2,7-i*.34),alpha:Math.max(.12,.95-i*.058)},geometry:{type:'Point',coordinates:pointAt(path,f).coordinate}});
  }
  return {type:'FeatureCollection',features};
}
/** Compass bearing following the route's true geometry; bearing is for map camera only. */
export function routeBearing(path,progress) {
  if(!path?.points)return 0;
  const f=Math.max(0,Math.min(1,Number(progress)||0));
  const a=pointAt(path,Math.max(0,f-.002)).coordinate;
  const b=pointAt(path,Math.min(1,f+.002)).coordinate;
  const lat=(a[1]+b[1])/2*Math.PI/180;
  const dx=(b[0]-a[0])*Math.cos(lat),dy=b[1]-a[1];
  return Math.atan2(dx,dy)*180/Math.PI;
}

/** Storyboarding curve: natural departures, scenic pause, and slow arrival. Monotone and deterministic. */
export function cinematicProgress(phase) {
  const x=Math.max(0,Math.min(1,Number(phase)||0));
  const stops=[[0,0],[.11,.05],[.28,.29],[.42,.47],[.56,.54],[.77,.86],[.9,.96],[1,1]];
  for(let i=1;i<stops.length;i++){
    const [t1,p1]=stops[i],[t0,p0]=stops[i-1];
    if(x<=t1) {
      const u=(x-t0)/(t1-t0);
      const ease=u*u*(3-2*u);
      return p0+(p1-p0)*ease;
    }
  }
  return 1;
}
/** Inverse of cinematicProgress for exact resume/pause, duration changes and playback. */
export function cinematicPhase(progress) {
  const target=Math.max(0,Math.min(1,Number(progress)||0));
  if(target===0||target===1)return target;
  let lo=0,hi=1;
  for(let i=0;i<35;i++){const mid=(lo+hi)/2;if(cinematicProgress(mid)<target)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
/** Keep the genuine road geometry until near home, but never display the final private street/portal. */
export function publicFacingRoute(path,{demo=false,concealMeters=160}={}) {
  if(!path?.points||!path.total)throw Error('Ruta no válida');
  if(demo)return path;
  const remaining=Math.max(60,Math.min(concealMeters,path.total*.65));
  const endF=Math.max(.15,Math.min(.97,1-remaining/path.total));
  return createPath(pointAt(path,endF).partial);
}
/** A public landmark is named only when the ACTUAL route crosses near it. */
export function nearestPublicLandmark(path,landmarks,maxMeters=130) {
  if(!path?.points || !Array.isArray(landmarks))return null;
  let winner=null;
  for(const candidate of landmarks){
    if(!validCoordinate(candidate.coordinate))continue;
    for(let i=1;i<path.points.length-1;i++){
      const fraction=path.cumulative[i]/path.total;
      if(fraction<.18||fraction>.8)continue;
      const d=haversineMeters(path.points[i],candidate.coordinate);
      if(d<=maxMeters && (!winner||d<winner.distanceMeters))
        winner={...candidate,distanceMeters:d,progress:fraction};
    }
  }
  return winner;
}

/** SVG postcard uses a NON-GEOGRAPHIC, generic fantasy path: never embed home street geometry. */
export function postcardSvg({clinicName='Tu clínica dental',distanceMeters=0, date=new Date(), points=[]}={}) {
  const shortClinic=escapeXml(String(clinicName).slice(0,60));
  const d= date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  const dateStr=escapeXml(new Intl.DateTimeFormat('es-ES',{dateStyle:'long'}).format(d));
  const dist = escapeXml(formatDistance(distanceMeters));
  // Never project actual route geometry into a shareable souvenir. Reveals home area even without labels.
  const routePath='M 124 832 C 246 690 325 866 452 674 S 658 538 758 429 S 823 262 940 190';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs><linearGradient id="night" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b2936"/><stop offset="1" stop-color="#224b4c"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="9"/></filter></defs><rect width="1080" height="1350" fill="url(#night)"/><rect x="34" y="34" width="1012" height="1282" rx="36" fill="none" stroke="#dcbf7f" stroke-width="6"/><g fill="#dfca8a">${Array.from({length:34},(_,i)=>`<circle cx="${68+(i*79)%944}" cy="${85+(i*137)%1070}" r="${i%4?2:3}" opacity=".65"/>`).join('')}</g><text x="540" y="120" text-anchor="middle" font-family="Georgia,serif" font-size="33" fill="#d9c38c" letter-spacing="4">VILLA PÉREZ</text><text x="540" y="182" text-anchor="middle" font-family="Georgia,serif" font-size="59" font-weight="bold" fill="#fff0c8">¡Misión completada!</text><text x="540" y="246" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" fill="#e8e4cd">El viaje mágico del Ratón Pérez</text><path d="${routePath}" fill="none" stroke="#f2cf75" opacity=".35" stroke-width="31" filter="url(#glow)"/><path d="${routePath}" fill="none" stroke="#f2d791" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 21" stroke-width="10"/><circle cx="124" cy="832" r="23" fill="#f5d98e"/><circle cx="940" cy="190" r="23" fill="#f5d98e"/><rect x="75" y="1000" width="930" height="200" rx="28" fill="#fff0d1"/><text x="540" y="1060" text-anchor="middle" font-family="Georgia,serif" font-size="32" fill="#24464a">Desde ${shortClinic}</text><text x="540" y="1110" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#35515a">hasta tu casa · ${dist}</text><text x="540" y="1156" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" fill="#586363">${dateStr}</text><text x="540" y="1258" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" fill="#dfc995">Un recuerdo de Ilusiono · Sin dirección de casa</text></svg>`;
}