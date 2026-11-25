import { MASCOTS } from '../lib/stickers';
import { Sparkle, Plus } from '../lib/icons';

type Props = {
  monthIndex: number;
  monthName: string;
  stickerCount: number;
  noteCount: number;
  onAddMascot: () => void;
  onOpenSheet: () => void;
};

export default function HeroCard({
  monthIndex,
  monthName,
  stickerCount,
  noteCount,
  onAddMascot,
  onOpenSheet,
}: Props) {
  const mascot = MASCOTS[monthIndex % MASCOTS.length];
  return (
    <section className="card hero" aria-label="This month at a glance">
      <div>
        <span className="eyebrow">
          <Sparkle size={13} /> {monthName} vibes
        </span>
        <h2>Sprinkle a little joy</h2>
        <p>
          {stickerCount} {stickerCount === 1 ? 'sticker' : 'stickers'} and {noteCount}{' '}
          {noteCount === 1 ? 'note' : 'notes'} tucked into {monthName}. Tap a day to add more.
        </p>
        <div className="hero-actions">
          <button className="mini-btn accent" onClick={onAddMascot}>
            <Plus size={14} /> Add mascot
          </button>
          <button className="mini-btn" onClick={onOpenSheet}>
            Sticker sheet
          </button>
        </div>
      </div>
      <div className="hero-mascot">
        <img src={mascot.src} alt={mascot.name} draggable={false} />
      </div>
    </section>
  );
}
