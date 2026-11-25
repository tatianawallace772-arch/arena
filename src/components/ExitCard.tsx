import { ArrowLeft, Clock3, Navigation, Share2, Star } from 'lucide-react';
import type { LinkRecord } from '../data/parser';
import { formatDistance, formatDuration } from '../lib/geo';
import { highwayList, primaryHighway, type InterstateIndex } from '../data/index';
import { CATEGORY_META, CategoryIcon, CATEGORY_ORDER, Shield } from './Icons';

interface ExitCardProps {
  index: InterstateIndex;
  exitIndex: number;
  onBack: () => void;
  onDirections: () => void;
  onPlaceClick: (placeIndex: number, exitIndex: number, link: LinkRecord) => void;
  onExitClick: (exitIndex: number) => void;
  onSave: () => void;
  onShare: () => void;
  saved: boolean;
}

function driveLabel(link: LinkRecord): string {
  const seconds = link.driveS ?? link.driveM ?? link.distanceM / 12;
  const dist = link.driveM ?? link.distanceM;
  return `${formatDuration(seconds)} · ${formatDistance(dist)}`;
}

export default function ExitCard({
  index,
  exitIndex,
  onBack,
  onDirections,
  onPlaceClick,
  onExitClick,
  onSave,
  onShare,
  saved,
}: ExitCardProps) {
  const exit = index.exits[exitIndex];
  if (!exit) return null;
  const highways = highwayList(exit.highways);
  const primary = primaryHighway(exit.highways);
  const groups = index.placesAtExit(exitIndex, 6);
  const counts = index.exitCategoryCounts(exitIndex);
  const nearby = index
    .nearestExits(exit.lat, exit.lon, 25_000, 5)
    .filter((n) => n.index !== exitIndex)
    .slice(0, 4);
  const hasServices = groups.size > 0;

  return (
    <div className="card">
      <div className="card-top">
        <button type="button" className="icon-btn back-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="hero-shield">
          <Shield highway={primary} size={42} />
        </div>
        <div className="card-heading">
          <div className="card-eyebrow">
            Interstate exit
            {highways.length > 1 && <span>· {highways.length} routes</span>}
          </div>
          <div className="card-title">{exit.label ? `Exit ${exit.label}` : exit.name || 'Interstate exit'}</div>
          <div className="card-subtitle">
            {highways.join(' · ')}
            {exit.name ? ` — ${exit.name}` : ''}
          </div>
        </div>
        <div className="card-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={onSave}
            aria-label={saved ? 'Remove from saved' : 'Save exit'}
            title={saved ? 'Saved' : 'Save'}
          >
            <Star size={17} fill={saved ? '#f9ab00' : 'none'} style={{ color: saved ? '#f9ab00' : undefined }} />
          </button>
          <button type="button" className="icon-btn" onClick={onShare} aria-label="Share" title="Share">
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
        <div className="section-title">
          Services at this exit
          <span style={{ fontSize: 10.5, fontWeight: 500, color: '#9aa0a6' }}>
            {groups.size ? `${Array.from(groups.values()).reduce((a, b) => a + b.length, 0)} listed` : ''}
          </span>
        </div>
        {hasServices ? (
          <div className="service-chips">
            {CATEGORY_ORDER.filter((c) => counts[c]).map((c) => (
              <span key={c} className="service-chip">
                <CategoryIcon category={c} size={13} />
                {CATEGORY_META[c]?.label}
                <span className="count">{counts[c]}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="card-subtitle">No services are listed at this exit in OpenInterstate.</div>
        )}
      </div>

      {hasServices && (
        <div className="card-section">
          <div className="section-title">Nearby</div>
          {CATEGORY_ORDER.filter((c) => groups.has(c)).map((category) => {
            const list = groups.get(category)!;
            const meta = CATEGORY_META[category] ?? CATEGORY_META[0];
            return (
              <div key={category} className="nearby-group">
                <div className="nearby-head">
                  <CategoryIcon category={category} size={13} />
                  {meta.label}
                  <span style={{ fontWeight: 500, color: '#9aa0a6', letterSpacing: 0 }}>
                    {list.length}
                  </span>
                </div>
                {list.map(({ place, link }) => (
                  <div
                    key={`${place.osmId}-${link.placeIndex}`}
                    className="nearby-item"
                    onClick={() => onPlaceClick(link.placeIndex, exitIndex, link)}
                  >
                    <div className="nearby-icon" style={{ background: meta.bg }}>
                      <CategoryIcon category={category} size={14} />
                    </div>
                    <div className="nearby-main">
                      <div className="nearby-name">{place.brand || place.name}</div>
                      <div className="nearby-meta">
                        {place.brand && place.name && place.brand !== place.name ? `${place.name} · ` : ''}
                        {link.driveS ? 'drive from exit' : `from exit · ${formatDistance(link.distanceM)}`}
                      </div>
                    </div>
                    <div className="nearby-time">
                      <Clock3 size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                      {driveLabel(link)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {nearby.length > 0 && (
        <div className="card-section">
          <div className="section-title">Nearby exits</div>
          {nearby.map(({ index: i, distanceM, exit: e }) => (
            <div key={e.id} className="nearby-item" onClick={() => onExitClick(i)}>
              <Shield highway={primaryHighway(e.highways)} size={22} />
              <div className="nearby-main">
                <div className="nearby-name">
                  {e.label ? `Exit ${e.label}` : 'Interstate exit'}
                  <span style={{ color: '#9aa0a6', fontWeight: 500 }}> · {e.highways.split(';')[0]}</span>
                </div>
                <div className="nearby-meta">{e.name || 'Interstate exit'}</div>
              </div>
              <div className="nearby-time">{formatDistance(distanceM)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card-footer">
        <span>Exit &amp; place data from</span>
        <a href="https://openinterstate.org/" target="_blank" rel="noreferrer">OpenInterstate</a>
        <span>· © OpenStreetMap contributors</span>
      </div>
    </div>
  );
}
