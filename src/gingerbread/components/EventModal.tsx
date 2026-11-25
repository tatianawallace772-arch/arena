import { useEffect, useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { EVENT_COLORS, EVENT_COLOR_KEYS, GLYPH_STICKERS, ART_STICKERS, stickerById } from '../lib/data';
import type { CalendarEvent, EventColor } from '../lib/types';
import { formatLongDate, fromISO } from '../lib/calendar';

export type EventDraft = Omit<CalendarEvent, 'id'> & { id?: string };

interface Props {
  draft: EventDraft;
  onSave: (draft: EventDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function EventModal({ draft, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState<EventDraft>(draft);

  useEffect(() => setForm(draft), [draft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = (p: Partial<EventDraft>) => setForm((f) => ({ ...f, ...p }));
  const isNew = !draft.id;
  const st = form.sticker ? stickerById(form.sticker) : undefined;

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={isNew ? 'New event' : 'Edit event'}>
        <div className="modal-head">
          <span aria-hidden style={{ fontSize: 20 }}>🍪</span>
          <h2>{isNew ? 'Pin a new plan' : 'Edit this plan'}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.title.trim()) return;
            onSave({ ...form, title: form.title.trim() });
          }}
          id="event-form"
        >
          <div className="field">
            <label htmlFor="ev-title">What&apos;s baking?</label>
            <input
              id="ev-title"
              className="input"
              autoFocus
              placeholder="Gingerbread village build…"
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="ev-date">Date</label>
              <input
                id="ev-date"
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => patch({ date: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="ev-time">Time</label>
              <input
                id="ev-time"
                type="time"
                className="input"
                value={form.time ?? ''}
                onChange={(e) => patch({ time: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="ev-end">Ends</label>
              <input
                id="ev-end"
                type="time"
                className="input"
                value={form.endTime ?? ''}
                onChange={(e) => patch({ endTime: e.target.value || undefined })}
              />
            </div>
            <div className="field">
              <label>Icing colour</label>
              <div className="swatches">
                {EVENT_COLOR_KEYS.map((key: EventColor) => (
                  <button
                    key={key}
                    type="button"
                    className={`swatch ${form.color === key ? 'active' : ''}`}
                    style={{ background: EVENT_COLORS[key].dot }}
                    aria-label={EVENT_COLORS[key].label}
                    title={EVENT_COLORS[key].label}
                    onClick={() => patch({ color: key })}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="field">
            <label>Sticker badge (optional)</label>
            <div className="sticker-picker">
              <button
                type="button"
                className={`sticker-pick none ${!form.sticker ? 'active' : ''}`}
                onClick={() => patch({ sticker: undefined })}
                title="No sticker"
              >
                —
              </button>
              {ART_STICKERS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`sticker-pick ${form.sticker === s.id ? 'active' : ''}`}
                  onClick={() => patch({ sticker: s.id })}
                  title={s.name}
                >
                  <img src={s.src} alt={s.name} />
                </button>
              ))}
              {GLYPH_STICKERS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`sticker-pick ${form.sticker === s.id ? 'active' : ''}`}
                  onClick={() => patch({ sticker: s.id })}
                  title={s.name}
                >
                  <span aria-hidden>{s.glyph}</span>
                </button>
              ))}
            </div>
            {st && (
              <span className="muted" style={{ fontSize: 11.5 }}>
                Using <b>{st.name}</b>
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="ev-notes">Notes</label>
            <textarea
              id="ev-notes"
              className="textarea"
              placeholder="Royal icing, sprinkles, and a lot of patience…"
              value={form.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, fontWeight: 800 }}>
            <input
              type="checkbox"
              checked={Boolean(form.done)}
              onChange={(e) => patch({ done: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: 'var(--pine)' }}
            />
            <Check size={14} /> Mark as done
          </label>
          <span className="muted" style={{ fontSize: 11.5, marginTop: -6 }}>
            {formatLongDate(fromISO(form.date))}
          </span>
        </form>
        <div className="modal-foot">
          {!isNew && onDelete && (
            <button className="btn btn-sm" onClick={onDelete} style={{ color: 'var(--peppermint-deep)' }}>
              <Trash2 size={13} /> Delete
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" form="event-form" disabled={!form.title.trim()}>
            <Check size={14} /> {isNew ? 'Pin it' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
