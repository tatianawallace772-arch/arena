import { ArrowLeft, MapPin, Navigation, X } from 'lucide-react';
import { formatCoordinate, formatDistance } from '../lib/geo';
import { primaryHighway, type InterstateIndex } from '../data/index';
import { Shield } from './Icons';

interface LocationCardProps {
  lat: number;
  lon: number;
  address?: string;
  loadingAddress?: boolean;
  index?: InterstateIndex | null;
  onBack: () => void;
  onDirectionsFrom: () => void;
  onDirectionsTo: () => void;
  onClear: () => void;
  onExitClick?: (exitIndex: number) => void;
}

export default function LocationCard({
  lat,
  lon,
  address,
  loadingAddress,
  index,
  onBack,
  onDirectionsFrom,
  onDirectionsTo,
  onClear,
  onExitClick,
}: LocationCardProps) {
  const nearby = index ? index.nearestExits(lat, lon, 60_000, 3) : [];
  return (
    <div className="card">
      <div className="card-top">
        <button type="button" className="icon-btn back-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div
          className="hero-shield"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: '#fce8e6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ea4335',
          }}
        >
          <MapPin size={24} />
        </div>
        <div className="card-heading">
          <div className="card-eyebrow">Dropped pin</div>
          <div className="card-title" style={{ fontSize: 16 }}>
            {loadingAddress ? 'Looking up address…' : address || 'Unnamed location'}
          </div>
          <div className="card-subtitle">{formatCoordinate(lat, lon)}</div>
        </div>
        <div className="card-actions">
          <button type="button" className="icon-btn" onClick={onClear} aria-label="Clear pin">
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="card-actions-row">
        <button type="button" className="btn btn-primary" onClick={onDirectionsTo}>
          <Navigation size={16} /> Directions to
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDirectionsFrom}>
          From here
        </button>
      </div>

      {nearby.length > 0 && (
        <div className="card-section">
          <div className="section-title">Nearest interstate exits</div>
          {nearby.map(({ index: i, distanceM, exit }) => (
            <div key={exit.id} className="nearby-item" onClick={() => onExitClick?.(i)}>
              <Shield highway={primaryHighway(exit.highways)} size={22} />
              <div className="nearby-main">
                <div className="nearby-name">
                  {exit.label ? `Exit ${exit.label}` : 'Interstate exit'}
                  <span style={{ color: '#9aa0a6', fontWeight: 500 }}> · {exit.highways.split(';')[0]}</span>
                </div>
                <div className="nearby-meta">{exit.name || 'Interstate exit'}</div>
              </div>
              <div className="nearby-time">{formatDistance(distanceM)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card-footer">
        <span>Coordinates are WGS84 ·</span>
        <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer">© OpenStreetMap</a>
      </div>
    </div>
  );
}
