import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Navigation, Shield as ShieldIcon, X } from 'lucide-react';
import type { Corridor } from '../data/parser';
import type { InterstateIndex } from '../data/index';
import { computeCorridorExits, type CorridorExit } from '../lib/corridor';
import { formatDistance } from '../lib/geo';
import { CATEGORY_META, CATEGORY_ORDER, CategoryIcon, Shield } from './Icons';

interface DriveModeProps {
  index: InterstateIndex;
  corridors: Corridor[];
  onClose: () => void;
  onCorridorFocus: (corridor: Corridor, exits: CorridorExit[]) => void;
  onExitFocus: (exitIndex: number) => void;
  onOpenExit: (exitIndex: number) => void;
  onDirections: (exitIndex: number) => void;
}

const DIRECTION_LABELS: Record<string, string> = {
  north: 'Northbound',
  south: 'Southbound',
  east: 'Eastbound',
  west: 'Westbound',
};

export default function DriveMode({
  index,
  corridors,
  onClose,
  onCorridorFocus,
  onExitFocus,
  onOpenExit,
  onDirections,
}: DriveModeProps) {
  const highways = useMemo(() => {
    const set = new Set<string>();
    for (const c of corridors) if (c.highway) set.add(c.highway);
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [corridors]);

  const [highway, setHighway] = useState<string>('I-95');
  const [direction, setDirection] = useState<string>('');

  const directions = useMemo(() => {
    const list = corridors.filter((c) => c.highway === highway);
    const set = new Set<string>();
    for (const c of list) set.add(c.directionCode);
    return Array.from(set);
  }, [corridors, highway]);

  useEffect(() => {
    if (!highways.includes(highway)) setHighway(highways[0] ?? 'I-95');
  }, [highways, highway]);

  useEffect(() => {
    if (!directions.includes(direction)) setDirection(directions[0] ?? '');
  }, [directions, direction]);

  const corridor = useMemo(
    () => corridors.find((c) => c.highway === highway && c.directionCode === direction) ?? null,
    [corridors, highway, direction],
  );

  const corridorExits = useMemo(() => {
    if (!corridor) return [];
    return computeCorridorExits(index, corridor);
  }, [index, corridor]);

  const [selected, setSelected] = useState(0);
  useEffect(() => {
    setSelected(0);
  }, [corridor]);

  useEffect(() => {
    if (corridor) onCorridorFocus(corridor, corridorExits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corridor, corridorExits.length]);

  const current = corridorExits[Math.min(selected, Math.max(0, corridorExits.length - 1))];

  const heroExit = current ? index.exits[current.exitIndex] : null;
  const heroCounts = current ? index.exitCategoryCounts(current.exitIndex) : {};
  const heroServices = CATEGORY_ORDER.filter((c) => heroCounts[c]);

  return (
    <div className="drive-overlay">
      <div className="drive-panel">
        <div className="drive-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <ShieldIcon size={20} style={{ color: '#1a73e8' }} />
            <div>
              <div className="drive-title">Exit guide</div>
              <div className="drive-sub">Read the road ahead</div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close exit guide">
            <X size={19} />
          </button>
        </div>

        <div className="drive-selectors">
          <div className="drive-select-wrap">
            <select
              className="drive-select"
              value={highway}
              onChange={(e) => setHighway(e.target.value)}
              aria-label="Interstate"
            >
              {highways.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="drive-select-chevron" />
          </div>
          <div className="drive-direction-chips">
            {directions.map((d) => (
              <button
                key={d}
                type="button"
                className={`drive-direction${direction === d ? ' active' : ''}`}
                onClick={() => setDirection(d)}
              >
                {DIRECTION_LABELS[d] ?? d}
              </button>
            ))}
          </div>
        </div>

        {corridor && (
          <div className="drive-summary">
            <span className="drive-summary-title">{corridor.displayName}</span>
            <span className="drive-summary-meta">
              {formatDistance(corridor.distanceMeters)} · {corridorExits.length} exits
            </span>
          </div>
        )}

        {heroExit && (
          <div className="drive-hero">
            <div className="drive-hero-top">
              <Shield highway={heroExit.highways.split(';')[0]} size={40} />
              <div className="drive-hero-main">
                <div className="drive-hero-label">
                  {heroExit.label ? `Exit ${heroExit.label}` : 'Interstate exit'}
                </div>
                <div className="drive-hero-name">{heroExit.name || heroExit.highways.replace(/;/g, ' / ')}</div>
              </div>
              <div className="drive-hero-mile">
                {formatDistance(current.alongM)}
                <span>along</span>
              </div>
            </div>
            {heroServices.length > 0 ? (
              <div className="timeline-services" style={{ marginTop: 8 }}>
                {heroServices.slice(0, 6).map((c) => (
                  <span key={c} className="mini-service">
                    <CategoryIcon category={c} size={11} />
                    {CATEGORY_META[c]?.label}
                  </span>
                ))}
              </div>
            ) : (
              <div className="drive-hero-none">No services listed at this exit</div>
            )}
            <div className="drive-hero-actions">
              <button type="button" className="btn btn-primary" style={{ height: 34, fontSize: 12 }} onClick={() => onOpenExit(current.exitIndex)}>
                <Navigation size={14} /> Open exit
              </button>
              <button type="button" className="btn btn-secondary" style={{ height: 34, fontSize: 12 }} onClick={() => onDirections(current.exitIndex)}>
                Directions
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ height: 34, fontSize: 12, marginLeft: 'auto' }}
                onClick={() => {
                  const next = Math.min(selected + 1, corridorExits.length - 1);
                  setSelected(next);
                  onExitFocus(corridorExits[next].exitIndex);
                }}
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="drive-list">
          <div className="drive-list-head">
            <span>Upcoming exits</span>
            <span>{corridorExits.length}</span>
          </div>
          {corridorExits.length === 0 && (
            <div className="empty-hint" style={{ padding: 16 }}>
              No exits matched this corridor. Try another interstate or direction.
            </div>
          )}
          {corridorExits.map((r, i) => {
            const e = index.exits[r.exitIndex];
            const counts = index.exitCategoryCounts(r.exitIndex);
            const services = CATEGORY_ORDER.filter((c) => counts[c]);
            return (
              <div
                key={`${r.exitIndex}-${i}`}
                className={`drive-item${i === selected ? ' active' : ''}`}
                onClick={() => {
                  setSelected(i);
                  onExitFocus(r.exitIndex);
                }}
              >
                <div className="drive-item-mile">{formatDistance(r.alongM)}</div>
                <div className="drive-item-rail">
                  <div className={`drive-item-dot${services.length ? ' has-services' : ''}`} />
                  {i < corridorExits.length - 1 && <div className="drive-item-line" />}
                </div>
                <div className="drive-item-body">
                  <div className="drive-item-top">
                    <Shield highway={e.highways.split(';')[0]} size={19} />
                    <span className="drive-item-exit">{e.label ? `Exit ${e.label}` : 'Exit'}</span>
                    <span className="drive-item-name">{e.name || e.highways.split(';')[0]}</span>
                  </div>
                  {services.length > 0 && (
                    <div className="drive-item-services">
                      {services.slice(0, 5).map((c) => (
                        <span key={c} className="mini-service">
                          <CategoryIcon category={c} size={10} />
                          {CATEGORY_META[c]?.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="drive-close-hint">Scroll the list or click an exit to jump there.</div>
    </div>
  );
}
