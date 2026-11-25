import {
  CATEGORY_LABELS,
  type EaxDataset,
  type ExitRecord,
  type LinkRecord,
  type PlaceRecord,
} from './parser';

export const EARTH_RADIUS_M = 6_371_000;

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Uniform lat/lon grid for fast viewport and nearest queries. */
export class SpatialGrid {
  private cells = new Map<string, number[]>();

  constructor(public cellSize: number) {}

  private key(lat: number, lon: number): string {
    return `${Math.floor(lat / this.cellSize)},${Math.floor(lon / this.cellSize)}`;
  }

  insert(lat: number, lon: number, index: number): void {
    const k = this.key(lat, lon);
    let arr = this.cells.get(k);
    if (!arr) {
      arr = [];
      this.cells.set(k, arr);
    }
    arr.push(index);
  }

  query(minLat: number, minLon: number, maxLat: number, maxLon: number): number[] {
    const out: number[] = [];
    const y0 = Math.floor(minLat / this.cellSize);
    const y1 = Math.floor(maxLat / this.cellSize);
    const x0 = Math.floor(minLon / this.cellSize);
    const x1 = Math.floor(maxLon / this.cellSize);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const arr = this.cells.get(`${y},${x}`);
        if (arr) for (const i of arr) out.push(i);
      }
    }
    return out;
  }

  /** Return indexes of points within radiusM of (lat, lon), sorted by distance. */
  nearest(
    lat: number,
    lon: number,
    getLat: (i: number) => number,
    getLon: (i: number) => number,
    radiusM: number,
    limit: number,
  ): Array<{ index: number; distanceM: number }> {
    const dLat = radiusM / 111_320;
    const dLon = radiusM / (111_320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    const candidates = this.query(lat - dLat, lon - dLon, lat + dLat, lon + dLon);
    const out: Array<{ index: number; distanceM: number }> = [];
    for (const i of candidates) {
      const d = haversineM(lat, lon, getLat(i), getLon(i));
      if (d <= radiusM) out.push({ index: i, distanceM: d });
    }
    out.sort((a, b) => a.distanceM - b.distanceM);
    return out.length > limit ? out.slice(0, limit) : out;
  }
}

export interface ExitSearchHit {
  index: number;
  exit: ExitRecord;
  score: number;
}

export interface PlaceSearchHit {
  index: number;
  place: PlaceRecord;
  score: number;
}

function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function highwayTokens(highways: string): string[] {
  return highways
    .split(';')
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean);
}

/** Normalize user highway input ("i95", "I 95", "interstate 95") to "i-95". */
export function normalizeHighway(input: string): string {
  const s = normalizeQuery(input).replace(/^interstate\s*/, 'i-').replace(/^i\s*/, 'i-').replace(/\s+/g, '');
  return s;
}

export function primaryHighway(highways: string): string {
  return highways.split(';').map((h) => h.trim()).filter(Boolean)[0] ?? '';
}

export function highwayList(highways: string): string[] {
  return highways
    .split(';')
    .map((h) => h.trim())
    .filter(Boolean);
}

export function formatExitLabel(label: string, fallback = ''): string {
  if (!label) return fallback || 'Exit';
  return label;
}

export class InterstateIndex {
  readonly exits: ExitRecord[];
  readonly places: PlaceRecord[];
  readonly links: LinkRecord[];
  readonly exitGrid: SpatialGrid;
  readonly placeGrid: SpatialGrid;
  readonly exitSearch: string[];
  readonly placeSearch: string[];
  readonly placeToExits: number[][];
  readonly categoryCount: Record<number, number>;

  constructor(data: EaxDataset) {
    this.exits = data.exits;
    this.places = data.places;
    this.links = data.links;
    this.exitGrid = new SpatialGrid(0.05);
    this.placeGrid = new SpatialGrid(0.02);
    this.exitSearch = new Array(this.exits.length);
    this.placeSearch = new Array(this.places.length);
    this.placeToExits = new Array(this.places.length);
    this.categoryCount = {};

    for (let i = 0; i < this.exits.length; i++) {
      const e = this.exits[i];
      this.exitGrid.insert(e.lat, e.lon, i);
      this.exitSearch[i] = `${e.label} ${e.name} ${e.highways} exit ${e.highways.replace(/;/g, ' ')}`.toLowerCase();
    }
    for (let i = 0; i < this.places.length; i++) {
      const p = this.places[i];
      this.placeGrid.insert(p.lat, p.lon, i);
      this.placeSearch[i] = `${p.name} ${p.brand} ${CATEGORY_LABELS[p.category] ?? ''}`.toLowerCase();
      this.categoryCount[p.category] = (this.categoryCount[p.category] ?? 0) + 1;
      this.placeToExits[i] = [];
    }
    for (let i = 0; i < this.exits.length; i++) {
      const e = this.exits[i];
      for (let k = 0; k < e.linkCount; k++) {
        const link = this.links[e.linkStart + k];
        if (link) this.placeToExits[link.placeIndex]?.push(i);
      }
    }
  }

  exitLinks(exitIndex: number): LinkRecord[] {
    const e = this.exits[exitIndex];
    if (!e) return [];
    return this.links.slice(e.linkStart, e.linkStart + e.linkCount);
  }

  /** Places at an exit, grouped by category, with drive times resolved. */
  placesAtExit(exitIndex: number, limitPerCategory = 4): Map<number, Array<{ place: PlaceRecord; link: LinkRecord }>> {
    const groups = new Map<number, Array<{ place: PlaceRecord; link: LinkRecord }>>();
    for (const link of this.exitLinks(exitIndex)) {
      const place = this.places[link.placeIndex];
      if (!place) continue;
      let arr = groups.get(place.category);
      if (!arr) {
        arr = [];
        groups.set(place.category, arr);
      }
      arr.push({ place, link });
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        const da = a.link.driveS ?? a.link.distanceM / 10;
        const db = b.link.driveS ?? b.link.distanceM / 10;
        return da - db || a.link.rank - b.link.rank;
      });
      if (arr.length > limitPerCategory) arr.length = limitPerCategory;
    }
    return groups;
  }

  /** Category summary counts for an exit. */
  exitCategoryCounts(exitIndex: number): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const link of this.exitLinks(exitIndex)) {
      const p = this.places[link.placeIndex];
      if (p) counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    return counts;
  }

  nearestExits(lat: number, lon: number, radiusM = 30_000, limit = 12): Array<{ index: number; distanceM: number; exit: ExitRecord }> {
    return this.exitGrid
      .nearest(lat, lon, (i) => this.exits[i].lat, (i) => this.exits[i].lon, radiusM, limit)
      .map((r) => ({ ...r, exit: this.exits[r.index] }));
  }

  nearbyPlaces(
    lat: number,
    lon: number,
    radiusM = 5_000,
    limit = 24,
    category?: number,
  ): Array<{ index: number; distanceM: number; place: PlaceRecord }> {
    const out: Array<{ index: number; distanceM: number; place: PlaceRecord }> = [];
    // Query in expanding rings until the limit is met or the radius is exhausted.
    let radius = Math.min(radiusM, 800);
    while (radius <= radiusM) {
      const hits = this.placeGrid.nearest(lat, lon, (i) => this.places[i].lat, (i) => this.places[i].lon, radius, 200);
      for (const h of hits) {
        if (category !== undefined && this.places[h.index].category !== category) continue;
        if (!out.some((o) => o.index === h.index)) out.push({ ...h, place: this.places[h.index] });
      }
      out.sort((a, b) => a.distanceM - b.distanceM);
      if (out.length >= limit) break;
      radius *= 2;
    }
    return out.slice(0, limit);
  }

  /** Find the nearest exit to a place, returning its index and link if linked. */
  nearestExitForPlace(placeIndex: number): { exitIndex: number; link: LinkRecord } | null {
    const exits = this.placeToExits[placeIndex];
    if (!exits || exits.length === 0) return null;
    const place = this.places[placeIndex];
    let best: { exitIndex: number; link: LinkRecord } | null = null;
    let bestDist = Infinity;
    for (const ei of exits) {
      const e = this.exits[ei];
      const link = this.links.slice(e.linkStart, e.linkStart + e.linkCount).find((l) => l.placeIndex === placeIndex);
      if (!link) continue;
      const d = haversineM(place.lat, place.lon, e.lat, e.lon);
      if (d < bestDist) {
        bestDist = d;
        best = { exitIndex: ei, link };
      }
    }
    return best;
  }

  searchExits(query: string, limit = 10): ExitSearchHit[] {
    const q = normalizeQuery(query);
    if (!q) return [];
    const highwayMatch = q.match(/\bi-?\s*(\d{1,3}[a-z]?)\b/i);
    const highway = highwayMatch ? `i-${highwayMatch[1]}` : null;
    const exitMatch = q.match(/\bexit\s*(\d{1,3}[a-z]?)\b/i) ?? q.match(/^\s*(\d{1,3}[a-z]?)\s*$/i);
    const exitLabel = exitMatch ? exitMatch[1] : null;
    const hits: ExitSearchHit[] = [];
    for (let i = 0; i < this.exits.length; i++) {
      const e = this.exits[i];
      const label = e.label.toLowerCase();
      const onHighway = highway ? highwayTokens(e.highways).some((h) => h === highway) : false;
      const labelMatch = exitLabel ? label === exitLabel : false;
      let score = 0;
      if (highway && exitLabel) {
        if (onHighway && labelMatch) score = 220;
        else if (onHighway && label.startsWith(exitLabel)) score = 120;
        else if (onHighway && e.name.toLowerCase().includes(q)) score = 60;
      } else if (highway) {
        if (onHighway) score = 100;
        else if (e.name.toLowerCase().includes(q)) score = 30;
      } else if (exitLabel) {
        if (labelMatch) score = 180;
        else if (label.startsWith(exitLabel)) score = 120;
      } else {
        if (label && label === q) score = 130;
        else if (label && label.startsWith(q)) score = 85;
        else if (e.name.toLowerCase().includes(q)) score = 55;
        else if (this.exitSearch[i].includes(q)) score = 20;
      }
      if (score > 0) hits.push({ index: i, exit: e, score });
    }
    hits.sort(
      (a, b) =>
        b.score - a.score ||
        a.exit.label.localeCompare(b.exit.label, undefined, { numeric: true }) ||
        primaryHighway(a.exit.highways).localeCompare(primaryHighway(b.exit.highways)),
    );
    // Collapse duplicate physical exits (opposite carriageways / ramp aliases).
    const deduped: ExitSearchHit[] = [];
    for (const h of hits) {
      const dup = deduped.find(
        (d) =>
          d.exit.label === h.exit.label &&
          d.exit.name === h.exit.name &&
          Math.abs(d.exit.lat - h.exit.lat) < 0.002 &&
          Math.abs(d.exit.lon - h.exit.lon) < 0.002,
      );
      if (!dup) deduped.push(h);
      if (deduped.length >= limit) break;
    }
    return deduped;
  }

  searchPlaces(query: string, limit = 10, category?: number): PlaceSearchHit[] {
    const q = normalizeQuery(query);
    if (!q) return [];
    const hits: PlaceSearchHit[] = [];
    for (let i = 0; i < this.places.length; i++) {
      const p = this.places[i];
      if (category !== undefined && p.category !== category) continue;
      let score = 0;
      if (p.name.toLowerCase() === q || p.brand.toLowerCase() === q) score = 120;
      else if (p.name.toLowerCase().startsWith(q) || p.brand.toLowerCase().startsWith(q)) score = 90;
      else if (p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)) score = 60;
      else if ((CATEGORY_LABELS[p.category] ?? '').toLowerCase().includes(q)) score = 35;
      else if (this.placeSearch[i].includes(q)) score = 20;
      if (score > 0) hits.push({ index: i, place: p, score });
    }
    hits.sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name));
    return hits.slice(0, limit);
  }
}
