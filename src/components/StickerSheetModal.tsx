import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Sparkle } from '../lib/icons';
import { CATEGORY_META, STICKERS, type StickerCategory } from '../lib/stickers';
import { Sticker } from './Sticker';
import { Emoji } from './Emoji';

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  targetLabel: string;
};

const ORDER: StickerCategory[] = ['mascots', 'cozy', 'sparkle', 'sweets'];

export default function StickerSheetModal({ open, onClose, onPick, targetLabel }: Props) {
  const [query, setQuery] = useState('');
  const [lastPicked, setLastPicked] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ORDER.map((category) => ({
      category,
      items: STICKERS.filter(
        (s) => s.category === category && (!q || s.name.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  if (!open) return null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal sheet-modal" role="dialog" aria-modal="true" aria-label="Sticker sheet">
        <div className="modal-head">
          <Sparkle size={18} />
          <h2>Sticker sheet</h2>
          <span className="pill">{targetLabel}</span>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close sticker sheet">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ paddingBottom: 10 }}>
          <div className="search-field">
            <Search size={16} />
            <input
              ref={inputRef}
              value={query}
              placeholder="Search stickers — mascot, cookie, star…"
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setQuery('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="sheet-body">
          {groups.map(({ category, items }) => (
            <div className="sheet-group" key={category}>
              <h3>
                <Emoji name={CATEGORY_META[category].emoji} size={14} /> {CATEGORY_META[category].label}
              </h3>
              <div className="sheet-stickers">
                {items.map((s) => (
                  <button
                    key={s.id}
                    className="sheet-sticker"
                    onClick={() => {
                      onPick(s.id);
                      setLastPicked(s.id);
                    }}
                    title={`${s.name} → ${targetLabel}`}
                    aria-label={`Add ${s.name}`}
                  >
                    <Sticker id={s.id} alt="" />
                    {!s.src && <small>{s.name}</small>}
                    {lastPicked === s.id && (
                      <span className="spark">
                        <Emoji name="sparkles" size={30} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="empty-hint">No stickers match “{query}”.</p>}
        </div>
      </div>
    </div>
  );
}
