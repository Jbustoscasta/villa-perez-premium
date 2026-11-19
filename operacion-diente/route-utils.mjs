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
/** Svg postcard deliberately avoids home coordinates, addresses and map screenshots. */
export function postcardSvg({clinicName='Tu clínica dental',distanceMeters=0, date=new Date(), points=[]}={}) {
  const shortClinic=escapeXml(String(clinicName).slice(0,60));
  const d= date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  const dateStr=escapeXml(new Intl.DateTimeFormat('es-ES',{dateStyle:'long'}).format(d));
  const dist = escapeXml(formatDistance(distanceMeters));
  let routePath='M 124 832 C 224 720 370 805 475 640 S 660 504 748 385 S 820 235 940 190';
  if (points.length>=2 && points.every(validCoordinate)) {
    const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    if (maxX>minX && maxY>minY) {
      const sx=800/(maxX-minX), sy=610/(maxY-minY), scale=Math.min(sx,sy);
      const offsetX=124+(800-(maxX-minX)*scale)/2, offsetY=172+(610-(maxY-minY)*scale)/2;
      const sampled=points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/160))===0||i===points.length-1);
      routePath=sampled.map((p,i)=>`${i?'L':'M'} ${(offsetX+(p[0]-minX)*scale).toFixed(1)} ${(offsetY+(maxY-p[1])*scale).toFixed(1)}`).join(' ');
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs><linearGradient id="night" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b2936"/><stop offset="1" stop-color="#224b4c"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="9"/></filter></defs><rect width="1080" height="1350" fill="url(#night)"/><rect x="34" y="34" width="1012" height="1282" rx="36" fill="none" stroke="#dcbf7f" stroke-width="6"/><g fill="#dfca8a">${Array.from({length:34},(_,i)=>`<circle cx="${68+(i*79)%944}" cy="${85+(i*137)%1070}" r="${i%4?2:3}" opacity=".65"/>`).join('')}</g><text x="540" y="120" text-anchor="middle" font-family="Georgia,serif" font-size="33" fill="#d9c38c" letter-spacing="4">VILLA PÉREZ</text><text x="540" y="182" text-anchor="middle" font-family="Georgia,serif" font-size="59" font-weight="bold" fill="#fff0c8">¡Misión completada!</text><text x="540" y="246" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" fill="#e8e4cd">El viaje mágico del Ratón Pérez</text><path d="${routePath}" fill="none" stroke="#f2cf75" opacity=".35" stroke-width="31" filter="url(#glow)"/><path d="${routePath}" fill="none" stroke="#f2d791" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 21" stroke-width="10"/><circle cx="124" cy="832" r="23" fill="#f5d98e"/><circle cx="940" cy="190" r="23" fill="#f5d98e"/><rect x="75" y="1000" width="930" height="200" rx="28" fill="#fff0d1"/><text x="540" y="1060" text-anchor="middle" font-family="Georgia,serif" font-size="32" fill="#24464a">Desde ${shortClinic}</text><text x="540" y="1110" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#35515a">hasta tu casa · ${dist}</text><text x="540" y="1156" text-anchor="middle" font-family="Arial,sans-serif" font-size="23" fill="#586363">${dateStr}</text><text x="540" y="1258" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" fill="#dfc995">Un recuerdo de Ilusiono · Sin dirección de casa</text></svg>`;
}