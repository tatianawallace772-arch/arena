import { useState } from 'react';
import { Sparkle } from '../lib/icons';
import { CATEGORY_META, STICKERS, type StickerCategory } from '../lib/stickers';
import { Sticker } from './Sticker';
import { Emoji } from './Emoji';

type Props = {
  targetLabel: string;
  onAdd: (id: string) => void;
  onOpenSheet: () => void;
};

const TABS: StickerCategory[] = ['mascots', 'cozy', 'sparkle', 'sweets'];

export default function QuickStickerCard({ targetLabel, onAdd, onOpenSheet }: Props) {
  const [tab, setTab] = useState<StickerCategory>('mascots');
  const [burst, setBurst] = useState<{ id: string; n: number } | null>(null);

  const stickers = STICKERS.filter((s) => s.category === tab);

  return (
    <section className="card" aria-label="Sticker picker">
      <div className="card-head">
        <Sparkle size={16} />
        <h2>Sticker sheet</h2>
        <span className="spacer" />
        <button className="mini-btn" onClick={onOpenSheet}>
          Big sheet
        </button>
      </div>
      <div className="picker-tabs" role="tablist" aria-label="Sticker categories">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            className="picker-tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            <Emoji name={CATEGORY_META[t].emoji} size={14} /> {CATEGORY_META[t].label}
          </button>
        ))}
      </div>
      <div className="sticker-grid">
        {stickers.map((s) => (
          <button
            key={s.id}
            className={`sticker-btn${s.category === 'mascots' ? ' mascot' : ''}`}
            title={`${s.name} → ${targetLabel}`}
            aria-label={`Add ${s.name} to ${targetLabel}`}
            onClick={() => {
              onAdd(s.id);
              setBurst({ id: s.id, n: Date.now() });
            }}
          >
            <Sticker id={s.id} />
            {burst?.id === s.id && (
              <span className="spark" key={burst.n}>
                <Emoji name="sparkles" size={26} />
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="empty-hint" style={{ paddingTop: 0 }}>
        Adding to <strong>{targetLabel}</strong>. Mascot pals also appear as page decorations when you use “Add mascot”.
      </p>
    </section>
  );
}
