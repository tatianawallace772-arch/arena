import { ChevronLeft, ChevronRight, CalendarIcon, Settings as SettingsIcon, Download, Sparkle, Undo } from '../lib/icons';
import { MONTHS } from '../lib/dates';

type Props = {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenSettings: () => void;
  onOpenStickerSheet: () => void;
  onExport: () => void;
  onJumpMonth: () => void;
};

export default function TopBar({
  year,
  month,
  onPrev,
  onNext,
  onToday,
  onOpenSettings,
  onOpenStickerSheet,
  onExport,
  onJumpMonth,
}: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <img src="/stickers/santa-cheer.png" alt="" draggable={false} />
        </div>
        <div className="brand-text">
          <h1>Sticker Calendar</h1>
          <p>cozy planning, one cute stamp at a time</p>
        </div>
      </div>

      <div className="month-nav">
        <button className="icon-btn" onClick={onPrev} aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <button className="nav-month-btn" onClick={onJumpMonth} title="Jump to a month">
          <CalendarIcon size={16} />
          {MONTHS[month]} {year}
        </button>
        <button className="icon-btn" onClick={onNext} aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="toolbar">
        <button className="chip-btn" onClick={onToday} title="Jump to today">
          <Undo size={16} /> Today
        </button>
        <button className="chip-btn primary" onClick={onOpenStickerSheet}>
          <Sparkle size={16} /> Stickers
        </button>
        <button className="chip-btn round" onClick={onExport} aria-label="Download calendar as image" title="Download as image">
          <Download size={17} />
        </button>
        <button className="chip-btn round" onClick={onOpenSettings} aria-label="Settings" title="Settings">
          <SettingsIcon size={17} />
        </button>
      </div>
    </header>
  );
}
