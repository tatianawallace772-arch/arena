/**
 * Parsers for the compact OpenInterstate-derived datasets bundled with the app.
 *
 * Binary layout is documented in the data pipeline (EAX1/EAC1). All values are
 * little-endian. Coordinates are int32 degrees × 1e7.
 *
 * Data: © OpenStreetMap contributors, exit & place data from OpenInterstate,
 * released under ODbL 1.0. See https://openinterstate.org/
 */

export type Category =
  | 0 // other / unknown
  | 1 // gas
  | 2 // food
  | 3 // lodging
  | 4 // restArea
  | 5 // evCharging
  | 6 // park
  | 7 // dogPark
  | 8 // travelCenter;

export const CATEGORY_LABELS: Record<number, string> = {
  1: 'Gas',
  2: 'Food',
  3: 'Lodging',
  4: 'Rest area',
  5: 'EV charging',
  6: 'Park',
  7: 'Dog park',
  8: 'Travel center',
};

export interface ExitRecord {
  id: number;
  lat: number;
  lon: number;
  label: string;
  name: string;
  highways: string;
  bearing1: number | null;
  bearing2: number | null;
  linkStart: number;
  linkCount: number;
}

export interface LinkRecord {
  placeIndex: number;
  distanceM: number;
  driveM: number | null;
  driveS: number | null;
  rank: number;
  flags: number;
}

export interface PlaceRecord {
  lat: number;
  lon: number;
  name: string;
  brand: string;
  osmId: string;
  category: number;
}

export interface EaxDataset {
  meta: Record<string, unknown>;
  exits: ExitRecord[];
  places: PlaceRecord[];
  links: LinkRecord[];
}

export interface CorridorPart {
  lat: Float64Array;
  lon: Float64Array;
}

export interface Corridor {
  highway: string;
  directionCode: string;
  displayName: string;
  distanceMeters: number;
  durationSeconds: number;
  parts: CorridorPart[];
}

export interface EacDataset {
  meta: Record<string, unknown>;
  corridors: Corridor[];
}

const NONE32 = 0xffffffff;
const NONE16 = 0xffff;
const E7 = 10_000_000;

class Reader {
  private view: DataView;
  private bytes: Uint8Array;
  offset: number;
  private decoder = new TextDecoder('utf-8');

  constructor(private buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.offset = 0;
  }

  u8(): number {
    return this.view.getUint8(this.offset++);
  }
  u16(): number {
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }
  u32(): number {
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }
  i32(): number {
    const v = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return v;
  }
  i64(): number {
    const v = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return Number(v);
  }
  f32(): number {
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }
  slice(count: number): Uint8Array {
    const out = this.bytes.subarray(this.offset, this.offset + count);
    this.offset += count;
    return out;
  }
  text(count: number): string {
    return this.decoder.decode(this.slice(count));
  }
  header(expected: string): Record<string, unknown> {
    const magic = this.text(4);
    if (magic !== expected) throw new Error(`Expected ${expected} dataset, got ${magic}`);
    this.u32(); // version
    const metaLength = this.u32();
    try {
      return JSON.parse(this.text(metaLength)) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

class StringTable {
  private offsets: Uint32Array;
  private blob: Uint8Array;
  private cache: (string | null)[] = [];
  private count: number;
  private decoder = new TextDecoder('utf-8');

  constructor(r: Reader) {
    const count = r.u32();
    const total = r.u32();
    this.count = count;
    const offsets = new Uint32Array(count + 1);
    for (let i = 0; i <= count; i++) offsets[i] = r.u32();
    this.offsets = offsets;
    this.blob = r.slice(total);
  }

  get(index: number): string | null {
    if (index === NONE32 || index >= this.count) return null;
    let s = this.cache[index];
    if (s === undefined) {
      s = this.decoder.decode(this.blob.subarray(this.offsets[index], this.offsets[index + 1]));
      this.cache[index] = s;
    }
    return s;
  }
}

/** Parse an EAX1 exit + place dataset (interstates.eax). */
export function parseEax(buffer: ArrayBuffer): EaxDataset {
  const r = new Reader(buffer);
  const meta = r.header('EAX1');
  const strings = new StringTable(r);

  const exitCount = r.u32();
  const exits: ExitRecord[] = new Array(exitCount);
  for (let i = 0; i < exitCount; i++) {
    const id = r.i64();
    const lat = r.i32() / E7;
    const lon = r.i32() / E7;
    const b1 = r.u16();
    const b2 = r.u16();
    const labelIdx = r.u32();
    const nameIdx = r.u32();
    const hwIdx = r.u32();
    const linkStart = r.u32();
    const linkCount = r.u16();
    r.u16(); // reserved
    exits[i] = {
      id,
      lat,
      lon,
      label: strings.get(labelIdx) ?? '',
      name: strings.get(nameIdx) ?? '',
      highways: strings.get(hwIdx) ?? '',
      bearing1: b1 === NONE16 ? null : b1 / 10,
      bearing2: b2 === NONE16 ? null : b2 / 10,
      linkStart,
      linkCount,
    };
  }

  const placeCount = r.u32();
  const places: PlaceRecord[] = new Array(placeCount);
  for (let i = 0; i < placeCount; i++) {
    const lat = r.i32() / E7;
    const lon = r.i32() / E7;
    const nameIdx = r.u32();
    const brandIdx = r.u32();
    const osmIdx = r.u32();
    const category = r.u8();
    r.offset += 3;
    places[i] = {
      lat,
      lon,
      name: strings.get(nameIdx) ?? '',
      brand: strings.get(brandIdx) ?? '',
      osmId: strings.get(osmIdx) ?? '',
      category,
    };
  }

  const linkCount = r.u32();
  const links: LinkRecord[] = new Array(linkCount);
  for (let i = 0; i < linkCount; i++) {
    const placeIndex = r.u32();
    const distanceM = r.u16();
    const driveM = r.u16();
    const driveS = r.u16();
    const rank = r.u8();
    const flags = r.u8();
    links[i] = {
      placeIndex,
      distanceM,
      driveM: driveM === NONE16 ? null : driveM,
      driveS: driveS === NONE16 ? null : driveS,
      rank,
      flags,
    };
  }

  return { meta, exits, places, links };
}

/** Parse an EAC1 corridor dataset (corridors.eac). */
export function parseEac(buffer: ArrayBuffer): EacDataset {
  const r = new Reader(buffer);
  const meta = r.header('EAC1');
  const strings = new StringTable(r);

  const count = r.u32();
  const corridors: Corridor[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const highwayIdx = r.u32();
    const directionIdx = r.u32();
    const displayIdx = r.u32();
    const distanceMeters = r.f32();
    const durationSeconds = r.f32();
    const partCount = r.u32();
    const parts: CorridorPart[] = new Array(partCount);
    for (let p = 0; p < partCount; p++) {
      const n = r.u32();
      const lat = new Float64Array(n);
      const lon = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        lat[k] = r.i32() / E7;
        lon[k] = r.i32() / E7;
      }
      parts[p] = { lat, lon };
    }
    corridors[i] = {
      highway: strings.get(highwayIdx) ?? '',
      directionCode: strings.get(directionIdx) ?? '',
      displayName: strings.get(displayIdx) ?? '',
      distanceMeters,
      durationSeconds,
      parts,
    };
  }

  return { meta, corridors };
}

export interface RestArea {
  id: string;
  lat: number;
  lon: number;
  kind: 'rest' | 'welcome' | 'plaza' | 'other';
  name: string;
  road: string;
  bearing?: number;
  amenities?: Record<string, boolean>;
  checked?: string;
  via?: string;
}

export interface RestAreasFile {
  meta: Record<string, unknown>;
  items: RestArea[];
}

export interface StationInfo {
  ah?: string;
  h?: string;
  ab?: string;
  at?: boolean;
  rebranded?: string;
  gone?: boolean;
}

export interface StationsFile {
  meta: Record<string, unknown>;
  items: Record<string, StationInfo>;
}

export type DiscoverCategory =
  | 'nationalPark'
  | 'statePark'
  | 'monument'
  | 'museum'
  | 'zoo'
  | 'waterfall'
  | 'other';

export interface DiscoverPlace {
  id: string;
  name: string;
  cat: DiscoverCategory;
  lat: number;
  lon: number;
  sitelinks: number;
  score: number;
  road: string;
  offMeters: number;
  desc?: string;
  wiki?: string;
}

export interface DiscoverFile {
  meta: Record<string, unknown>;
  items: DiscoverPlace[];
}

export interface DemoRoute {
  name: string;
  source: string;
  fetched_at: string;
  distance_m?: number;
  duration_s?: number;
  coordinates: [number, number][];
  segment_durations_s?: number[];
  steps: DemoStep[];
}

export interface DemoStep {
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
}

export async function fetchJson<T>(url: string, onProgress?: (loaded: number, total: number | null) => void): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  if (!res.body || !onProgress) return (await res.json()) as T;
  const reader = res.body.getReader();
  const contentLength = res.headers.get('content-length');
  const total = contentLength ? Number(contentLength) : null;
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }
  const blob = new Blob(chunks as BlobPart[]);
  return (await new Response(blob).json()) as T;
}

export async function fetchBuffer(url: string, onProgress?: (loaded: number, total: number | null) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  if (!res.body || !onProgress) return res.arrayBuffer();
  const reader = res.body.getReader();
  const contentLength = res.headers.get('content-length');
  const total = contentLength ? Number(contentLength) : null;
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out.buffer;
}
