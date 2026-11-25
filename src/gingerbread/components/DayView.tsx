import { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAYS_LONG, formatLongDate, fromISO, relativeDayLabel, toISO } from '../lib/calendar';
import { EVENT_COLORS, holidayFor, stickerById } from '../lib/data';
import type { CalendarEvent, PlacedSticker } from '../lib/types';
import StickerCanvas from './StickerCanvas';
import { formatTime } from './Sidebar';

interface Props {
  selected: string;
  setSelected: (iso: string) => void;
  events: CalendarEvent[];
  stickers: PlacedSticker[];
  editableStickers: boolean;
  selectedSticker: string | null;
  onSelectSticker: (id: string | null) => void;
  onUpdateSticker: (id: string, patch: Partial<PlacedSticker>) => void;
  onRemoveSticker: (id: string) => void;
  onOpenEvent: (ev: CalendarEvent) => void;
  onAddEvent: (iso: string) => void;
}

function shift(iso: string, delta: number) {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta));
}

export default function DayView({
  selected,
  setSelected,
  events,
  stickers,
  editableStickers,
  selectedSticker,
  onSelectSticker,
  onUpdateSticker,
  onRemoveSticker,
  onOpenEvent,
  onAddEvent,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const date = fromISO(selected);
  const holiday = holidayFor(selected);
  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => e.date === selected)
        .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')),
    [events, selected],
  );
  const dayStickers = stickers.filter((s) => s.date === selected);

  return (
    <div className="calendar-wrap">
      <div className="month-head-strip">
        <button className="icon-btn" aria-label="Previous day" onClick={() => setSelected(shift(selected, -1))}>
          <ChevronLeft size={16} />
        </button>
        <button className="icon-btn" aria-label="Next day" onClick={() => setSelected(shift(selected, 1))}>
          <ChevronRight size={16} />
        </button>
        <span className="season-pill">
          {relativeDayLabel(selected)} · {WEEKDAYS_LONG[date.getDay()]}
        </span>
        <div className="spacer" />
        <button className="btn btn-primary btn-sm" onClick={() => onAddEvent(selected)}>
          + Event on this day
        </button>
      </div>

      <div className="day-view">
        <div
          className="day-panel"
          ref={panelRef}
          data-sticker-panel="true"
          data-iso={selected}
          onClick={() => onSelectSticker(null)}
        >
          <div className="day-panel-head">
            <div>
              <h2>{formatLongDate(date)}</h2>
              <div className="sub">
                {dayEvents.length} plans · {dayStickers.length} stickers
                {holiday ? ` · ${holiday.glyph} ${holiday.name}` : ''}
              </div>
            </div>
          </div>

          {dayEvents.length === 0 && (
            <div className="empty" style={{ marginBottom: 12 }}>
              <span className="big">🍪</span>
              A blank cookie sheet. Double-click anywhere to pin a plan.
            </div>
          )}

          <div className="agenda-list">
            {dayEvents.map((ev) => {
              const color = EVENT_COLORS[ev.color];
              const st = ev.sticker ? stickerById(ev.sticker) : undefined;
              return (
                <button
                  key={ev.id}
                  className={`agenda-item ${ev.done ? 'done' : ''}`}
                  style={{ ['--chip-dot' as string]: color.dot, ['--chip-soft' as string]: color.soft }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEvent(ev);
                  }}
                >
                  <span className="time">{ev.time ? formatTime(ev.time) : 'All day'}</span>
                  <span className="bubble" />
                  <span className="body">
                    <span className="title">{ev.title}</span>
                    {ev.notes && <span className="notes">{ev.notes}</span>}
                  </span>
                  {st?.kind === 'art' && st.src ? (
                    <img className="sticker-mini" src={st.src} alt="" />
                  ) : st ? (
                    <span aria-hidden style={{ fontSize: 20 }}>
                      {st.glyph}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <StickerCanvas
            stickers={dayStickers}
            containerRef={panelRef}
            unit={1}
            editable={editableStickers}
            selectedId={selectedSticker}
            onSelect={onSelectSticker}
            onUpdate={onUpdateSticker}
            onRemove={onRemoveSticker}
          />
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <span aria-hidden>🎀</span>
              <span className="card-title">Day Stickers</span>
            </div>
            <div className="card-body">
              {dayStickers.length === 0 ? (
                <div className="empty">No stickers on this day yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {dayStickers.map((s) => {
                    const st = stickerById(s.stickerId);
                    if (!st) return null;
                    return (
                      <div key={s.id} className="country" style={{ borderStyle: 'solid' }}>
                        {st.kind === 'art' && st.src ? (
                          <img src={st.src} alt="" width={34} height={34} style={{ objectFit: 'contain' }} />
                        ) : (
                          <span aria-hidden style={{ fontSize: 22 }}>{st.glyph}</span>
                        )}
                        <div className="meta">
                          <div className="label">{st.name}</div>
                          <div className="sub">
                            {Math.round(s.x)}% / {Math.round(s.y)}% · {s.scale.toFixed(2)}× · {s.rotation}°
                          </div>
                        </div>
                        <button
                          className="btn btn-sm btn-ghost"
                          aria-label={`Remove ${st.name}`}
                          onClick={() => onRemoveSticker(s.id)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <span aria-hidden>🧾</span>
              <span className="card-title">Day Sheet</span>
            </div>
            <div className="card-body">
              <div className="stats">
                <div className="stat">
                  <span className="glyph">⏰</span>
                  <div>
                    <b>{dayEvents.filter((e) => e.time).length}</b>
                    <span>Scheduled times</span>
                  </div>
                </div>
                <div className="stat">
                  <span className="glyph">✅</span>
                  <div>
                    <b>{dayEvents.filter((e) => e.done).length}</b>
                    <span>Completed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
