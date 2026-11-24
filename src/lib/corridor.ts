import type { Corridor } from '../data/parser';
import type { InterstateIndex } from '../data/index';
import { angleDifference, bearingBetween, haversineM, pointToSegment, polylineMetrics } from './geo';

export interface CorridorExit {
  exitIndex: number;
  alongM: number;
  distanceM: number;
}

/**
 * Project every interstate exit onto a directional corridor and return them in
 * driving order. Opposite-carriageway exits are removed using the exit's
 * bearing relative to the corridor segment.
 */
export function computeCorridorExits(
  index: InterstateIndex,
  corridor: Corridor,
  thresholdM = 220,
): CorridorExit[] {
  const best = new Map<number, { alongM: number; distanceM: number }>();
  let alongBase = 0;

  for (const part of corridor.parts) {
    if (part.lat.length < 2) continue;
    const coords: Array<[number, number]> = new Array(part.lat.length);
    for (let k = 0; k < part.lat.length; k++) coords[k] = [part.lat[k], part.lon[k]];
    const metrics = polylineMetrics(coords);

    for (let i = 0; i < coords.length - 1; i++) {
      const [aLat, aLon] = coords[i];
      const [bLat, bLon] = coords[i + 1];
      const segLen = metrics.cumulative[i + 1] - metrics.cumulative[i];
      if (segLen === 0) continue;
      const midLat = (aLat + bLat) / 2;
      const dLat = thresholdM / 111_320;
      const dLon = thresholdM / (111_320 * Math.max(0.1, Math.cos((midLat * Math.PI) / 180)));
      const candidates = index.exitGrid.query(
        Math.min(aLat, bLat) - dLat,
        Math.min(aLon, bLon) - dLon,
        Math.max(aLat, bLat) + dLat,
        Math.max(aLon, bLon) + dLon,
      );
      if (!candidates.length) continue;
      const routeBearing = bearingBetween(aLat, aLon, bLat, bLon);
      for (const ei of candidates) {
        const e = index.exits[ei];
        const proj = pointToSegment(e.lat, e.lon, aLat, aLon, bLat, bLon);
        if (proj.distanceM > thresholdM) continue;
        const bearings = [e.bearing1, e.bearing2].filter((b): b is number => b !== null);
        if (bearings.length) {
          const minDiff = Math.min(...bearings.map((b) => angleDifference(b, routeBearing)));
          if (minDiff > 75) continue;
        }
        const alongM = alongBase + metrics.cumulative[i] + proj.t * segLen;
        const prev = best.get(ei);
        if (!prev || proj.distanceM < prev.distanceM) {
          best.set(ei, { alongM, distanceM: proj.distanceM });
        }
      }
    }
    alongBase += metrics.totalM;
  }

  const out: CorridorExit[] = [];
  for (const [exitIndex, v] of best) out.push({ exitIndex, alongM: v.alongM, distanceM: v.distanceM });
  out.sort((a, b) => a.alongM - b.alongM);

  // Remove duplicate interchanges (same label within a short distance).
  const deduped: CorridorExit[] = [];
  for (const r of out) {
    const e = index.exits[r.exitIndex];
    let dup = false;
    for (let k = deduped.length - 1; k >= 0; k--) {
      const d = deduped[k];
      if (r.alongM - d.alongM > 400) break;
      const de = index.exits[d.exitIndex];
      if (e.label === de.label && haversineM(e.lat, e.lon, de.lat, de.lon) < 150) {
        dup = true;
        break;
      }
    }
    if (!dup) deduped.push(r);
  }
  return deduped;
}

export function corridorBounds(corridor: Corridor): { minLat: number; minLon: number; maxLat: number; maxLon: number } | null {
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  for (const part of corridor.parts) {
    for (let i = 0; i < part.lat.length; i++) {
      if (part.lat[i] < minLat) minLat = part.lat[i];
      if (part.lat[i] > maxLat) maxLat = part.lat[i];
      if (part.lon[i] < minLon) minLon = part.lon[i];
      if (part.lon[i] > maxLon) maxLon = part.lon[i];
    }
  }
  if (!Number.isFinite(minLat)) return null;
  return { minLat, minLon, maxLat, maxLon };
}
