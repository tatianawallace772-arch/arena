import { useEffect, useState } from 'react';
import { Download, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import type { Settings } from '../lib/types';
import { ART_STICKERS, GLYPH_STICKERS, ALL_STICKERS } from '../lib/data';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  eventCount: number;
  stickerCount: number;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
  onClearAll: () => void;
}

export default function SettingsModal({
  settings,
  onChange,
  onClose,
  eventCount,
  stickerCount,
  onReset,
  onExport,
  onImport,
  onClearAll,
}: Props) {
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="modal-head">
          <span aria-hidden style={{ fontSize: 20 }}>⚙️</span>
          <h2>Bakery settings</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Week starts on</label>
            <div className="viewswitch" style={{ width: 'fit-content' }}>
              {([0, 1] as const).map((v) => (
                <button
                  key={v}
                  className={settings.weekStartsOn === v ? 'active' : ''}
                  onClick={() => onChange({ weekStartsOn: v })}
                >
                  {v === 0 ? 'Sunday' : 'Monday'}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Density</label>
            <div className="viewswitch" style={{ width: 'fit-content' }}>
              {(['cozy', 'compact'] as const).map((v) => (
                <button key={v} className={settings.density === v ? 'active' : ''} onClick={() => onChange({ density: v })}>
                  {v === 'cozy' ? 'Cozy' : 'Compact'}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.showHolidays}
              onChange={(e) => onChange({ showHolidays: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: 'var(--pine)' }}
            />
            Show holiday cookies 🎄
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.celebration}
              onChange={(e) => onChange({ celebration: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: 'var(--pine)' }}
            />
            Sprinkle confetti on save
          </label>

          <div className="card" style={{ boxShadow: 'none' }}>
            <div className="card-head">
              <span aria-hidden>🏷️</span>
              <span className="card-title">Your sticker library</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ALL_STICKERS.map((s) => (
                  <span
                    key={s.id}
                    title={s.name}
                    style={{
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 9,
                      border: '1.5px solid var(--cookie-200)',
                      background: '#fffdf8',
                      fontSize: 17,
                      overflow: 'hidden',
                    }}
                  >
                    {s.kind === 'art' ? <img src={s.src} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : s.glyph}
                  </span>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 11.5, marginBottom: 0 }}>
                {ART_STICKERS.length} art stickers · {GLYPH_STICKERS.length} cookie stickers · {eventCount} events ·{' '}
                {stickerCount} placed on the calendar.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={onExport}>
              <Download size={13} /> Export JSON
            </button>
            <button className="btn btn-sm" onClick={onImport}>
              <Upload size={13} /> Import JSON
            </button>
            <button className="btn btn-sm" onClick={onReset}>
              <RotateCcw size={13} /> Restore sample plans
            </button>
            {confirmReset ? (
              <button className="btn btn-sm btn-primary" onClick={onClearAll}>
                <Trash2 size={13} /> Yes, delete everything
              </button>
            ) : (
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmReset(true)}>
                <Trash2 size={13} /> Delete all data
              </button>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <span className="muted" style={{ fontSize: 11.5 }}>
            Everything is stored locally in your browser.
          </span>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
