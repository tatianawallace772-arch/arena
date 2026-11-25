import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ART_STICKERS, GLYPH_STICKERS } from '../lib/data';
import type { PlacedSticker } from '../lib/types';

interface Props {
  targetDate: string;
  onPlace: (stickerId: string) => void;
  onPlaceArtHero: () => void;
  placed: PlacedSticker[];
  onClearSelectedDay: () => void;
  onClearAll: () => void;
}

export default function StickerTray({ targetDate, onPlace, onPlaceArtHero, placed, onClearSelectedDay, onClearAll }: Props) {
  const [tab, setTab] = useState<'art' | 'glyph'>('art');
  return (
    <div className="card">
      <div className="card-head">
        <span aria-hidden>✨</span>
        <span className="card-title">Sticker Sheet</span>
        <span className="spacer" />
        <div className="viewswitch" style={{ padding: 2 }}>
          <button className={tab === 'art' ? 'active' : ''} onClick={() => setTab('art')} style={{ padding: '4px 9px', fontSize: 11 }}>
            Art
          </button>
          <button className={tab === 'glyph' ? 'active' : ''} onClick={() => setTab('glyph')} style={{ padding: '4px 9px', fontSize: 11 }}>
            Cookie
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="smallcaps" style={{ marginBottom: 7 }}>
          Pin to {targetDate}
        </div>
        {tab === 'art' ? (
          <div className="art-tray">
            {ART_STICKERS.map((s) => (
              <button
                key={s.id}
                className="tray-btn art"
                title={`Place ${s.name}`}
                onClick={() => onPlace(s.id)}
              >
                <img src={s.src} alt={s.name} draggable={false} />
              </button>
            ))}
          </div>
        ) : (
          <div className="tray">
            {GLYPH_STICKERS.map((s) => (
              <button key={s.id} className="tray-btn" title={`Place ${s.name}`} onClick={() => onPlace(s.id)}>
                <span aria-hidden>{s.glyph}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={onPlaceArtHero} title="Drop Starr Nova on the selected day">
            🍪 Drop Nova
          </button>
          <button className="btn btn-sm" onClick={onClearSelectedDay} disabled={placed.length === 0}>
            <Trash2 size={12} /> This day
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onClearAll}>
            Clear all
          </button>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          Stickers keep their size and tilt. Unlock “Editing” on the calendar to drag them between days.
        </p>
      </div>
    </div>
  );
}
