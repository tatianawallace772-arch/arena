import { Clock3, MapPin, SearchX } from 'lucide-react';
import type { ExitRecord, PlaceRecord } from '../data/parser';
import type { GeocodeResult } from '../lib/routing';
import type { FlatItem } from '../lib/ui';
import { CategoryIcon, Shield, categoryMeta } from './Icons';

interface SearchResultsProps {
  items: FlatItem[];
  activeIndex: number;
  searching: boolean;
  query: string;
  hasSearched: boolean;
  onHover: (index: number) => void;
  onSelect: (item: FlatItem) => void;
  onClearRecent?: () => void;
}

function ExitRow({ exit, active, onHover, onSelect }: { exit: ExitRecord; active: boolean; onHover: () => void; onSelect: () => void }) {
  return (
    <div
      className={`result-item${active ? ' active' : ''}`}
      onMouseEnter={onHover}
      onClick={onSelect}
      role="option"
      aria-selected={active}
    >
      <div className="result-icon shield">
        <Shield highway={exit.highways} size={23} />
      </div>
      <div className="result-main">
        <div className="result-title">{exit.label ? `Exit ${exit.label}` : exit.name || 'Interstate exit'}</div>
        <div className="result-sub">
          {exit.name ? `${exit.name} · ` : ''}
          {exit.highways.replace(/;/g, ' / ')}
        </div>
      </div>
    </div>
  );
}

function PlaceRow({ place, active, onHover, onSelect }: { place: PlaceRecord; active: boolean; onHover: () => void; onSelect: () => void }) {
  const meta = categoryMeta(place.category);
  return (
    <div
      className={`result-item${active ? ' active' : ''}`}
      onMouseEnter={onHover}
      onClick={onSelect}
      role="option"
      aria-selected={active}
    >
      <div className="result-icon" style={{ background: meta.bg }}>
        <CategoryIcon category={place.category} size={16} />
      </div>
      <div className="result-main">
        <div className="result-title">{place.brand || place.name}</div>
        <div className="result-sub">
          {meta.label}
          {place.brand && place.name && place.brand !== place.name ? ` · ${place.name}` : ''}
        </div>
      </div>
    </div>
  );
}

function LocationRow({ result, active, onHover, onSelect }: { result: GeocodeResult; active: boolean; onHover: () => void; onSelect: () => void }) {
  return (
    <div
      className={`result-item${active ? ' active' : ''}`}
      onMouseEnter={onHover}
      onClick={onSelect}
      role="option"
      aria-selected={active}
    >
      <div className="result-icon">
        <MapPin size={16} />
      </div>
      <div className="result-main">
        <div className="result-title">{result.name}</div>
        <div className="result-sub">{result.displayName}</div>
      </div>
    </div>
  );
}

export default function SearchResults({
  items,
  activeIndex,
  searching,
  query,
  hasSearched,
  onHover,
  onSelect,
  onClearRecent,
}: SearchResultsProps) {
  if (!query.trim() && items.length === 0) return null;
  if (searching && items.length === 0) {
    return (
      <div className="results">
        <div className="searching-row">
          <span className="spinner" />
          Searching exits, places and addresses…
        </div>
      </div>
    );
  }
  if (items.length === 0 && query.trim()) {
    return (
      <div className="results">
        <div className="empty-hint" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <SearchX size={20} style={{ color: '#9aa0a6', flex: '0 0 auto', marginTop: 1 }} />
          <div>
            <strong>No results for “{query}”.</strong>
            <br />
            Try an exit number like <strong>I-95 exit 123</strong>, a city, or a place name.
          </div>
        </div>
      </div>
    );
  }

  let lastKind: string | null = null;
  const labels: Record<string, string> = {
    exit: 'Interstate exits',
    place: 'Places',
    location: 'Locations',
    recent: 'Recent',
  };

  return (
    <div className="results" role="listbox">
      {items.map((item, i) => {
        const kind = item.kind;
        const showLabel = kind !== lastKind;
        lastKind = kind;
        return (
          <div key={`${kind}-${i}`}>
            {showLabel && (
              <div className="result-label">
                {labels[kind]}
                {kind === 'recent' && items.some((x) => x.kind === 'recent') && onClearRecent && (
                  <button
                    type="button"
                    className="link"
                    style={{ marginLeft: 'auto', fontSize: 10.5, color: '#1a73e8', fontWeight: 600 }}
                    onClick={onClearRecent}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            {item.kind === 'exit' && (
              <ExitRow
                exit={item.exit}
                active={i === activeIndex}
                onHover={() => onHover(i)}
                onSelect={() => onSelect(item)}
              />
            )}
            {item.kind === 'place' && (
              <PlaceRow
                place={item.place}
                active={i === activeIndex}
                onHover={() => onHover(i)}
                onSelect={() => onSelect(item)}
              />
            )}
            {item.kind === 'location' && (
              <LocationRow
                result={item.result}
                active={i === activeIndex}
                onHover={() => onHover(i)}
                onSelect={() => onSelect(item)}
              />
            )}
            {item.kind === 'recent' && (
              <div
                className={`result-item${i === activeIndex ? ' active' : ''}`}
                onMouseEnter={() => onHover(i)}
                onClick={() => onSelect(item)}
                role="option"
                aria-selected={i === activeIndex}
              >
                <div className="result-icon">
                  <Clock3 size={15} />
                </div>
                <div className="result-main">
                  <div className="result-title">{item.item.label}</div>
                  <div className="result-sub">{item.item.sublabel ?? 'Recent'}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {hasSearched && !searching && (
        <div className="result-label" style={{ cursor: 'default', textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}>
          Results from OpenInterstate · OpenStreetMap · Photon
        </div>
      )}
    </div>
  );
}
