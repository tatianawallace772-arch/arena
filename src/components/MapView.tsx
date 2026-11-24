import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import L from 'leaflet';
import type { Corridor, DiscoverPlace, RestArea } from '../data/parser';
import type { InterstateIndex } from '../data/index';
import type { RouteExit, RouteResult } from '../lib/routing';
import { CATEGORY_META } from './Icons';
import type { LayerState, MapStyle, UserLocation } from '../lib/types';

export interface MapViewHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
  fitRoute: (route: RouteResult) => void;
  fitBounds: (bounds: L.LatLngBoundsExpression, options?: L.FitBoundsOptions) => void;
  invalidateSize: () => void;
  getView: () => { lat: number; lon: number; zoom: number };
  zoomIn: () => void;
  zoomOut: () => void;
}

interface MapViewProps {
  index: InterstateIndex | null;
  corridors: Corridor[];
  restAreas: RestArea[];
  discover: DiscoverPlace[];
  selectedExitIndex: number | null;
  selectedPlaceIndex: number | null;
  route: RouteResult | null;
  routeExits: RouteExit[];
  mapStyle: MapStyle;
  layers: LayerState;
  userLocation: UserLocation | null;
  onExitClick: (index: number) => void;
  onPlaceClick: (index: number) => void;
  onMapClick: (lat: number, lon: number) => void;
  onRestAreaClick?: (rest: RestArea) => void;
  onDiscoverClick?: (place: DiscoverPlace) => void;
  pin?: { lat: number; lon: number } | null;
  highlightCorridor?: Corridor | null;
  onMoveEnd?: (center: { lat: number; lon: number }, zoom: number) => void;
}

type Hit =
  | { type: 'exit'; index: number; x: number; y: number; r: number }
  | { type: 'place'; index: number; x: number; y: number; r: number }
  | { type: 'rest'; index: number; x: number; y: number; r: number }
  | { type: 'discover'; index: number; x: number; y: number; r: number };

interface HoverState {
  x: number;
  y: number;
  kind: 'exit' | 'place' | 'rest' | 'discover';
  title: string;
  subtitle: string;
  color?: string;
}

const TILE_ATTRIBUTION = {
  voyager:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  satellite: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  terrain:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM &middot; &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
};

function makeTileLayer(style: MapStyle): L.TileLayer {
  if (style === 'satellite') {
    return L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        maxNativeZoom: 19,
        attribution: TILE_ATTRIBUTION.satellite,
      },
    );
  }
  if (style === 'terrain') {
    return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      maxNativeZoom: 17,
      subdomains: 'abc',
      attribution: TILE_ATTRIBUTION.terrain,
    });
  }
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: TILE_ATTRIBUTION.voyager,
  });
}

function routeMarkerHtml(kind: 'start' | 'end'): string {
  return `<div class="route-marker ${kind}"><div class="route-marker-core"></div></div>`;
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(props, ref) {
  const {
    index,
    corridors,
    restAreas,
    discover,
    selectedExitIndex,
    selectedPlaceIndex,
    route,
    routeExits,
    mapStyle,
    layers,
    userLocation,
    onExitClick,
    onPlaceClick,
    onMapClick,
    onRestAreaClick,
    onDiscoverClick,
    pin,
    highlightCorridor,
    onMoveEnd,
  } = props;

  const shellRef = useRef<HTMLDivElement>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const labelRef = useRef<L.TileLayer | null>(null);
  const corridorRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.LayerGroup | null>(null);
  const locationRef = useRef<L.LayerGroup | null>(null);
  const pinLayerRef = useRef<L.Marker | null>(null);
  const highlightRef = useRef<L.LayerGroup | null>(null);
  const hitsRef = useRef<Hit[]>([]);
  const rafRef = useRef(0);
  const lastFittedRef = useRef<string | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [hover, setHover] = useState<HoverState | null>(null);

  const draw = useCallback(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    const idx = propsRef.current.index;
    if (!map || !canvas) return;
    const p = propsRef.current;
    const size = map.getSize();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(size.x));
    const h = Math.max(1, Math.floor(size.y));
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    hitsRef.current = [];

    const zoom = map.getZoom();
    const bounds = map.getBounds();
    const routeExitSet = new Set<number>(p.routeExits.map((r) => r.exitIndex));

    // Corridor hover is handled by Leaflet tooltips, nothing on canvas.

    // Discover places (notable attractions).
    if (p.layers.showDiscover && zoom >= 7 && p.discover.length) {
      const latPad = ((bounds.getNorth() - bounds.getSouth()) || 1) * 0.1;
      const lonPad = ((bounds.getEast() - bounds.getWest()) || 1) * 0.1;
      const minLat = bounds.getSouth() - latPad;
      const maxLat = bounds.getNorth() + latPad;
      const minLon = bounds.getWest() - lonPad;
      const maxLon = bounds.getEast() + lonPad;
      let drawn = 0;
      for (let i = 0; i < p.discover.length && drawn < 300; i++) {
        const d = p.discover[i];
        if (d.lat < minLat || d.lat > maxLat || d.lon < minLon || d.lon > maxLon) continue;
        const pt = map.latLngToContainerPoint([d.lat, d.lon]);
        if (pt.x < -20 || pt.y < -20 || pt.x > w + 20 || pt.y > h + 20) continue;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#f3e8fd';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#9334e6';
        ctx.stroke();
        ctx.fillStyle = '#9334e6';
        ctx.font = '700 7px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', pt.x, pt.y + 0.5);
        hitsRef.current.push({ type: 'discover', index: i, x: pt.x, y: pt.y, r: 8 });
        drawn++;
      }
    }

    // Rest areas.
    if (p.layers.showRestAreas && zoom >= 8 && p.restAreas.length) {
      const latPad = ((bounds.getNorth() - bounds.getSouth()) || 1) * 0.1;
      const lonPad = ((bounds.getEast() - bounds.getWest()) || 1) * 0.1;
      const minLat = bounds.getSouth() - latPad;
      const maxLat = bounds.getNorth() + latPad;
      const minLon = bounds.getWest() - lonPad;
      const maxLon = bounds.getEast() + lonPad;
      let drawn = 0;
      for (let i = 0; i < p.restAreas.length && drawn < 400; i++) {
        const r = p.restAreas[i];
        if (r.lat < minLat || r.lat > maxLat || r.lon < minLon || r.lon > maxLon) continue;
        const pt = map.latLngToContainerPoint([r.lat, r.lon]);
        if (pt.x < -20 || pt.y < -20 || pt.x > w + 20 || pt.y > h + 20) continue;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - 5);
        ctx.lineTo(pt.x + 5, pt.y);
        ctx.lineTo(pt.x, pt.y + 5);
        ctx.lineTo(pt.x - 5, pt.y);
        ctx.closePath();
        ctx.fillStyle = r.kind === 'welcome' ? '#0b8065' : '#12a5a5';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        hitsRef.current.push({ type: 'rest', index: i, x: pt.x, y: pt.y, r: 8 });
        drawn++;
      }
    }

    if (!idx) return;

    // Places at the selected exit, or a filtered place layer.
    const placeCandidates: Array<{ index: number; category: number; selected?: boolean }> = [];
    if (p.selectedExitIndex !== null) {
      const e = idx.exits[p.selectedExitIndex];
      if (e) {
        for (let k = 0; k < e.linkCount; k++) {
          const link = idx.links[e.linkStart + k];
          if (!link) continue;
          placeCandidates.push({ index: link.placeIndex, category: idx.places[link.placeIndex]?.category ?? 0, selected: true });
        }
      }
    } else if (p.layers.showPlaces || p.layers.categoryFilter !== null) {
      if (zoom >= 10) {
        const latPad = ((bounds.getNorth() - bounds.getSouth()) || 1) * 0.15;
        const lonPad = ((bounds.getEast() - bounds.getWest()) || 1) * 0.15;
        const candidates = idx.placeGrid.query(
          bounds.getSouth() - latPad,
          bounds.getWest() - lonPad,
          bounds.getNorth() + latPad,
          bounds.getEast() + lonPad,
        );
        for (const pi of candidates) {
          const place = idx.places[pi];
          if (!place) continue;
          if (p.layers.categoryFilter !== null && place.category !== p.layers.categoryFilter) continue;
          placeCandidates.push({ index: pi, category: place.category });
          if (placeCandidates.length > 1200) break;
        }
      }
    }

    if (placeCandidates.length) {
      for (const c of placeCandidates) {
        const place = idx.places[c.index];
        if (!place) continue;
        const pt = map.latLngToContainerPoint([place.lat, place.lon]);
        if (pt.x < -20 || pt.y < -20 || pt.x > w + 20 || pt.y > h + 20) continue;
        const meta = CATEGORY_META[c.category] ?? CATEGORY_META[0];
        const selected = p.selectedPlaceIndex === c.index;
        const radius = selected ? 7 : c.selected ? 4.8 : 3.6;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = meta.color;
        ctx.fill();
        ctx.lineWidth = selected ? 2.5 : 1.5;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        if (selected) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        }
        hitsRef.current.push({ type: 'place', index: c.index, x: pt.x, y: pt.y, r: radius + 5 });
      }
    }

    // Exits.
    if (p.layers.showExits && zoom >= 7) {
      const latPad = ((bounds.getNorth() - bounds.getSouth()) || 1) * 0.08;
      const lonPad = ((bounds.getEast() - bounds.getWest()) || 1) * 0.08;
      const candidates = idx.exitGrid.query(
        bounds.getSouth() - latPad,
        bounds.getWest() - lonPad,
        bounds.getNorth() + latPad,
        bounds.getEast() + lonPad,
      );
      const showBadge = zoom >= 14;
      const maxDraw = zoom >= 12 ? 2500 : 7000;
      let drawn = 0;
      for (const ei of candidates) {
        if (drawn >= maxDraw) break;
        const e = idx.exits[ei];
        if (!e) continue;
        const pt = map.latLngToContainerPoint([e.lat, e.lon]);
        if (pt.x < -30 || pt.y < -30 || pt.x > w + 30 || pt.y > h + 30) continue;
        const selected = p.selectedExitIndex === ei;
        const onRoute = routeExitSet.has(ei);
        if (selected) {
          // Teardrop pin.
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y - 9, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#1a73e8';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(pt.x - 5, pt.y - 2);
          ctx.lineTo(pt.x, pt.y + 7);
          ctx.lineTo(pt.x + 5, pt.y - 2);
          ctx.closePath();
          ctx.fillStyle = '#1a73e8';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '800 10px Inter, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(e.label || 'EXIT', pt.x, pt.y - 9);
          ctx.restore();
          hitsRef.current.push({ type: 'exit', index: ei, x: pt.x, y: pt.y - 4, r: 16 });
          drawn++;
          continue;
        }
        if (onRoute) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#1a73e8';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          hitsRef.current.push({ type: 'exit', index: ei, x: pt.x, y: pt.y, r: 10 });
          drawn++;
          continue;
        }
        if (showBadge && e.label) {
          const text = e.label.length > 5 ? e.label.slice(0, 5) : e.label;
          ctx.font = '700 9px Inter, Arial, sans-serif';
          const tw = Math.max(18, ctx.measureText(text).width + 8);
          const bx = pt.x - tw / 2;
          const by = pt.y - 7;
          ctx.beginPath();
          ctx.roundRect(bx, by, tw, 14, 4);
          ctx.fillStyle = 'rgba(255,255,255,.96)';
          ctx.fill();
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = '#1a73e8';
          ctx.stroke();
          ctx.fillStyle = '#1a73e8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, pt.x, pt.y + 0.5);
          hitsRef.current.push({ type: 'exit', index: ei, x: pt.x, y: pt.y, r: 12 });
        } else {
          const radius = zoom >= 11 ? 4.2 : 3.2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#1a73e8';
          ctx.stroke();
          hitsRef.current.push({ type: 'exit', index: ei, x: pt.x, y: pt.y, r: radius + 5 });
        }
        drawn++;
      }
    }
  }, []);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    const el = mapElRef.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 3,
      maxZoom: 19,
      preferCanvas: true,
      zoomSnap: 0.5,
      wheelPxPerZoomLevel: 90,
    }).setView([39.5, -98.35], 4);
    mapRef.current = map;
    map.getContainer().style.background = '#e9e5dc';

    L.control.scale({ imperial: true, metric: false, position: 'bottomleft' }).addTo(map);

    map.on('move zoom resize', scheduleDraw);
    map.on('moveend', () => {
      const c = map.getCenter();
      propsRef.current.onMoveEnd?.({ lat: c.lat, lon: c.lng }, map.getZoom());
    });
    map.on('zoomend', () => {
      updateCorridorStyle();
      scheduleDraw();
    });
    map.on('click', (ev: L.LeafletMouseEvent) => {
      const hit = hitTest(ev.containerPoint.x, ev.containerPoint.y);
      if (hit) {
        handleHit(hit);
        return;
      }
      propsRef.current.onMapClick(ev.latlng.lat, ev.latlng.lng);
    });
    map.on('mousemove', (ev: L.LeafletMouseEvent) => {
      const hit = hitTest(ev.containerPoint.x, ev.containerPoint.y);
      if (hit) {
        map.getContainer().style.cursor = 'pointer';
        const h = describeHit(hit);
        if (h) setHover((prev) => (prev && prev.x === h.x && prev.y === h.y && prev.title === h.title ? prev : h));
      } else {
        map.getContainer().style.cursor = '';
        setHover(null);
      }
    });
    map.on('mouseout', () => {
      map.getContainer().style.cursor = '';
      setHover(null);
    });

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      scheduleDraw();
    });
    ro.observe(el);

    // eslint-disable-next-line consistent-return
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hitTest(x: number, y: number): Hit | null {
    const hits = hitsRef.current;
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (Math.abs(x - h.x) <= h.r + 4 && Math.abs(y - h.y) <= h.r + 4) return h;
    }
    return null;
  }

  function describeHit(hit: Hit): HoverState | null {
    const p = propsRef.current;
    const idx = p.index;
    if (!idx) return null;
    if (hit.type === 'exit') {
      const e = idx.exits[hit.index];
      if (!e) return null;
      return {
        x: hit.x + 14,
        y: hit.y - 12,
        kind: 'exit',
        title: e.label ? `Exit ${e.label}` : 'Interstate exit',
        subtitle: [e.name, e.highways.replace(/;/g, ' / ')].filter(Boolean).join(' · '),
      };
    }
    if (hit.type === 'place') {
      const place = idx.places[hit.index];
      if (!place) return null;
      const meta = CATEGORY_META[place.category] ?? CATEGORY_META[0];
      return {
        x: hit.x + 12,
        y: hit.y - 10,
        kind: 'place',
        title: place.brand || place.name,
        subtitle: meta.label,
        color: meta.color,
      };
    }
    if (hit.type === 'rest') {
      const r = p.restAreas[hit.index];
      if (!r) return null;
      return {
        x: hit.x + 12,
        y: hit.y - 10,
        kind: 'rest',
        title: r.name || 'Rest area',
        subtitle: r.road ? `${r.road} rest area` : 'Rest area',
        color: '#12a5a5',
      };
    }
    const d = p.discover[hit.index];
    if (!d) return null;
    return {
      x: hit.x + 12,
      y: hit.y - 10,
      kind: 'discover',
      title: d.name,
      subtitle: d.desc || 'Notable place',
      color: '#9334e6',
    };
  }

  function handleHit(hit: Hit) {
    const p = propsRef.current;
    if (hit.type === 'exit') p.onExitClick(hit.index);
    else if (hit.type === 'place') p.onPlaceClick(hit.index);
    else if (hit.type === 'rest' && p.onRestAreaClick) p.onRestAreaClick(p.restAreas[hit.index]);
    else if (hit.type === 'discover' && p.onDiscoverClick) p.onDiscoverClick(p.discover[hit.index]);
  }

  // Tiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    if (labelRef.current) map.removeLayer(labelRef.current);
    labelRef.current = null;
    const layer = makeTileLayer(mapStyle).addTo(map);
    tileRef.current = layer;
    if (mapStyle === 'satellite') {
      const labels = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '',
        opacity: 0.9,
      }).addTo(map);
      labelRef.current = labels;
    }
    map.getContainer().style.background = mapStyle === 'satellite' ? '#0d1a26' : '#e9e5dc';
  }, [mapStyle]);

  // Corridors
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (corridorRef.current) {
      map.removeLayer(corridorRef.current);
      corridorRef.current = null;
    }
    if (!corridors.length || !layers.showCorridors) return;
    const renderer = L.canvas({ padding: 0.5, tolerance: 8 });
    const group = L.layerGroup();
    for (const corridor of corridors) {
      for (const part of corridor.parts) {
        if (part.lat.length < 2) continue;
        const latlngs: L.LatLngExpression[] = new Array(part.lat.length);
        for (let k = 0; k < part.lat.length; k++) latlngs[k] = [part.lat[k], part.lon[k]];
        const casing = L.polyline(latlngs, {
          renderer,
          color: '#ffffff',
          weight: 6,
          opacity: 0.9,
          interactive: false,
          bubblingMouseEvents: false,
        });
        const line = L.polyline(latlngs, {
          renderer,
          color: '#1a73e8',
          weight: 3.4,
          opacity: 0.62,
          lineCap: 'round',
          lineJoin: 'round',
          bubblingMouseEvents: false,
        });
        const distMi = (corridor.distanceMeters / 1609.344).toFixed(0);
        line.bindTooltip(
          `<div style="font-weight:650;color:#1f1f1f">${corridor.displayName}</div><div style="color:#5f6368;font-size:11px;margin-top:1px">${distMi} mi · OpenInterstate</div>`,
          { className: 'interstate-tooltip', sticky: true, direction: 'top', opacity: 1 },
        );
        group.addLayer(casing);
        group.addLayer(line);
      }
    }
    corridorRef.current = group.addTo(map);
    updateCorridorStyle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corridors, layers.showCorridors]);

  function updateCorridorStyle() {
    const map = mapRef.current;
    const group = corridorRef.current;
    if (!map || !group) return;
    const zoom = map.getZoom();
    let weight = 3.4;
    let opacity = 0.62;
    if (zoom < 5) {
      weight = 2;
      opacity = 0.35;
    } else if (zoom < 8) {
      weight = 3;
      opacity = 0.5;
    } else if (zoom >= 11) {
      weight = 4.2;
      opacity = 0.72;
    }
    group.eachLayer((layer) => {
      const line = layer as L.Polyline;
      if (line.setStyle) {
        const isCasing = (line.options.color as string) === '#ffffff';
        line.setStyle({ weight: isCasing ? weight + 2.4 : weight, opacity: isCasing ? 0.9 : opacity });
      }
    });
  }

  // Route
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeRef.current) {
      map.removeLayer(routeRef.current);
      routeRef.current = null;
    }
    if (!route) return;
    const group = L.layerGroup();
    const latlngs: L.LatLngExpression[] = route.geometry.map(([lat, lon]) => [lat, lon]);
    group.addLayer(
      L.polyline(latlngs, {
        color: '#ffffff',
        weight: 10,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }),
    );
    group.addLayer(
      L.polyline(latlngs, {
        color: '#1a73e8',
        weight: 6,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }),
    );
    const start = route.geometry[0];
    const end = route.geometry[route.geometry.length - 1];
    if (start) {
      group.addLayer(
        L.marker([start[0], start[1]], {
          icon: L.divIcon({ className: 'route-marker-wrap', html: routeMarkerHtml('start'), iconSize: [22, 22], iconAnchor: [11, 11] }),
          interactive: false,
        }),
      );
    }
    if (end) {
      group.addLayer(
        L.marker([end[0], end[1]], {
          icon: L.divIcon({ className: 'route-marker-wrap', html: routeMarkerHtml('end'), iconSize: [22, 22], iconAnchor: [11, 11] }),
          interactive: false,
        }),
      );
    }
    routeRef.current = group.addTo(map);
    if (lastFittedRef.current !== route.id) {
      lastFittedRef.current = route.id;
      const line = L.polyline(latlngs);
      const bounds = line.getBounds();
      const isMobile = window.innerWidth < 720;
      map.fitBounds(bounds, {
        paddingTopLeft: isMobile ? [24, 120] : [460, 80],
        paddingBottomRight: isMobile ? [24, 220] : [80, 80],
        maxZoom: 15,
        animate: true,
        duration: 0.7,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // User location
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (locationRef.current) {
      map.removeLayer(locationRef.current);
      locationRef.current = null;
    }
    if (!userLocation) return;
    const group = L.layerGroup();
    group.addLayer(
      L.circle([userLocation.lat, userLocation.lon], {
        radius: Math.max(20, Math.min(1200, userLocation.accuracy)),
        color: '#1a73e8',
        weight: 1,
        opacity: 0.25,
        fillColor: '#1a73e8',
        fillOpacity: 0.1,
        interactive: false,
      }),
    );
    group.addLayer(
      L.marker([userLocation.lat, userLocation.lon], {
        icon: L.divIcon({
          className: 'user-marker-wrap',
          html: '<div class="user-pulse"><span></span></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        interactive: false,
      }),
    );
    locationRef.current = group.addTo(map);
  }, [userLocation]);

  useEffect(() => {
    scheduleDraw();
  }, [selectedExitIndex, selectedPlaceIndex, layers, routeExits, restAreas, discover, index, scheduleDraw]);

  // Dropped pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pinLayerRef.current) {
      map.removeLayer(pinLayerRef.current);
      pinLayerRef.current = null;
    }
    if (!pin) return;
    pinLayerRef.current = L.marker([pin.lat, pin.lon], {
      icon: L.divIcon({
        className: 'dropped-pin-wrap',
        html: '<div class="dropped-pin"><span></span></div>',
        iconSize: [30, 38],
        iconAnchor: [15, 36],
      }),
      interactive: false,
    }).addTo(map);
  }, [pin]);

  // Highlighted corridor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (highlightRef.current) {
      map.removeLayer(highlightRef.current);
      highlightRef.current = null;
    }
    if (!highlightCorridor) return;
    const group = L.layerGroup();
    const renderer = L.canvas({ padding: 0.5 });
    for (const part of highlightCorridor.parts) {
      if (part.lat.length < 2) continue;
      const latlngs: L.LatLngExpression[] = new Array(part.lat.length);
      for (let k = 0; k < part.lat.length; k++) latlngs[k] = [part.lat[k], part.lon[k]];
      group.addLayer(
        L.polyline(latlngs, {
          renderer,
          color: '#ffffff',
          weight: 12,
          opacity: 0.95,
          interactive: false,
        }),
      );
      group.addLayer(
        L.polyline(latlngs, {
          renderer,
          color: '#1a73e8',
          weight: 8,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }),
      );
    }
    highlightRef.current = group.addTo(map);
  }, [highlightCorridor]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(lat, lon, zoom) {
        const map = mapRef.current;
        if (!map) return;
        map.flyTo([lat, lon], zoom ?? Math.max(map.getZoom(), 13), { duration: 0.65 });
      },
      fitRoute(r) {
        const map = mapRef.current;
        if (!map) return;
        const line = L.polyline(r.geometry.map(([lat, lon]) => [lat, lon]));
        map.fitBounds(line.getBounds(), { padding: [80, 80], maxZoom: 15 });
      },
      fitBounds(bounds, options) {
        mapRef.current?.fitBounds(bounds, options);
      },
      invalidateSize() {
        mapRef.current?.invalidateSize();
        scheduleDraw();
      },
      getView() {
        const map = mapRef.current;
        const c = map?.getCenter();
        return { lat: c?.lat ?? 39.5, lon: c?.lng ?? -98.35, zoom: map?.getZoom() ?? 4 };
      },
      zoomIn() {
        mapRef.current?.zoomIn(1, { animate: true });
      },
      zoomOut() {
        mapRef.current?.zoomOut(1, { animate: true });
      },
    }),
    [scheduleDraw],
  );

  return (
    <div className="map-shell" ref={shellRef}>
      <div ref={mapElRef} className="map-root" />
      <canvas ref={canvasRef} className="map-canvas" aria-hidden="true" />
      {hover && (
        <div
          className="map-tooltip"
          style={{
            left: Math.min(hover.x, window.innerWidth - 230),
            top: Math.max(10, hover.y),
            borderLeftColor: hover.color ?? '#1a73e8',
          }}
        >
          <div className="map-tooltip-title">{hover.title}</div>
          {hover.subtitle && <div className="map-tooltip-sub">{hover.subtitle}</div>}
        </div>
      )}
    </div>
  );
});

export default MapView;
