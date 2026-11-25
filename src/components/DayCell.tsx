import { memo } from 'react';
import { Check } from '../lib/icons';
import type { DayEntry } from '../lib/types';
import type { Holiday } from '../lib/holidays';
import { Emoji } from './Emoji';
import { Sticker } from './Sticker';

type Props = {
  date: Date;
  entry: DayEntry;
  holiday?: Holiday;
  inMonth: boolean;
  isToday: boolean;
  selected: boolean;
  showHolidays: boolean;
  showNotes: boolean;
  countdown?: number;
  onSelect: (date: Date) => void;
};

function DayCellImpl({
  date,
  entry,
  holiday,
  inMonth,
  isToday,
  selected,
  showHolidays,
  showNotes,
  countdown,
  onSelect,
}: Props) {
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const stickers = entry.stickers.slice(0, 4);
  const extra = entry.stickers.length - stickers.length;
  const classes = [
    'day-cell',
    inMonth ? '' : 'pad',
    isToday ? 'today' : '',
    selected ? 'selected' : '',
    entry.done ? 'done' : '',
    weekend ? 'weekend' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      data-tone={holiday?.tone}
      onClick={() => onSelect(date)}
      aria-pressed={selected}
      aria-label={date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })}
    >
      <div className="day-head">
        <span className="day-num">{date.getDate()}</span>
        {showHolidays && holiday && (
          <span className="holiday-emoji" title={holiday.label}>
            <Emoji name={holiday.emoji} />
          </span>
        )}
      </div>

      {showHolidays && holiday && inMonth && <span className="day-holiday">{holiday.short}</span>}

      <div className="day-stickers">
        {stickers.map((id, i) => (
          <Sticker
            key={`${id}-${i}`}
            id={id}
            alt=""
            className="mini-sticker"
            style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (6 + i * 3)}deg)` }}
          />
        ))}
        {extra > 0 && <span className="mini-sticker mini-more">+{extra}</span>}
      </div>

      {showNotes && entry.note?.text && <span className="day-note">{entry.note.text}</span>}

      {entry.done && (
        <span className="day-done" title="Done">
          <Check size={11} />
        </span>
      )}

      {typeof countdown === 'number' && countdown >= 0 && countdown <= 14 && (
        <span className="countdown">
          {countdown === 0 ? 'today!' : `${countdown} ${countdown === 1 ? 'day' : 'days'}`}
        </span>
      )}
    </button>
  );
}

export default memo(DayCellImpl);
