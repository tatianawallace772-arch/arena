import type { LinkRecord } from '../data/parser';

export interface Waypoint {
  label: string;
  lat: number;
  lon: number;
  exitIndex?: number;
  placeIndex?: number;
}

export interface RecentItem {
  type: 'exit' | 'place' | 'location';
  label: string;
  sublabel?: string;
  lat: number;
  lon: number;
  exitIndex?: number;
  placeIndex?: number;
}

export interface SavedItem {
  type: 'exit' | 'place';
  id: string;
  label: string;
  sublabel?: string;
  lat: number;
  lon: number;
  exitIndex?: number;
  placeIndex?: number;
}

export interface PlaceSelection {
  placeIndex: number;
  exitIndex?: number;
  link?: LinkRecord;
}

export function loadRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem('interstate:recent');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function saveRecent(items: RecentItem[]): void {
  try {
    localStorage.setItem('interstate:recent', JSON.stringify(items.slice(0, 6)));
  } catch {
    /* ignore */
  }
}

export function loadSaved(): SavedItem[] {
  try {
    const raw = localStorage.getItem('interstate:saved');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSaved(items: SavedItem[]): void {
  try {
    localStorage.setItem('interstate:saved', JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export type FlatItem =
  | { kind: 'exit'; index: number; exit: import('../data/parser').ExitRecord }
  | { kind: 'place'; index: number; place: import('../data/parser').PlaceRecord }
  | { kind: 'location'; index: number; result: import('./routing').GeocodeResult }
  | { kind: 'recent'; index: number; item: RecentItem };

export type RouteStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RouteState {
  status: RouteStatus;
  routes: import('./routing').RouteResult[];
  selected: number;
  routeExits: import('./routing').RouteExit[];
  error?: string;
  source?: 'osrm' | 'demo';
}
