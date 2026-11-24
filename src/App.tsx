import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Info, Shield as ShieldIcon } from 'lucide-react';
import MapView, { type MapViewHandle } from './components/MapView';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import ExitCard from './components/ExitCard';
import PlaceCard from './components/PlaceCard';
import LocationCard from './components/LocationCard';
import DirectionsPanel from './components/DirectionsPanel';
import DriveMode from './components/DriveMode';
import MapControls from './components/MapControls';
import LoadingScreen from './components/LoadingScreen';
import AboutModal from './components/AboutModal';
import Toast from './components/Toast';
import { CATEGORY_META } from './components/Icons';
import {
  parseEax,
  parseEac,
  fetchBuffer,
  fetchJson,
  type Corridor,
  type DiscoverFile,
  type DiscoverPlace,
  type LinkRecord,
  type RestArea,
  type RestAreasFile,
  type StationInfo,
  type StationsFile,
} from './data/parser';
import {
  InterstateIndex,
  type ExitSearchHit,
  type PlaceSearchHit,
} from './data/index';
import { corridorBounds } from './lib/corridor';
import { buildGpx, fetchRoute, geocode, loadDemoRoute, matchExitsToRoute, reverseGeocode, type GeocodeResult, type TravelMode } from './lib/routing';
import { formatCoordinate, downloadFile } from './lib/geo';
import type { LayerState, MapStyle, UserLocation } from './lib/types';
import {
  loadRecent,
  loadSaved,
  persistSaved,
  saveRecent,
  type FlatItem,
  type RecentItem,
  type RouteState,
  type SavedItem,
  type Waypoint,
} from './lib/ui';

type PanelMode = 'home' | 'exit' | 'place' | 'location' | 'directions';

interface SearchState {
  exits: ExitSearchHit[];
  places: PlaceSearchHit[];
  locations: GeocodeResult[];
}

const IDLE_ROUTE: RouteState = { status: 'idle', routes: [], selected: 0, routeExits: [] };

export default function App() {
  // ---------- Data ----------
  const [dataStatus, setDataStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [index, setIndex] = useState<InterstateIndex | null>(null);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [restAreas, setRestAreas] = useState<RestArea[]>([]);
  const [stations, setStations] = useState<Map<string, StationInfo>>(new Map());
  const [discover, setDiscover] = useState<DiscoverPlace[]>([]);

  // ---------- Map ----------
  const mapRef = useRef<MapViewHandle>(null);
  const mapCenterRef = useRef<{ lat: number; lon: number } | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('voyager');
  const [layers, setLayers] = useState<LayerState>({
    showCorridors: true,
    showExits: true,
    showPlaces: false,
    showRestAreas: false,
    showDiscover: false,
    categoryFilter: null,
  });
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);

  // ---------- UI ----------
  const [mode, setMode] = useState<PanelMode>('home');
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({ exits: [], places: [], locations: [] });
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<RecentItem[]>(() => loadRecent());
  const [saved, setSaved] = useState<SavedItem[]>(() => loadSaved());
  const [toast, setToast] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const [selectedExitIndex, setSelectedExitIndex] = useState<number | null>(null);
  const [selectedPlaceIndex, setSelectedPlaceIndex] = useState<number | null>(null);
  const [selectedLink, setSelectedLink] = useState<LinkRecord | undefined>(undefined);
  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(null);
  const [pinAddress, setPinAddress] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // ---------- Directions ----------
  const [startPoint, setStartPoint] = useState<Waypoint | null>(null);
  const [endPoint, setEndPoint] = useState<Waypoint | null>(null);
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [routeState, setRouteState] = useState<RouteState>(IDLE_ROUTE);
  const lastRouteKeyRef = useRef<string | null>(null);
  const skipAutoRouteRef = useRef(false);

  // ---------- Drive mode ----------
  const [driveOpen, setDriveOpen] = useState(false);
  const [highlightCorridor, setHighlightCorridor] = useState<Corridor | null>(null);

  const showToast = useCallback((message: string) => setToast(message), []);

  // ---------- Load datasets ----------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDataStatus('loading');
      setLoadError(null);
      setProgress(0);
      try {
        const eaxBuf = await fetchBuffer('/data/interstates.eax', (loaded, total) => {
          if (cancelled) return;
          setProgress(0.62 * Math.min(1, loaded / (total ?? 11_600_000)));
        });
        if (cancelled) return;
        setProgress(0.7);
        await new Promise((r) => setTimeout(r, 25));
        const eax = parseEax(eaxBuf);
        if (cancelled) return;
        setProgress(0.76);
        const [eacBuf, restFile, stationsFile, discoverFile] = await Promise.all([
          fetchBuffer('/data/corridors.eac', (loaded, total) => {
            if (cancelled) return;
            setProgress(0.76 + 0.12 * Math.min(1, loaded / (total ?? 2_400_000)));
          }),
          fetchJson<RestAreasFile>('/data/restareas.json'),
          fetchJson<StationsFile>('/data/stations.json'),
          fetchJson<DiscoverFile>('/data/discover.json'),
        ]);
        if (cancelled) return;
        setProgress(0.92);
        await new Promise((r) => setTimeout(r, 20));
        const eac = parseEac(eacBuf);
        const idx = new InterstateIndex(eax);
        if (cancelled) return;
        setIndex(idx);
        setCorridors(eac.corridors);
        setRestAreas(restFile.items);
        setStations(new Map(Object.entries(stationsFile.items)));
        setDiscover(discoverFile.items);
        setProgress(1);
        setDataStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError((err as Error).message || 'The interstate data could not be loaded.');
        setDataStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  // ---------- Recent / saved ----------
  const addRecent = useCallback((item: RecentItem) => {
    setRecent((prev) => {
      const deduped = prev.filter(
        (x) => !(x.type === item.type && x.label === item.label && Math.abs(x.lat - item.lat) < 0.001),
      );
      const next = [item, ...deduped].slice(0, 6);
      saveRecent(next);
      return next;
    });
  }, []);

  const isSaved = (id: string) => saved.some((s) => s.id === id);

  const toggleSave = () => {
    if (selectedExitIndex !== null) {
      const e = index!.exits[selectedExitIndex];
      const id = `exit:${e.id}`;
      if (isSaved(id)) {
        const next = saved.filter((s) => s.id !== id);
        setSaved(next);
        persistSaved(next);
        showToast('Removed from saved');
      } else {
        const item: SavedItem = {
          type: 'exit',
          id,
          label: e.label ? `Exit ${e.label}` : 'Interstate exit',
          sublabel: e.highways,
          lat: e.lat,
          lon: e.lon,
          exitIndex: selectedExitIndex,
        };
        const next = [item, ...saved];
        setSaved(next);
        persistSaved(next);
        showToast('Exit saved');
      }
    } else if (selectedPlaceIndex !== null) {
      const p = index!.places[selectedPlaceIndex];
      const id = `place:${p.osmId}`;
      if (isSaved(id)) {
        const next = saved.filter((s) => s.id !== id);
        setSaved(next);
        persistSaved(next);
        showToast('Removed from saved');
      } else {
        const item: SavedItem = {
          type: 'place',
          id,
          label: p.brand || p.name,
          sublabel: CATEGORY_META[p.category]?.label,
          lat: p.lat,
          lon: p.lon,
          placeIndex: selectedPlaceIndex,
        };
        const next = [item, ...saved];
        setSaved(next);
        persistSaved(next);
        showToast('Place saved');
      }
    }
  };

  // ---------- Selection ----------
  const openExit = useCallback(
    (i: number, remember = true) => {
      const e = index?.exits[i];
      if (!e) return;
      setSelectedExitIndex(i);
      setSelectedPlaceIndex(null);
      setSelectedLink(undefined);
      setPin(null);
      setMode('exit');
      setSearchFocused(false);
      setQuery('');
      mapRef.current?.flyTo(e.lat, e.lon, 15);
      if (remember) {
        addRecent({
          type: 'exit',
          label: e.label ? `Exit ${e.label}` : 'Interstate exit',
          sublabel: `${e.highways.split(';')[0]}${e.name ? ` · ${e.name}` : ''}`,
          lat: e.lat,
          lon: e.lon,
          exitIndex: i,
        });
      }
    },
    [index, addRecent],
  );

  const openPlace = useCallback(
    (placeIndex: number, exitIndex?: number, link?: LinkRecord, remember = true) => {
      const p = index?.places[placeIndex];
      if (!p) return;
      let ei = exitIndex;
      let lk = link;
      if (ei === undefined) {
        const nearest = index?.nearestExitForPlace(placeIndex);
        if (nearest) {
          ei = nearest.exitIndex;
          lk = nearest.link;
        }
      }
      setSelectedPlaceIndex(placeIndex);
      setSelectedExitIndex(ei ?? null);
      setSelectedLink(lk);
      setPin(null);
      setMode('place');
      setSearchFocused(false);
      setQuery('');
      mapRef.current?.flyTo(p.lat, p.lon, 16);
      if (remember) {
        const exit = ei !== undefined ? index?.exits[ei] : null;
        addRecent({
          type: 'place',
          label: p.brand || p.name,
          sublabel: `${CATEGORY_META[p.category]?.label ?? 'Place'}${exit?.label ? ` · Exit ${exit.label}` : ''}`,
          lat: p.lat,
          lon: p.lon,
          placeIndex,
        });
      }
    },
    [index, addRecent],
  );

  const openLocation = useCallback(
    (lat: number, lon: number, name?: string, fly = true) => {
      setPin({ lat, lon });
      setPinAddress(name ?? '');
      setPinLoading(!name);
      setSelectedExitIndex(null);
      setSelectedPlaceIndex(null);
      setMode('location');
      setSearchFocused(false);
      setQuery('');
      if (fly) mapRef.current?.flyTo(lat, lon, 16);
      if (name) {
        addRecent({ type: 'location', label: name, lat, lon });
      }
    },
    [addRecent],
  );

  const handleMapClick = useCallback((lat: number, lon: number) => {
    setPin({ lat, lon });
    setPinAddress('');
    setPinLoading(true);
    setSelectedExitIndex(null);
    setSelectedPlaceIndex(null);
    setMode('location');
    setSearchFocused(false);
    setQuery('');
  }, []);

  // Reverse geocode dropped pins.
  useEffect(() => {
    if (!pin || !pinLoading) return;
    const ctrl = new AbortController();
    reverseGeocode(pin.lat, pin.lon, ctrl.signal)
      .then((addr) => {
        setPinAddress(addr);
        setPinLoading(false);
      })
      .catch(() => setPinLoading(false));
    return () => ctrl.abort();
  }, [pin, pinLoading]);

  // ---------- Search ----------
  useEffect(() => {
    if (!index) return;
    const q = query.trim();
    if (!q) {
      setSearchState({ exits: [], places: [], locations: [] });
      setSearching(false);
      setHasSearched(false);
      setActiveIndex(0);
      return;
    }
    const exits = index.searchExits(q, 5);
    const places = index.searchPlaces(q, 5);
    setSearchState({ exits, places, locations: [] });
    setActiveIndex(0);
    const shouldGeocode = q.length >= 3 && !/(^|\s)exit(\s|$)/i.test(q) && !/^i-?\d/i.test(q);
    if (!shouldGeocode) {
      setSearching(false);
      setHasSearched(true);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const geo = await geocode(q, ctrl.signal, mapCenterRef.current ?? undefined);
        if (!ctrl.signal.aborted) {
          setSearchState((prev) => ({ ...prev, locations: geo }));
        }
      } catch {
        /* geocoding is best effort */
      } finally {
        if (!ctrl.signal.aborted) {
          setSearching(false);
          setHasSearched(true);
        }
      }
    }, 300);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [query, index]);

  const flatItems = useMemo<FlatItem[]>(() => {
    if (!query.trim()) {
      return recent.map((item, i) => ({ kind: 'recent' as const, index: i, item }));
    }
    const exitItems: FlatItem[] = searchState.exits.map((h) => ({ kind: 'exit', index: h.index, exit: h.exit }));
    const placeItems: FlatItem[] = searchState.places.map((h) => ({ kind: 'place', index: h.index, place: h.place }));
    const locationItems: FlatItem[] = searchState.locations.map((r, i) => ({ kind: 'location', index: i, result: r }));
    const q = query.trim().toLowerCase();
    const exitMax = searchState.exits.reduce((m, h) => Math.max(m, h.score), 0);
    const placeMax = searchState.places.reduce((m, h) => Math.max(m, h.score), 0);
    const locationMax = searchState.locations.reduce((m, r) => {
      const name = r.name.toLowerCase();
      return Math.max(m, name === q ? 110 : name.startsWith(q) ? 90 : 60);
    }, 0);
    const groups: Array<{ items: FlatItem[]; score: number }> = [
      { items: exitItems, score: exitMax },
      { items: placeItems, score: placeMax },
      { items: locationItems, score: locationMax },
    ].filter((g) => g.items.length > 0);
    groups.sort((a, b) => b.score - a.score);
    return groups.flatMap((g) => g.items);
  }, [query, searchState, recent]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const selectFlat = (item: FlatItem) => {
    if (item.kind === 'exit') openExit(item.index);
    else if (item.kind === 'place') openPlace(item.index);
    else if (item.kind === 'location') openLocation(item.result.lat, item.result.lon, item.result.name);
    else {
      const r = item.item;
      if (r.type === 'exit' && r.exitIndex !== undefined) openExit(r.exitIndex, false);
      else if (r.type === 'place' && r.placeIndex !== undefined) openPlace(r.placeIndex, undefined, undefined, false);
      else openLocation(r.lat, r.lon, r.label, true);
    }
  };

  useEffect(() => {
    if (!searchFocused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(flatItems.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && flatItems[activeIndex]) {
        e.preventDefault();
        selectFlat(flatItems[activeIndex]);
      } else if (e.key === 'Escape') {
        setSearchFocused(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFocused, flatItems, activeIndex]);

  const submitSearch = () => {
    if (flatItems[activeIndex]) {
      selectFlat(flatItems[activeIndex]);
    } else if (searchState.locations[0]) {
      const r = searchState.locations[0];
      openLocation(r.lat, r.lon, r.name);
    } else if (searchState.exits[0]) {
      openExit(searchState.exits[0].index);
    } else if (searchState.places[0]) {
      openPlace(searchState.places[0].index);
    } else if (query.trim()) {
      showToast(`No results for “${query.trim()}”`);
    }
  };

  // ---------- Directions ----------
  const waypointFromExit = (i: number): Waypoint | null => {
    const e = index?.exits[i];
    if (!e) return null;
    return {
      label: `Exit ${e.label || ''} · ${e.highways.split(';')[0]}`.replace('Exit  ·', 'Interstate exit ·'),
      lat: e.lat,
      lon: e.lon,
      exitIndex: i,
    };
  };

  const openDirections = useCallback((from?: Waypoint, to?: Waypoint) => {
    setMode('directions');
    setSearchFocused(false);
    setQuery('');
    if (from) {
      setStartPoint(from);
      setStartText(from.label);
    }
    if (to) {
      setEndPoint(to);
      setEndText(to.label);
    }
    if (from || to) {
      setRouteState((s) => ({ ...s, status: 'idle', routes: [], routeExits: [], error: undefined }));
      lastRouteKeyRef.current = null;
    }
  }, []);

  const computeRoute = useCallback(
    async (start: Waypoint, end: Waypoint, modeValue: TravelMode) => {
      const key = `${start.lat.toFixed(5)},${start.lon.toFixed(5)}|${end.lat.toFixed(5)},${end.lon.toFixed(5)}|${modeValue}`;
      if (lastRouteKeyRef.current === key) return;
      lastRouteKeyRef.current = key;
      setRouteState({ status: 'loading', routes: [], selected: 0, routeExits: [] });
      try {
        const res = await fetchRoute(modeValue, [
          [start.lon, start.lat],
          [end.lon, end.lat],
        ]);
        const route = res.routes[0];
        const exits = modeValue === 'driving' && index ? matchExitsToRoute(index, route.geometry) : [];
        setRouteState({ status: 'ready', routes: res.routes, selected: 0, routeExits: exits, source: 'osrm' });
      } catch (err) {
        setRouteState({
          status: 'error',
          routes: [],
          selected: 0,
          routeExits: [],
          error: (err as Error).message || 'Routing is unavailable right now.',
        });
      }
    },
    [index],
  );

  useEffect(() => {
    if (skipAutoRouteRef.current) {
      skipAutoRouteRef.current = false;
      return;
    }
    if (!startPoint || !endPoint) {
      lastRouteKeyRef.current = null;
      setRouteState((s) => (s.status === 'idle' ? s : { ...IDLE_ROUTE }));
      return;
    }
    computeRoute(startPoint, endPoint, travelMode);
  }, [startPoint, endPoint, travelMode, computeRoute]);

  const handleSelectRoute = (i: number) => {
    setRouteState((prev) => {
      const r = prev.routes[i];
      const exits = r && index && travelMode === 'driving' ? matchExitsToRoute(index, r.geometry) : [];
      return { ...prev, selected: i, routeExits: exits };
    });
  };

  const handleSwap = () => {
    setStartPoint(endPoint);
    setEndPoint(startPoint);
    setStartText(endText);
    setEndText(startText);
  };

  const handleDemo = useCallback(async () => {
    if (!index) return;
    skipAutoRouteRef.current = true;
    setStartPoint({ label: 'Miami, FL', lat: 25.7617, lon: -80.1918 });
    setEndPoint({ label: 'Manhattan, New York', lat: 40.7831, lon: -73.9712 });
    setStartText('Miami, FL');
    setEndText('Manhattan, New York');
    setRouteState({ status: 'loading', routes: [], selected: 0, routeExits: [] });
    try {
      const demo = await loadDemoRoute();
      const exits = matchExitsToRoute(index, demo.geometry);
      setRouteState({ status: 'ready', routes: [demo], selected: 0, routeExits: exits, source: 'demo' });
      lastRouteKeyRef.current = 'demo';
    } catch (err) {
      setRouteState({
        status: 'error',
        routes: [],
        selected: 0,
        routeExits: [],
        error: (err as Error).message || 'The demo route is unavailable.',
      });
    }
  }, [index]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setUserLocation(loc);
        setLocating(false);
        const wp: Waypoint = { label: 'My location', lat: loc.lat, lon: loc.lon };
        setStartPoint(wp);
        setStartText('My location');
        mapRef.current?.flyTo(loc.lat, loc.lon, 14);
      },
      () => {
        setLocating(false);
        showToast('Could not get your location. Check your browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setUserLocation(loc);
        setLocating(false);
        mapRef.current?.flyTo(loc.lat, loc.lon, 15);
      },
      () => {
        setLocating(false);
        showToast('Could not get your location. Check your browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const handleDownloadGpx = () => {
    const route = routeState.routes[routeState.selected];
    if (!route) return;
    const gpx = buildGpx('Interstate route', route);
    downloadFile('interstate-route.gpx', gpx);
    showToast('GPX downloaded');
  };

  // ---------- Drive mode ----------
  const handleCorridorFocus = useCallback((corridor: Corridor) => {
    setHighlightCorridor(corridor);
    const b = corridorBounds(corridor);
    if (b) {
      mapRef.current?.fitBounds(
        [
          [b.minLat, b.minLon],
          [b.maxLat, b.maxLon],
        ],
        { padding: [90, 90], maxZoom: 9, animate: true, duration: 0.8 },
      );
    }
  }, []);

  const handleExitGuide = () => {
    setDriveOpen(true);
    setSearchFocused(false);
    setQuery('');
    setMode('home');
  };

  // ---------- Share ----------
  const handleShare = async () => {
    const params = new URLSearchParams();
    if (selectedExitIndex !== null && index) {
      const e = index.exits[selectedExitIndex];
      params.set('exit', String(e.id));
      params.set('lat', e.lat.toFixed(5));
      params.set('lon', e.lon.toFixed(5));
      params.set('zoom', '15');
    } else if (selectedPlaceIndex !== null && index) {
      const p = index.places[selectedPlaceIndex];
      params.set('place', p.osmId);
      params.set('lat', p.lat.toFixed(5));
      params.set('lon', p.lon.toFixed(5));
      params.set('zoom', '16');
    } else if (pin) {
      params.set('lat', pin.lat.toFixed(5));
      params.set('lon', pin.lon.toFixed(5));
      params.set('zoom', '16');
    } else {
      const view = mapRef.current?.getView();
      if (view) {
        params.set('lat', view.lat.toFixed(5));
        params.set('lon', view.lon.toFixed(5));
        params.set('zoom', String(view.zoom));
      }
    }
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard');
    } catch {
      showToast('Copy this link: ' + url);
    }
  };

  // ---------- Deep links ----------
  useEffect(() => {
    if (dataStatus !== 'ready' || !index) return;
    const params = new URLSearchParams(window.location.search);
    const exitId = params.get('exit');
    const placeId = params.get('place');
    if (exitId) {
      const i = index.exits.findIndex((e) => String(e.id) === exitId);
      if (i >= 0) {
        openExit(i, false);
        return;
      }
    }
    if (placeId) {
      const i = index.places.findIndex((p) => p.osmId === placeId);
      if (i >= 0) {
        openPlace(i, undefined, undefined, false);
        return;
      }
    }
    const lat = params.get('lat');
    const lon = params.get('lon');
    const zoom = params.get('zoom');
    if (lat && lon) {
      mapRef.current?.flyTo(Number(lat), Number(lon), zoom ? Number(zoom) : 14);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStatus, index]);

  // ---------- Back / clear ----------
  const handleBack = () => {
    if (mode === 'directions') {
      setMode('home');
      return;
    }
    setMode('home');
    setSelectedExitIndex(null);
    setSelectedPlaceIndex(null);
    setPin(null);
    setQuery('');
    setSearchFocused(false);
  };

  const handleClearSearch = () => {
    setQuery('');
    setSearchState({ exits: [], places: [], locations: [] });
    setHasSearched(false);
    setActiveIndex(0);
    setSearchFocused(true);
  };

  const handleQuickCategory = (category: number) => {
    setLayers((l) => ({
      ...l,
      showPlaces: true,
      categoryFilter: l.categoryFilter === category ? null : category,
    }));
    showToast(
      layers.categoryFilter === category
        ? `Showing all places`
        : `Showing ${CATEGORY_META[category]?.plural.toLowerCase() ?? 'places'}`,
    );
  };

  const handleToggleRestAreas = () => {
    setLayers((l) => ({ ...l, showRestAreas: !l.showRestAreas }));
    showToast(layers.showRestAreas ? 'Rest areas hidden' : 'Showing rest areas and welcome centers');
  };

  const selectedStation =
    selectedPlaceIndex !== null && index
      ? stations.get(index.places[selectedPlaceIndex].osmId)
      : undefined;

  const cardSaved =
    (selectedExitIndex !== null && index && isSaved(`exit:${index.exits[selectedExitIndex].id}`)) ||
    (selectedPlaceIndex !== null && index && isSaved(`place:${index.places[selectedPlaceIndex].osmId}`));

  return (
    <>
      <MapView
        ref={mapRef}
        index={index}
        corridors={corridors}
        restAreas={restAreas}
        discover={discover}
        selectedExitIndex={selectedExitIndex}
        selectedPlaceIndex={selectedPlaceIndex}
        route={routeState.routes[routeState.selected] ?? null}
        routeExits={routeState.routeExits}
        mapStyle={mapStyle}
        layers={layers}
        userLocation={userLocation}
        pin={pin}
        highlightCorridor={highlightCorridor}
        onExitClick={(i) => openExit(i)}
        onPlaceClick={(i) => openPlace(i)}
        onMapClick={handleMapClick}
        onRestAreaClick={(r) => openLocation(r.lat, r.lon, `${r.name || 'Rest area'}${r.road ? ` · ${r.road}` : ''}`)}
        onDiscoverClick={(d) => openLocation(d.lat, d.lon, d.name)}
        onMoveEnd={(center) => {
          mapCenterRef.current = center;
        }}
      />

      <LoadingScreen
        progress={progress}
        error={loadError}
        onRetry={() => setLoadAttempt((n) => n + 1)}
        done={dataStatus === 'ready'}
      />

      {!driveOpen && (
        <div className="ui-layer">
          {mode === 'directions' ? (
            <div className="top-panel">
              <DirectionsPanel
                index={index!}
                startPoint={startPoint}
                endPoint={endPoint}
                startText={startText}
                endText={endText}
                onStartTextChange={(t) => {
                  setStartText(t);
                  if (startPoint && t !== startPoint.label) setStartPoint(null);
                }}
                onEndTextChange={(t) => {
                  setEndText(t);
                  if (endPoint && t !== endPoint.label) setEndPoint(null);
                }}
                onStartSelect={(w) => {
                  setStartPoint(w);
                  setStartText(w.label);
                }}
                onEndSelect={(w) => {
                  setEndPoint(w);
                  setEndText(w.label);
                }}
                onSwap={handleSwap}
                travelMode={travelMode}
                onTravelModeChange={setTravelMode}
                routeState={routeState}
                onBack={() => setMode('home')}
                onSelectRoute={handleSelectRoute}
                onOpenExit={(i) => openExit(i)}
                onDemo={handleDemo}
                onRetry={() => {
                  if (startPoint && endPoint) {
                    lastRouteKeyRef.current = null;
                    computeRoute(startPoint, endPoint, travelMode);
                  }
                }}
                onUseLocation={handleUseLocation}
                onDownloadGpx={handleDownloadGpx}
                mapCenter={mapCenterRef.current}
              />
            </div>
          ) : (
            <SearchBar
              query={query}
              onQueryChange={(q) => {
                setQuery(q);
                setSearchFocused(true);
              }}
              onSubmit={submitSearch}
              onClear={handleClearSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              focused={searchFocused}
              onDirections={() => openDirections()}
              onExitGuide={handleExitGuide}
              onQuickCategory={handleQuickCategory}
              activeCategory={layers.categoryFilter}
              onToggleRestAreas={handleToggleRestAreas}
              restAreasOn={layers.showRestAreas}
            >
              {searchFocused && (query.trim() || flatItems.length > 0) ? (
                <SearchResults
                  items={flatItems}
                  activeIndex={activeIndex}
                  searching={searching}
                  query={query}
                  hasSearched={hasSearched}
                  onHover={setActiveIndex}
                  onSelect={selectFlat}
                  onClearRecent={() => {
                    setRecent([]);
                    saveRecent([]);
                  }}
                />
              ) : mode === 'exit' && selectedExitIndex !== null && index ? (
                <ExitCard
                  index={index}
                  exitIndex={selectedExitIndex}
                  onBack={handleBack}
                  onDirections={() => {
                    const wp = waypointFromExit(selectedExitIndex);
                    if (wp) openDirections(undefined, wp);
                  }}
                  onPlaceClick={(pi, ei, link) => openPlace(pi, ei, link)}
                  onExitClick={(i) => openExit(i)}
                  onSave={toggleSave}
                  onShare={handleShare}
                  saved={!!cardSaved}
                />
              ) : mode === 'place' && selectedPlaceIndex !== null && index ? (
                <PlaceCard
                  index={index}
                  placeIndex={selectedPlaceIndex}
                  exitIndex={selectedExitIndex ?? undefined}
                  link={selectedLink}
                  station={selectedStation}
                  onBack={handleBack}
                  onDirections={() => {
                    const p = index.places[selectedPlaceIndex];
                    openDirections(undefined, { label: p.brand || p.name, lat: p.lat, lon: p.lon, placeIndex: selectedPlaceIndex });
                  }}
                  onExitClick={(i) => openExit(i)}
                  onSave={toggleSave}
                  onShare={handleShare}
                  saved={!!cardSaved}
                />
              ) : mode === 'location' && pin ? (
                <LocationCard
                  lat={pin.lat}
                  lon={pin.lon}
                  address={pinAddress}
                  loadingAddress={pinLoading}
                  index={index}
                  onBack={handleBack}
                  onDirectionsFrom={() =>
                    openDirections({ label: pinAddress || formatCoordinate(pin.lat, pin.lon), lat: pin.lat, lon: pin.lon }, undefined)
                  }
                  onDirectionsTo={() =>
                    openDirections(undefined, { label: pinAddress || formatCoordinate(pin.lat, pin.lon), lat: pin.lat, lon: pin.lon })
                  }
                  onClear={() => {
                    setPin(null);
                    setMode('home');
                  }}
                  onExitClick={(i) => openExit(i)}
                />
              ) : query.trim() ? (
                <SearchResults
                  items={flatItems}
                  activeIndex={activeIndex}
                  searching={searching}
                  query={query}
                  hasSearched={hasSearched}
                  onHover={setActiveIndex}
                  onSelect={selectFlat}
                />
              ) : null}
            </SearchBar>
          )}

          <MapControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onLocate={handleLocate}
            locating={locating}
            userLocation={userLocation}
            mapStyle={mapStyle}
            onMapStyle={setMapStyle}
            layers={layers}
            onLayers={setLayers}
          />

          <div className="top-right">
            <button type="button" className="pill-btn" onClick={handleExitGuide} title="Browse exits along an interstate">
              <ShieldIcon size={16} style={{ color: '#1a73e8' }} />
              <span>Exit guide</span>
            </button>
            <button type="button" className="pill-btn" onClick={() => setAboutOpen(true)} aria-label="About Interstate" title="About & data sources">
              <Info size={16} />
            </button>
          </div>

          <div className="map-attribution">
            <span>©</span>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
            <span>·</span>
            <a href="https://openinterstate.org/" target="_blank" rel="noreferrer">OpenInterstate</a>
            <span>·</span>
            <span>Basemap © CARTO / Esri</span>
          </div>
        </div>
      )}

      {driveOpen && index && (
        <DriveMode
          index={index}
          corridors={corridors}
          onClose={() => {
            setDriveOpen(false);
            setHighlightCorridor(null);
          }}
          onCorridorFocus={handleCorridorFocus}
          onExitFocus={(i) => {
            const e = index.exits[i];
            mapRef.current?.flyTo(e.lat, e.lon, 15);
          }}
          onOpenExit={(i) => {
            setDriveOpen(false);
            setHighlightCorridor(null);
            openExit(i);
          }}
          onDirections={(i) => {
            setDriveOpen(false);
            setHighlightCorridor(null);
            const wp = waypointFromExit(i);
            if (wp) openDirections(undefined, wp);
          }}
        />
      )}

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

