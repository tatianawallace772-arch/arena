import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, CalendarIcon } from '../lib/icons';
import { MONTHS } from '../lib/dates';
import { Emoji, type EmojiName } from './Emoji';

type Props = {
  open: boolean;
  year: number;
  month: number;
  onClose: () => void;
  onPick: (year: number, month: number) => void;
  onToday: () => void;
};

export default function MonthPicker({ open, year, month, onClose, onPick, onToday }: Props) {
  const [shownYear, setShownYear] = useState(year);

  useEffect(() => {
    if (open) setShownYear(year);
  }, [open, year]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal month-picker" role="dialog" aria-modal="true" aria-label="Jump to a month">
        <div className="modal-head">
          <CalendarIcon size={18} />
          <h2>Jump to a month</h2>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close month picker">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="year-switch">
            <button className="icon-btn" onClick={() => setShownYear((y) => y - 1)} aria-label="Previous year">
              <ChevronLeft size={18} />
            </button>
            <span className="year-label">{shownYear}</span>
            <button className="icon-btn" onClick={() => setShownYear((y) => y + 1)} aria-label="Next year">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="month-grid-picker">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                className="month-cell"
                aria-pressed={shownYear === year && i === month}
                onClick={() => {
                  onPick(shownYear, i);
                  onClose();
                }}
              >
                <Emoji name={MONTH_EMOJI[i]} size={20} />
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
          <div className="month-picker-foot">
            <button
              className="chip-btn"
              onClick={() => {
                onToday();
                onClose();
              }}
            >
              Take me to today
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MONTH_EMOJI: EmojiName[] = [
  'snowflake',
  'heartbox',
  'clover',
  'flower',
  'tulip',
  'sun',
  'fireworks',
  'watermelon',
  'leaves',
  'pumpkin',
  'turkey',
  'tree',
];
