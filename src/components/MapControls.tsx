import { useEffect, useRef, useState } from 'react';
import { Layers, LocateFixed, Minus, Plus } from 'lucide-react';
import type { LayerState, MapStyle, UserLocation } from '../lib/types';
import { HAS_CARTO_API_KEY } from '../lib/mapConfig';
import { CategoryIcon } from './Icons';
import FontPicker from './FontPicker';

const STYLES: Array<{ id: MapStyle; label: string; thumb: string }> = [
  { id: 'openstreetmap', label: 'OpenStreetMap', thumb: 'thumb-map' },
  ...(HAS_CARTO_API_KEY ? [{ id: 'carto' as const, label: 'CARTO Voyager', thumb: 'thumb-map' }] : []),
  { id: 'satellite', label: 'Satellite', thumb: 'thumb-satellite' },
  { id: 'terrain', label: 'Terrain', thumb: 'thumb-terrain' },
];

const FILTERS = [
  { id: 1, label: 'Gas' },
  { id: 2, label: 'Food' },
  { id: 3, label: 'Lodging' },
  { id: 5, label: 'EV' },
  { id: 4, label: 'Rest' },
];

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  locating,
  userLocation,
  mapStyle,
  onMapStyle,
  layers,
  onLayers,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  locating: boolean;
  userLocation: UserLocation | null;
  mapStyle: MapStyle;
  onMapStyle: (s: MapStyle) => void;
  layers: LayerState;
  onLayers: (l: LayerState) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = (key: keyof Omit<LayerState, 'categoryFilter'>) => {
    onLayers({ ...layers, [key]: !layers[key] });
  };

  return (
    <div className="map-controls" ref={wrapRef}>
      <div className="zoom-group">
        <button type="button" onClick={onZoomIn} aria-label="Zoom in">
          <Plus size={17} />
        </button>
        <button type="button" onClick={onZoomOut} aria-label="Zoom out">
          <Minus size={17} />
        </button>
      </div>
      <button
        type="button"
        className={`map-btn${userLocation ? ' active' : ''}`}
        onClick={onLocate}
        aria-label="Show my location"
        title="Show my location"
      >
        {locating ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <LocateFixed size={19} />}
      </button>
      <button
        type="button"
        className={`map-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Map layers"
        aria-expanded={open}
        title="Map layers"
      >
        <Layers size={19} />
      </button>

      {open && (
        <div className="layer-popover">
          <div className="popover-title">Map type</div>
          <div className="style-grid">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`style-option${mapStyle === s.id ? ' active' : ''}`}
                onClick={() => onMapStyle(s.id)}
              >
                <div className={`style-thumb ${s.thumb}`} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="popover-title" style={{ marginBottom: 5 }}>
            Typography
          </div>
          <FontPicker />

          <div className="popover-title" style={{ marginBottom: 3 }}>
            Layers
          </div>
          <div className="toggle-list">
            <label className="toggle-row">
              <span className="label">Interstate corridors</span>
              <span className={`switch${layers.showCorridors ? ' on' : ''}`} />
              <input
                type="checkbox"
                checked={layers.showCorridors}
                onChange={() => toggle('showCorridors')}
                style={{ display: 'none' }}
              />
            </label>
            <label className="toggle-row">
              <span className="label">Interstate exits</span>
              <span className={`switch${layers.showExits ? ' on' : ''}`} />
              <input type="checkbox" checked={layers.showExits} onChange={() => toggle('showExits')} style={{ display: 'none' }} />
            </label>
            <label className="toggle-row">
              <span className="label">Places</span>
              <span className="hint">{layers.categoryFilter !== null ? 'Filtered' : ''}</span>
              <span className={`switch${layers.showPlaces || layers.categoryFilter !== null ? ' on' : ''}`} />
              <input
                type="checkbox"
                checked={layers.showPlaces || layers.categoryFilter !== null}
                onChange={() => {
                  if (layers.categoryFilter !== null) onLayers({ ...layers, categoryFilter: null, showPlaces: false });
                  else toggle('showPlaces');
                }}
                style={{ display: 'none' }}
              />
            </label>
            <label className="toggle-row">
              <span className="label">Rest areas</span>
              <span className={`switch${layers.showRestAreas ? ' on' : ''}`} />
              <input
                type="checkbox"
                checked={layers.showRestAreas}
                onChange={() => toggle('showRestAreas')}
                style={{ display: 'none' }}
              />
            </label>
            <label className="toggle-row">
              <span className="label">Notable places</span>
              <span className={`switch${layers.showDiscover ? ' on' : ''}`} />
              <input
                type="checkbox"
                checked={layers.showDiscover}
                onChange={() => toggle('showDiscover')}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div className="popover-title" style={{ marginBottom: 5 }}>
            Place filter
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button
              type="button"
              className={`chip${layers.categoryFilter === null && layers.showPlaces ? ' active' : ''}`}
              onClick={() => onLayers({ ...layers, showPlaces: true, categoryFilter: null })}
            >
              All
            </button>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`chip${layers.categoryFilter === f.id ? ' active' : ''}`}
                onClick={() => onLayers({ ...layers, showPlaces: true, categoryFilter: f.id })}
              >
                <CategoryIcon category={f.id} size={13} /> {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
