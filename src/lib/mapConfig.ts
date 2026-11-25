import type { MapStyle } from './types';

// CARTO basemap keys are public client-side credentials. Restrict allowed origins
// in the CARTO dashboard rather than treating this value as a server secret.
export const CARTO_API_KEY = (import.meta.env.VITE_CARTO_API_KEY ?? '').trim();
export const HAS_CARTO_API_KEY = CARTO_API_KEY.length > 0;
export const DEFAULT_MAP_STYLE: MapStyle = 'openstreetmap';
