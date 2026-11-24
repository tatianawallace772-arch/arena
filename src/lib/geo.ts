export type LonLat = [number, number];

export function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function toDeg(r: number): number {
  return (r * 180) / Math.PI;
}

export function bearingBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function angleDifference(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
}

/** Distance from point p to segment a-b (all [lat, lon]), in meters. */
export function pointToSegment(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): { distanceM: number; t: number } {
  // Equirectangular approximation is plenty for short segments.
  const k = Math.cos(toRad((aLat + bLat) / 2)) * 111_320;
  const ax = aLon * k;
  const ay = aLat * 111_320;
  const bx = bLon * k;
  const by = bLat * 111_320;
  const px = pLon * k;
  const py = pLat * 111_320;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return { distanceM: Math.hypot(px - qx, py - qy), t };
}

export interface PolylineMetrics {
  cumulative: number[];
  totalM: number;
}

export function polylineMetrics(coords: Array<[number, number]>): PolylineMetrics {
  const cumulative = new Array<number>(coords.length);
  cumulative[0] = 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    cumulative[i] = total;
  }
  return { cumulative, totalM: total };
}

export function metersToMiles(m: number): number {
  return m / 1609.344;
}

export function formatDistance(m: number, units: 'mi' | 'km' = 'mi'): string {
  if (units === 'km') {
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
  }
  const miles = metersToMiles(m);
  if (miles < 0.1) return `${Math.round(m * 3.28084)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function formatDurationShort(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatCoordinate(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}° ${ns}, ${Math.abs(lon).toFixed(5)}° ${ew}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function downloadFile(filename: string, content: string, type = 'application/gpx+xml'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
