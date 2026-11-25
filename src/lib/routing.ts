import { haversineM, bearingBetween, angleDifference, pointToSegment, polylineMetrics, type LonLat } from './geo';
import type { InterstateIndex } from '../data/index';

export type TravelMode = 'driving' | 'walking' | 'cycling';

export interface GeocodeResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  type?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  street?: string;
  housenumber?: string;
  source: 'photon' | 'nominatim' | 'exit' | 'place';
  exitIndex?: number;
  placeIndex?: number;
}

export interface RouteStep {
  distance: number;
  duration: number;
  name: string;
  instruction: string;
  type: string;
  modifier?: string;
  location: LonLat;
}

export interface RouteLeg {
  distance: number;
  duration: number;
  steps: RouteStep[];
}

export interface RouteResult {
  id: string;
  geometry: Array<[number, number]>; // [lat, lon]
  distanceM: number;
  durationS: number;
  legs: RouteLeg[];
  steps: RouteStep[];
  summary?: string;
  source: 'osrm' | 'demo';
}

export interface RouteResponse {
  code: string;
  routes: RouteResult[];
  waypoints: Array<{ location: LonLat; name: string }>;
}

const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM = 'https://router.project-osrm.org/route/v1';

export async function geocode(
  query: string,
  signal?: AbortSignal,
  bias?: { lat: number; lon: number },
): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ q: query, limit: '6', lang: 'en' });
  if (bias) {
    params.set('lat', String(bias.lat));
    params.set('lon', String(bias.lon));
  }
  try {
    const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
    if (res.ok) {
      const data = (await res.json()) as {
        features?: Array<{
          geometry: { coordinates: [number, number] };
          properties: Record<string, unknown>;
        }>;
      };
      const results = (data.features ?? []).map((f, i) => {
        const p = f.properties;
        const parts = [p.name as string, p.street as string, p.housenumber as string, p.city as string, p.state as string, p.country as string].filter(Boolean);
        return {
          id: `photon-${i}-${f.geometry.coordinates[0]},${f.geometry.coordinates[1]}`,
          name: (p.name as string) || (p.street as string) || 'Location',
          displayName: parts.join(', '),
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          type: (p.osm_value as string) || (p.osm_key as string),
          city: p.city as string,
          state: p.state as string,
          country: p.country as string,
          postcode: p.postcode as string,
          street: p.street as string,
          housenumber: p.housenumber as string,
          source: 'photon' as const,
        };
      });
      if (results.length) return results;
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
  }
  // Nominatim fallback.
  const res = await fetch(
    `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`,
    { signal, headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as Array<{
    place_id: number;
    lat: string;
    lon: string;
    display_name: string;
    type?: string;
    address?: Record<string, string>;
  }>;
  return data.map((r) => ({
    id: `nominatim-${r.place_id}`,
    name: r.display_name.split(',')[0],
    displayName: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
    type: r.type,
    city: r.address?.city ?? r.address?.town ?? r.address?.village,
    state: r.address?.state,
    country: r.address?.country,
    postcode: r.address?.postcode,
    street: r.address?.road,
    housenumber: r.address?.house_number,
    source: 'nominatim' as const,
  }));
}

export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<string> {
  const res = await fetch(
    `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
    { signal, headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  const data = (await res.json()) as { display_name?: string; name?: string };
  return data.display_name ?? data.name ?? '';
}

function instructionFor(step: {
  name?: string;
  maneuver?: { type?: string; modifier?: string; exit?: number };
  ref?: string;
  destinations?: string;
}): string {
  const type = step.maneuver?.type ?? '';
  const mod = step.maneuver?.modifier;
  const name = step.name ? ` onto ${step.name}` : '';
  switch (type) {
    case 'depart':
      return mod && mod !== 'straight'
        ? `Head ${mod}${name}`
        : `Head out${name}`;
    case 'arrive':
      return 'Arrive at your destination';
    case 'turn': {
      if (!mod) return `Turn${name}`;
      if (mod === 'straight') return `Continue straight${name}`;
      return `${capitalize(mod)}${name}`;
    }
    case 'merge':
      return `Merge${mod && mod !== 'straight' ? ` ${mod}` : ''}${name}`;
    case 'fork':
      return `Keep ${mod ?? 'straight'}${name}`;
    case 'on ramp':
      return mod && mod !== 'straight' ? `Take the ramp on the ${mod}${name}` : `Take the ramp${name}`;
    case 'off ramp':
      return mod && mod !== 'straight' ? `Take the exit on the ${mod}${name}` : `Take the exit${name}`;
    case 'continue':
      return mod && mod !== 'straight' ? `Continue ${mod}${name}` : `Continue${name}`;
    case 'new name':
      return `Continue${name}`;
    case 'roundabout':
    case 'rotary':
      return `Take the roundabout${name}`;
    case 'exit roundabout':
      return `Exit the roundabout${name}`;
    case 'end of road':
      return `At the end of the road, turn ${mod ?? ''}${name}`;
    default:
      return `${capitalize(type.replace(/_/g, ' '))}${name}`;
  }
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export async function fetchRoute(mode: TravelMode, coords: LonLat[], signal?: AbortSignal): Promise<RouteResponse> {
  const path = coords.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(';');
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    alternatives: 'true',
    annotations: 'true',
    continue_straight: 'false',
  });
  const res = await fetch(`${OSRM}/${mode}/${path}?${params}`, { signal });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = (await res.json()) as {
    code: string;
    routes: Array<{
      geometry: { coordinates: [number, number][] };
      distance: number;
      duration: number;
      legs: Array<{
        distance: number;
        duration: number;
        steps: Array<{
          distance: number;
          duration: number;
          name: string;
          maneuver: { type: string; modifier?: string; location: [number, number] };
        }>;
      }>;
    }>;
    waypoints: Array<{ location: [number, number]; name: string }>;
  };
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found');
  return {
    code: data.code,
    routes: data.routes.map((r, ri) => {
      const legs = r.legs.map((leg) => ({
        distance: leg.distance,
        duration: leg.duration,
        steps: leg.steps.map((s) => ({
          distance: s.distance,
          duration: s.duration,
          name: s.name,
          instruction: instructionFor(s),
          type: s.maneuver.type,
          modifier: s.maneuver.modifier,
          location: s.maneuver.location,
        })),
      }));
      const steps = legs.flatMap((l) => l.steps);
      return {
        id: `route-${ri}`,
        geometry: r.geometry.coordinates.map((c) => [c[1], c[0]] as [number, number]),
        distanceM: r.distance,
        durationS: r.duration,
        legs,
        steps,
        source: 'osrm' as const,
      };
    }),
    waypoints: data.waypoints,
  };
}

export interface RouteExit {
  exitIndex: number;
  alongM: number;
  distanceM: number;
}

/**
 * Find interstate exits along a route. Exits are matched by distance to the
 * route geometry and filtered by carriageway bearing so opposite-direction
 * exits are excluded.
 */
export function matchExitsToRoute(
  index: InterstateIndex,
  coords: Array<[number, number]>,
  thresholdM = 320,
): RouteExit[] {
  if (coords.length < 2) return [];
  const metrics = polylineMetrics(coords);
  const best = new Map<number, { alongM: number; distanceM: number; segment: number }>();
  const dLat = thresholdM / 111_320;

  for (let i = 0; i < coords.length - 1; i++) {
    const [aLat, aLon] = coords[i];
    const [bLat, bLon] = coords[i + 1];
    const segLen = metrics.cumulative[i + 1] - metrics.cumulative[i];
    if (segLen === 0) continue;
    const midLat = (aLat + bLat) / 2;
    const dLon = thresholdM / (111_320 * Math.max(0.1, Math.cos((midLat * Math.PI) / 180)));
    const minLat = Math.min(aLat, bLat) - dLat;
    const maxLat = Math.max(aLat, bLat) + dLat;
    const minLon = Math.min(aLon, bLon) - dLon;
    const maxLon = Math.max(aLon, bLon) + dLon;
    const candidates = index.exitGrid.query(minLat, minLon, maxLat, maxLon);
    if (!candidates.length) continue;
    const routeBearing = bearingBetween(aLat, aLon, bLat, bLon);
    for (const ei of candidates) {
      const e = index.exits[ei];
      const proj = pointToSegment(e.lat, e.lon, aLat, aLon, bLat, bLon);
      if (proj.distanceM > thresholdM) continue;
      const bearings = [e.bearing1, e.bearing2].filter((b): b is number => b !== null);
      if (bearings.length) {
        const minDiff = Math.min(...bearings.map((b) => angleDifference(b, routeBearing)));
        if (minDiff > 80) continue;
      }
      const alongM = metrics.cumulative[i] + proj.t * segLen;
      const prev = best.get(ei);
      if (!prev || proj.distanceM < prev.distanceM) {
        best.set(ei, { alongM, distanceM: proj.distanceM, segment: i });
      }
    }
  }

  const out: RouteExit[] = [];
  for (const [exitIndex, v] of best) out.push({ exitIndex, alongM: v.alongM, distanceM: v.distanceM });
  out.sort((a, b) => a.alongM - b.alongM);
  // Dedupe exits that sit on the same interchange (within 120 m along the route
  // and 80 m of each other), keeping the one closest to the route.
  const deduped: RouteExit[] = [];
  for (const r of out) {
    const e = index.exits[r.exitIndex];
    let duplicate = false;
    for (let k = deduped.length - 1; k >= 0; k--) {
      const d = deduped[k];
      if (r.alongM - d.alongM > 250) break;
      const de = index.exits[d.exitIndex];
      if (e.label === de.label && haversineM(e.lat, e.lon, de.lat, de.lon) < 120) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) deduped.push(r);
  }
  return deduped;
}

export async function loadDemoRoute(): Promise<RouteResult> {
  const res = await fetch('/data/demo-route.json');
  if (!res.ok) throw new Error('Demo route unavailable');
  const data = (await res.json()) as {
    name: string;
    distance_m?: number;
    duration_s?: number;
    coordinates: [number, number][];
    steps: Array<{
      name: string;
      ref?: string;
      distance_m?: number;
      distance?: number;
      duration_s?: number;
      duration?: number;
      maneuver:
        | string
        | {
            type: string;
            modifier?: string;
            location?: [number, number];
          };
      modifier?: string;
      location?: [number, number];
    }>;
  };
  const steps: RouteStep[] = data.steps.map((s) => {
    const type = typeof s.maneuver === 'string' ? s.maneuver : s.maneuver?.type ?? '';
    const modifier = s.modifier ?? (typeof s.maneuver === 'object' ? s.maneuver?.modifier : undefined);
    const location = s.location ?? (typeof s.maneuver === 'object' ? s.maneuver?.location : undefined);
    return {
      distance: s.distance_m ?? s.distance ?? 0,
      duration: s.duration_s ?? s.duration ?? 0,
      name: s.name,
      instruction: instructionFor({ name: s.name, maneuver: { type, modifier } }),
      type,
      modifier,
      location: location ?? [0, 0],
    };
  });
  const distanceM = data.distance_m ?? steps.reduce((a, s) => a + s.distance, 0);
  const durationS = data.duration_s ?? steps.reduce((a, s) => a + s.duration, 0);
  return {
    id: 'demo-miami-manhattan',
    geometry: data.coordinates.map((c) => [c[0], c[1]] as [number, number]),
    distanceM,
    durationS,
    legs: [{ distance: distanceM, duration: durationS, steps }],
    steps,
    summary: data.name,
    source: 'demo',
  };
}

export function buildGpx(name: string, route: RouteResult): string {
  const pts = route.geometry
    .map(([lat, lon]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Interstate Maps" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c);
}
