import { ArrowLeft, Clock3, Navigation, Share2, Star } from 'lucide-react';
import type { LinkRecord, StationInfo } from '../data/parser';
import { formatDistance, formatDuration } from '../lib/geo';
import { primaryHighway, type InterstateIndex } from '../data/index';
import { CategoryIcon, categoryMeta, Shield } from './Icons';

interface PlaceCardProps {
  index: InterstateIndex;
  placeIndex: number;
  exitIndex?: number;
  link?: LinkRecord;
  station?: StationInfo;
  onBack: () => void;
  onDirections: () => void;
  onExitClick: (exitIndex: number) => void;
  onSave: () => void;
  onShare: () => void;
  saved: boolean;
}

export default function PlaceCard({
  index,
  placeIndex,
  exitIndex,
  link,
  station,
  onBack,
  onDirections,
  onExitClick,
  onSave,
  onShare,
  saved,
}: PlaceCardProps) {
  const place = index.places[placeIndex];
  if (!place) return null;
  const meta = categoryMeta(place.category);
  const exit = exitIndex !== undefined ? index.exits[exitIndex] : undefined;
  const seconds = link?.driveS ?? link?.driveM ?? 0;
  const dist = link?.driveM ?? link?.distanceM ?? 0;

  return (
    <div className="card">
      <div className="card-top">
        <button type="button" className="icon-btn back-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="hero-shield" style={{ width: 44, height: 44, borderRadius: 14, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CategoryIcon category={place.category} size={24} />
        </div>
        <div className="card-heading">
          <div className="card-eyebrow">{meta.label}</div>
          <div className="card-title">{place.brand || place.name}</div>
          <div className="card-subtitle">
            {place.brand && place.name && place.brand !== place.name ? `${place.name}` : meta.plural}
            {station?.ab ? ` · ${station.ab}` : ''}
          </div>
        </div>
        <div className="card-actions">
          <button type="button" className="icon-btn" onClick={onSave} aria-label={saved ? 'Remove from saved' : 'Save place'}>
            <Star size={17} fill={saved ? '#f9ab00' : 'none'} style={{ color: saved ? '#f9ab00' : undefined }} />
          </button>
          <button type="button" className="icon-btn" onClick={onShare} aria-label="Share">
            <Share2 size={17} />
          </button>
        </div>
      </div>

      <div className="card-actions-row">
        <button type="button" className="btn btn-primary" onClick={onDirections}>
          <Navigation size={16} /> Directions
        </button>
        <button type="button" className="btn btn-secondary" onClick={onSave}>
          <Star size={15} fill={saved ? '#f9ab00' : 'none'} style={{ color: saved ? '#f9ab00' : undefined }} />
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="card-section">
        {exit ? (
          <div className="nearby-item" style={{ margin: 0, padding: '8px 8px' }} onClick={() => onExitClick(exitIndex!)}>
            <Shield highway={primaryHighway(exit.highways)} size={26} />
            <div className="nearby-main">
              <div className="nearby-name">
                {exit.label ? `Exit ${exit.label}` : 'Interstate exit'}
                <span style={{ color: '#9aa0a6', fontWeight: 500 }}> · {exit.highways.split(';')[0]}</span>
              </div>
              <div className="nearby-meta">{exit.name || 'Nearest exit'}</div>
            </div>
            <div className="nearby-time">
              <Clock3 size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
              {seconds ? formatDuration(seconds) : formatDistance(dist)}
            </div>
          </div>
        ) : (
          <div className="card-subtitle">
            {place.lat.toFixed(4)}, {place.lon.toFixed(4)} · not linked to an exit
          </div>
        )}
      </div>

      {(station?.ah || station?.at !== undefined) && (
        <div className="card-section">
          <div className="section-title">Hours &amp; amenities</div>
          <div className="service-chips">
            {station?.h && <span className="service-chip">Open {station.h}</span>}
            {station?.ah && !station?.h && <span className="service-chip">{station.ah}</span>}
            {station?.at && <span className="service-chip">Restrooms</span>}
            {station?.rebranded && <span className="service-chip muted">Now {station.rebranded}</span>}
          </div>
        </div>
      )}

      <div className="card-footer">
        <span>Place data from</span>
        <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer">OpenStreetMap</a>
        <span>·</span>
        <a href="https://openinterstate.org/" target="_blank" rel="noreferrer">OpenInterstate</a>
      </div>
    </div>
  );
}
