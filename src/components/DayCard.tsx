import { useEffect, useMemo, useState } from 'react';
import { Sticker } from './Sticker';
import { Check, Trash, X, Note as NoteIcon, Party, Plus, Sparkle } from '../lib/icons';
import { longDate } from '../lib/dates';
import { holidaysForYear, daysUntilHoliday } from '../lib/holidays';
import { STICKER_MAP } from '../lib/stickers';
import { Emoji } from './Emoji';
import type { DayEntry } from '../lib/types';

type Props = {
  dayKey: string;
  entry: DayEntry;
  onUpdate: (up: (entry: DayEntry) => DayEntry) => void;
  onClear: () => void;
  onClose: () => void;
  onOpenSheet: () => void;
};

const QUICK = ['star', 'heart', 'sparkles', 'gingerbread', 'hot-cocoa', 'tree', 'gift', 'candy-cane', 'clover', 'snowflake'];

export default function DayCard({ dayKey, entry, onUpdate, onClear, onClose, onOpenSheet }: Props) {
  const [note, setNote] = useState(entry.note?.text ?? '');
  const [saved, setSaved] = useState(false);

  const date = useMemo(() => new Date(dayKey), [dayKey]);
  const holiday = useMemo(() => holidaysForYear(date.getFullYear())[dayKey], [dayKey, date]);
  const until = holiday ? daysUntilHoliday(dayKey) : null;

  useEffect(() => {
    setNote(entry.note?.text ?? '');
  }, [dayKey, entry.note?.text]);

  // debounce note saving
  useEffect(() => {
    const t = window.setTimeout(() => {
      const current = entry.note?.text ?? '';
      if (note === current) return;
      onUpdate((d) => ({
        ...d,
        note: note.trim() ? { text: note, updatedAt: Date.now() } : undefined,
      }));
      if (note.trim()) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1300);
      }
    }, 420);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  const commitNote = () => {
    const current = entry.note?.text ?? '';
    if (note === current) return;
    onUpdate((d) => ({
      ...d,
      note: note.trim() ? { text: note, updatedAt: Date.now() } : undefined,
    }));
  };

  const addSticker = (id: string) => onUpdate((d) => ({ ...d, stickers: [...d.stickers, id].slice(-9) }));

  const removeStickerAt = (index: number) =>
    onUpdate((d) => ({ ...d, stickers: d.stickers.filter((_, i) => i !== index) }));

  const parts = longDate(dayKey).split(', ');
  const weekday = parts[0] ?? '';
  const restDate = parts.slice(1).join(', ');

  return (
    <section className="card day-card" aria-label={`Details for ${longDate(dayKey)}`}>
      <div className="day-card-head">
        <div className="day-badge" aria-hidden="true">
          {date.getDate()}
          <small>{weekday.slice(0, 3).toUpperCase()}</small>
        </div>
        <div className="day-card-title">
          <h2>{restDate}</h2>
          <p>
            {holiday ? (
              <>
                <Emoji name={holiday.emoji} size={14} /> {holiday.label}
                {until !== null && until >= 0 ? ` · in ${until}d` : ''}
              </>
            ) : (
              'A fresh little day'
            )}
          </p>
        </div>
        <button className="icon-btn day-close" onClick={onClose} aria-label="Close day details">
          <X size={18} />
        </button>
      </div>

      <div className="card-body">
        <div className="section-label">
          <NoteIcon size={12} /> Note
          {saved && <span className="pill green" style={{ height: 20, fontSize: 10 }}>saved</span>}
        </div>
        <textarea
          className="note-input"
          value={note}
          maxLength={220}
          placeholder="Write a little something… a plan, a wish, a doodle in words."
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
        />

        <div className="section-label">
          <Party size={12} /> Stickers <span className="count">{entry.stickers.length}</span>
        </div>

        {entry.stickers.length > 0 ? (
          <div className="sticker-tray-mini" style={{ marginBottom: 8 }}>
            {entry.stickers.map((id, i) => (
              <button key={`${id}-${i}`} className="tray-sticker" aria-label={`Remove ${STICKER_MAP[id]?.name ?? 'sticker'}`} onClick={() => removeStickerAt(i)}>
                <Sticker id={id} />
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-hint" style={{ padding: '0 0 8px' }}>
            No stickers yet — tap one below or open the full sheet.
          </p>
        )}

        <div className="sticker-tray-mini">
          {QUICK.map((id) => (
            <button key={id} className="tray-sticker" title={`Add ${STICKER_MAP[id]?.name ?? id}`} aria-label={`Add ${STICKER_MAP[id]?.name ?? id}`} onClick={() => addSticker(id)}>
              <Sticker id={id} />
            </button>
          ))}
          <button className="tray-sticker" onClick={onOpenSheet} title="Open the full sticker sheet" aria-label="Open the full sticker sheet">
            <Plus size={18} />
          </button>
        </div>

        <div className="day-toolbar">
          <button className="tog" aria-pressed={entry.done} onClick={() => onUpdate((d) => ({ ...d, done: !d.done }))}>
            <Check size={14} /> Done
          </button>
          <button className="tog" onClick={onOpenSheet}>
            <Sparkle size={14} /> Mascot pals
          </button>
          <button className="danger-btn" style={{ marginLeft: 'auto' }} onClick={onClear}>
            <Trash size={14} /> Clear
          </button>
        </div>
      </div>
    </section>
  );
}
