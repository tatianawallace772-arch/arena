import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpRight,
  Bike,
  Car,
  CircleDot,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Footprints,
  LogIn,
  LogOut,
  MapPin,
  Merge,
  Navigation,
  RotateCw,
  Route as RouteIcon,
  Split,
} from 'lucide-react';
import type { InterstateIndex } from '../data/index';
import { geocode, type GeocodeResult, type TravelMode } from '../lib/routing';
import { formatDistance, formatDuration } from '../lib/geo';
import type { FlatItem, RouteState, Waypoint } from '../lib/ui';
import { CategoryIcon, CATEGORY_META, CATEGORY_ORDER, ShieldBadge } from './Icons';

interface DirectionsPanelProps {
  index: InterstateIndex;
  startPoint: Waypoint | null;
  endPoint: Waypoint | null;
  startText: string;
  endText: string;
  onStartTextChange: (text: string) => void;
  onEndTextChange: (text: string) => void;
  onStartSelect: (w: Waypoint) => void;
  onEndSelect: (w: Waypoint) => void;
  onSwap: () => void;
  travelMode: TravelMode;
  onTravelModeChange: (m: TravelMode) => void;
  routeState: RouteState;
  onBack: () => void;
  onSelectRoute: (i: number) => void;
  onOpenExit: (exitIndex: number) => void;
  onDemo: () => void;
  onRetry: () => void;
  onUseLocation: () => void;
  onDownloadGpx: () => void;
  mapCenter?: { lat: number; lon: number } | null;
}

function WaypointInput({
  value,
  onChange,
  onSelect,
  placeholder,
  kind,
  index,
  bias,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelect: (w: Waypoint) => void;
  placeholder: string;
  kind: 'start' | 'end';
  index: InterstateIndex;
  bias?: { lat: number; lon: number } | null;
}) {
  const [focused, setFocused] = useState(false);
  const [items, setItems] = useState<FlatItem[]>([]);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const run = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setItems([]);
      setSearching(false);
      return;
    }
    const exits = index.searchExits(trimmed, 4).map((h) => ({ kind: 'exit' as const, index: h.index, exit: h.exit }));
    const places = index.searchPlaces(trimmed, 4).map((h) => ({ kind: 'place' as const, index: h.index, place: h.place }));
    setItems([...exits, ...places]);
    setActive(0);
    setSearching(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const geo = await geocode(trimmed, ctrl.signal, bias ?? undefined);
        setItems((prev) => [
          ...prev.filter((i) => i.kind !== 'location'),
          ...geo.map((r, i) => ({ kind: 'location' as const, index: i, result: r })),
        ]);
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, 280);
  };

  const choose = (item: FlatItem) => {
    let w: Waypoint;
    if (item.kind === 'exit') {
      w = {
        label: `Exit ${item.exit.label || ''} · ${item.exit.highways.split(';')[0]}`.replace('Exit  ·', 'Interstate exit ·'),
        lat: item.exit.lat,
        lon: item.exit.lon,
        exitIndex: item.index,
      };
    } else if (item.kind === 'place') {
      w = { label: item.place.brand || item.place.name, lat: item.place.lat, lon: item.place.lon, placeIndex: item.index };
    } else if (item.kind === 'recent') {
      w = { label: item.item.label, lat: item.item.lat, lon: item.item.lon };
    } else {
      w = { label: item.result.name, lat: item.result.lat, lon: item.result.lon };
    }
    onSelect(w);
    setFocused(false);
    setItems([]);
  };

  return (
    <div className="dir-row">
      <span className={`dir-dot ${kind}`} />
      <div className="dir-field" ref={wrapRef}>
        <input
          className="dir-input"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            run(e.target.value);
          }}
          onFocus={() => {
            setFocused(true);
            if (value.trim()) run(value);
          }}
          onBlur={() => setTimeout(() => setFocused(false), 140)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (items[active]) choose(items[active]);
            } else if (e.key === 'Escape') {
              setFocused(false);
              setItems([]);
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          spellCheck={false}
          autoComplete="off"
        />
        {focused && (items.length > 0 || searching) && (
          <div className="dir-suggestions">
            {items.map((item, i) => item.kind === 'recent' ? null : (
              <div
                key={`${item.kind}-${i}`}
                className={`result-item${i === active ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(item);
                }}
              >
                <div className="result-icon" style={{ width: 26, height: 26, borderRadius: 7 }}>
                  {item.kind === 'exit' ? (
                    <ShieldBadge highway={item.exit.highways} size={17} />
                  ) : item.kind === 'place' ? (
                    <CategoryIcon category={item.place.category} size={13} />
                  ) : (
                    <MapPin size={13} />
                  )}
                </div>
                <div className="result-main">
                  <div className="result-title" style={{ fontSize: 12.5 }}>
                    {item.kind === 'exit'
                      ? `Exit ${item.exit.label || ''}`
                      : item.kind === 'place'
                        ? item.place.brand || item.place.name
                        : item.result.name}
                  </div>
                  <div className="result-sub" style={{ fontSize: 10.5 }}>
                    {item.kind === 'exit'
                      ? item.exit.highways.replace(/;/g, ' / ')
                      : item.kind === 'place'
                        ? CATEGORY_META[item.place.category]?.label
                        : item.result.displayName}
                  </div>
                </div>
              </div>
            ))}
            {searching && (
              <div className="searching-row" style={{ padding: '8px 12px', fontSize: 11 }}>
                <span className="spinner" style={{ width: 13, height: 13 }} /> Searching…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepIcon({ type, modifier }: { type: string; modifier?: string }) {
  let Icon = ArrowUp;
  if (type === 'turn') Icon = modifier?.includes('left') ? CornerUpLeft : modifier?.includes('right') ? CornerUpRight : ArrowUp;
  else if (type === 'on ramp') Icon = LogIn;
  else if (type === 'off ramp') Icon = LogOut;
  else if (type === 'merge') Icon = Merge;
  else if (type === 'fork') Icon = Split;
  else if (type === 'roundabout' || type === 'rotary') Icon = RotateCw;
  else if (type === 'arrive') Icon = Flag;
  else if (type === 'depart') Icon = Navigation;
  else if (type === 'continue' || type === 'new name') Icon = ArrowUp;
  const major = type === 'turn' || type === 'on ramp' || type === 'off ramp' || type === 'merge' || type === 'fork' || type === 'arrive';
  return (
    <div className={`step-icon${major ? ' major' : ''}`}>
      <Icon size={14} />
    </div>
  );
}

export default function DirectionsPanel({
  index,
  startPoint,
  endPoint,
  startText,
  endText,
  onStartTextChange,
  onEndTextChange,
  onStartSelect,
  onEndSelect,
  onSwap,
  travelMode,
  onTravelModeChange,
  routeState,
  onBack,
  onSelectRoute,
  onOpenExit,
  onDemo,
  onRetry,
  onUseLocation,
  onDownloadGpx,
  mapCenter,
}: DirectionsPanelProps) {
  const [tab, setTab] = useState<'steps' | 'exits'>('steps');
  const selectedRoute = routeState.routes[routeState.selected] ?? null;

  return (
    <div className="panel-body flush" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 32px)' }}>
      <div className="dir-header">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back to search">
          <ArrowLeft size={18} />
        </button>
        <span className="dir-title">Directions</span>
      </div>

      <div className="dir-inputs">
        <WaypointInput
          value={startText}
          onChange={onStartTextChange}
          onSelect={onStartSelect}
          placeholder="Choose a starting point"
          kind="start"
          index={index}
          bias={mapCenter}
        />
        <div style={{ position: 'relative', height: 26, margin: '-3px 0' }}>
          <div style={{ position: 'absolute', left: 23, top: 0, bottom: 0, width: 2, background: '#e8eaed' }} />
          <button
            type="button"
            className="swap-btn"
            onClick={onSwap}
            aria-label="Swap start and destination"
            title="Swap"
            style={{ right: 14, top: '50%' }}
          >
            <ArrowRightLeft size={14} />
          </button>
        </div>
        <WaypointInput
          value={endText}
          onChange={onEndTextChange}
          onSelect={onEndSelect}
          placeholder="Choose a destination"
          kind="end"
          index={index}
          bias={mapCenter}
        />
      </div>

      <div className="mode-tabs">
        <button type="button" className={`mode-tab${travelMode === 'driving' ? ' active' : ''}`} onClick={() => onTravelModeChange('driving')}>
          <Car size={15} /> Drive
        </button>
        <button type="button" className={`mode-tab${travelMode === 'walking' ? ' active' : ''}`} onClick={() => onTravelModeChange('walking')}>
          <Footprints size={15} /> Walk
        </button>
        <button type="button" className={`mode-tab${travelMode === 'cycling' ? ' active' : ''}`} onClick={() => onTravelModeChange('cycling')}>
          <Bike size={15} /> Bike
        </button>
      </div>

      {routeState.status === 'loading' && (
        <div className="route-loading">
          <span className="spinner" /> Finding the best route…
        </div>
      )}

      {routeState.status === 'error' && (
        <div className="empty-state">
          <div className="empty-art" style={{ background: '#fce8e6', color: '#ea4335' }}>
            <RouteIcon size={28} />
          </div>
          <div className="empty-title">We couldn't find a route</div>
          <div className="empty-text">{routeState.error ?? 'Try different points, or check your connection.'}</div>
          <div className="empty-actions">
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              Try again
            </button>
            <button type="button" className="btn btn-secondary" onClick={onDemo}>
              Try the demo route
            </button>
          </div>
        </div>
      )}

      {routeState.status === 'ready' && routeState.routes.length > 0 && (
        <>
          <div className="route-cards">
            {routeState.routes.map((r, i) => (
              <button
                key={r.id}
                type="button"
                className={`route-card${i === routeState.selected ? ' selected' : ''}`}
                onClick={() => onSelectRoute(i)}
              >
                <div className="route-main">
                  <div className="route-time">{formatDuration(r.durationS)}</div>
                  <div className="route-dist">{formatDistance(r.distanceM)}</div>
                  {r.summary && <div className="route-via">{r.summary}</div>}
                </div>
                {i === 0 ? (
                  <span className="route-badge">Fastest</span>
                ) : (
                  <span className="route-badge" style={{ background: '#f1f3f4', color: '#5f6368' }}>
                    Via {i + 1}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="route-note">
            <CircleDot size={13} />
            {routeState.source === 'demo'
              ? 'Demo route from OpenInterstate · Miami to Manhattan'
              : 'Routing by OSRM · © OpenStreetMap contributors · Times are estimates'}
          </div>

          <div className="tabbar">
            <button type="button" className={tab === 'steps' ? 'active' : ''} onClick={() => setTab('steps')}>
              Steps
            </button>
            <button type="button" className={tab === 'exits' ? 'active' : ''} onClick={() => setTab('exits')}>
              Exits along route
              <span className="count">{routeState.routeExits.length}</span>
            </button>
          </div>

          <div style={{ overflowY: 'auto', overscrollBehavior: 'contain', flex: 1, minHeight: 0 }}>
            {tab === 'steps' && selectedRoute && (
              <div className="steps-list">
                {selectedRoute.steps.map((step, i) => (
                  <div key={i} className="step">
                    <StepIcon type={step.type} modifier={step.modifier} />
                    <div className="step-main">{step.instruction || 'Continue'}</div>
                    <div className="step-dist">{step.distance > 0 ? formatDistance(step.distance) : ''}</div>
                  </div>
                ))}
                <div style={{ padding: '10px 16px 16px' }}>
                  <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={onDownloadGpx}>
                    <ArrowDown size={15} /> Download GPX
                  </button>
                </div>
              </div>
            )}

            {tab === 'exits' && (
              <div className="exit-timeline">
                {routeState.routeExits.length === 0 && (
                  <div className="empty-hint" style={{ padding: '18px 16px' }}>
                    No interstate exits were found along this route. It may stay on local roads for most of
                    the trip.
                  </div>
                )}
                {routeState.routeExits.map((r, i) => {
                  const e = index.exits[r.exitIndex];
                  const counts = index.exitCategoryCounts(r.exitIndex);
                  const services = CATEGORY_ORDER.filter((c) => counts[c]);
                  return (
                    <div key={`${r.exitIndex}-${i}`} className="timeline-item" onClick={() => onOpenExit(r.exitIndex)}>
                      <div className="timeline-rail">
                        <div className="timeline-dot" />
                        {i < routeState.routeExits.length - 1 && <div className="timeline-line" />}
                      </div>
                      <div className="timeline-body">
                        <div className="timeline-top">
                          <span className="timeline-exit">{e.label ? `Exit ${e.label}` : 'Interstate exit'}</span>
                          <span className="timeline-name">{e.name || e.highways.split(';')[0]}</span>
                          <span className="timeline-mile">{formatDistance(r.alongM)}</span>
                        </div>
                        {services.length > 0 ? (
                          <div className="timeline-services">
                            {services.slice(0, 5).map((c) => (
                              <span key={c} className="mini-service">
                                <CategoryIcon category={c} size={11} />
                                {CATEGORY_META[c]?.label}
                              </span>
                            ))}
                            {services.length > 5 && <span className="mini-service">+{services.length - 5}</span>}
                          </div>
                        ) : (
                          <div className="timeline-services">
                            <span className="mini-service">No services listed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ padding: '4px 16px 16px' }}>
                  <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={onDownloadGpx}>
                    <ArrowDown size={15} /> Download GPX
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {routeState.status === 'idle' && (
        <div className="empty-state">
          <div className="empty-art">
            <RouteIcon size={28} />
          </div>
          <div className="empty-title">Plan a drive</div>
          <div className="empty-text">
            Pick a starting point and a destination. We'll find the route and show every interstate exit
            along the way, with gas, food and lodging.
          </div>
          <div className="empty-actions">
            <button type="button" className="btn btn-primary" onClick={onUseLocation}>
              <MapPin size={15} /> Use my location
            </button>
            <button type="button" className="btn btn-secondary" onClick={onDemo}>
              Miami → Manhattan demo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
