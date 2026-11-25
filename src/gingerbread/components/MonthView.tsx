import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Trash2 } from 'lucide-react';
import { WEEKDAYS, daysInMonthGrid, monthLabel, seasonName } from '../lib/calendar';
import { EVENT_COLORS, holidayFor, stickerById } from '../lib/data';
import type { CalendarEvent, MonthRef, PlacedSticker, WeekStart } from '../lib/types';
import StickerCanvas from './StickerCanvas';

interface Props {
  current: MonthRef;
  events: CalendarEvent[];
  stickers: PlacedSticker[];
  selected: string;
  today: Date;
  weekStartsOn: WeekStart;
  showHolidays: boolean;
  editableStickers: boolean;
  selectedSticker: string | null;
  onSelectSticker: (id: string | null) => void;
  onUpdateSticker: (id: string, patch: Partial<PlacedSticker>) => void;
  onRemoveSticker: (id: string) => void;
  onSelectDay: (iso: string) => void;
  onAddEvent: (iso: string) => void;
  onOpenEvent: (ev: CalendarEvent) => void;
  onClearStickers: () => void;
  onShuffleStickers: () => void;
  onToggleEditable: () => void;
}

const MAX_CHIPS = 3;

function orderedWeekdays(weekStartsOn: WeekStart) {
  const list = [...WEEKDAYS];
  return weekStartsOn === 1 ? [...list.slice(1), list[0]] : list;
}

export default function MonthView({
  current,
  events,
  stickers,
  selected,
  today,
  weekStartsOn,
  showHolidays,
  editableStickers,
  selectedSticker,
  onSelectSticker,
  onUpdateSticker,
  onRemoveSticker,
  onSelectDay,
  onAddEvent,
  onOpenEvent,
  onClearStickers,
  onShuffleStickers,
  onToggleEditable,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const weeks = useMemo(() => daysInMonthGrid(current, weekStartsOn), [current, weekStartsOn]);
  const cells = useMemo(() => weeks.flat(), [weeks]);
  const dows = orderedWeekdays(weekStartsOn);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date);
      if (list) list.push(ev);
      else map.set(ev.date, [ev]);
    }
    for (const list of map.values())
      list.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
    return map;
  }, [events]);

  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => setExpanded(null), [current.year, current.month]);

  const monthStickerCount = stickers.filter((s) =>
    s.date.startsWith(`${current.year}-${String(current.month + 1).padStart(2, '0')}`),
  ).length;

  return (
    <div className="calendar-wrap">
      <div className="pinboard" style={{ minHeight: 196 }}>
        <div className="pinboard-art" style={{ backgroundImage: 'url(/img/poster.jpg)' }} />
        <div className="pinboard-shade" />
        <div className="pinboard-copy">
          <div className="eyebrow">Gingerbread season · {seasonName(current.month)}</div>
          <h2>
            {monthLabel(current)} is one big cookie sheet
          </h2>
          <p>
            {monthStickerCount} stickers pinned · {events.filter((e) => e.date.startsWith(`${current.year}-${String(current.month + 1).padStart(2, '0')}`)).length} plans.
            Drag Starr Nova onto any date to make it a gingerbread day.
          </p>
        </div>
        <div className="pinboard-badge">🍪 Gingerbread Starr Nova</div>
      </div>

      <div className="month-head-strip">
        <span className="season-pill">
          <span aria-hidden>🍪</span> {monthLabel(current)}
        </span>
        <span className="muted" style={{ fontSize: 11.5 }}>
          {cells.filter((c) => c.inCurrentMonth).length} days
        </span>
        <div className="spacer" />
        <div className="canvas-tools" style={{ padding: '5px 9px', border: '2px solid var(--cookie-200)', background: '#fffdf8' }}>
          <span className="hint">Stickers</span>
          <button
            className={`btn btn-sm ${editableStickers ? 'btn-pine' : ''}`}
            onClick={onToggleEditable}
            title={editableStickers ? 'Lock stickers in place' : 'Unlock stickers to drag them'}
          >
            {editableStickers ? 'Editing' : 'Locked'}
          </button>
          <button className="btn btn-sm" onClick={onShuffleStickers} title="Scatter this month's stickers">
            <RotateCcw size={12} /> Scatter
          </button>
          <button className="btn btn-sm" onClick={onClearStickers} title="Remove stickers in this month">
            <Trash2 size={12} /> Clear
          </button>
        </div>
      </div>

      <div className="month-canvas-wrap">
        <div className="dow-row" role="row">
          {dows.map((d, i) => (
            <div key={d} className={`dow ${i === 0 || i === 6 ? 'weekend' : ''}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="month-canvas" ref={canvasRef} role="grid" aria-label={`${monthLabel(current)} days`}>
          {cells.map((day) => {
            const list = byDate.get(day.iso) ?? [];
            const holiday = showHolidays ? holidayFor(day.iso) : undefined;
            const visible = expanded === day.iso ? list : list.slice(0, MAX_CHIPS);
            const hidden = list.length - visible.length;
            const dayStickers = stickers.filter((s) => s.date === day.iso);
            return (
              <div
                key={day.iso}
                data-iso={day.iso}
                className={[
                  'day',
                  day.inCurrentMonth ? '' : 'out',
                  day.isWeekend ? 'weekend' : '',
                  day.isToday ? 'today' : '',
                  day.iso === selected ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelectDay(day.iso)}
                onDoubleClick={() => onAddEvent(day.iso)}
                role="gridcell"
                aria-label={`${day.iso}, ${list.length} events`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onAddEvent(day.iso);
                  if (e.key === ' ') {
                    e.preventDefault();
                    onSelectDay(day.iso);
                  }
                }}
              >
                <div className="day-top">
                  <span className="day-num">{day.dayOfMonth}</span>
                  {holiday && (
                    <span className="day-flag" title={holiday.name}>
                      {holiday.glyph}
                    </span>
                  )}
                </div>
                {holiday && <div className="day-holiday">{holiday.name}</div>}
                <div className="day-events">
                  {visible.map((ev) => {
                    const color = EVENT_COLORS[ev.color];
                    const st = ev.sticker ? stickerById(ev.sticker) : undefined;
                    return (
                      <button
                        key={ev.id}
                        className={`chip ${ev.done ? 'done' : ''}`}
                        style={{
                          ['--chip-dot' as string]: color.dot,
                          ['--chip-soft' as string]: color.soft,
                          ['--chip-ink' as string]: color.ink,
                        }}
                        title={ev.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEvent(ev);
                        }}
                      >
                        {st && <span aria-hidden style={{ fontSize: 11 }}>{st.kind === 'art' ? '🍪' : st.glyph}</span>}
                        {ev.time && <span className="t">{ev.time}</span>}
                        <span className="n">{ev.title}</span>
                      </button>
                    );
                  })}
                  {hidden > 0 && (
                    <button
                      className="more"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(day.iso);
                      }}
                    >
                      +{hidden} more
                    </button>
                  )}
                  {expanded === day.iso && list.length > MAX_CHIPS && (
                    <button
                      className="more"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(null);
                      }}
                    >
                      <ChevronUp size={10} style={{ verticalAlign: -1 }} /> less
                    </button>
                  )}
                </div>
                <button
                  className="add-hint"
                  aria-label={`Add event on ${day.iso}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEvent(day.iso);
                  }}
                >
                  +
                </button>
                {dayStickers.length > 0 && (
                  <span className="sr-only">{dayStickers.length} stickers</span>
                )}
              </div>
            );
          })}
          <StickerCanvas
            stickers={stickers.filter((s) =>
              s.date.startsWith(`${current.year}-${String(current.month + 1).padStart(2, '0')}`),
            )}
            containerRef={canvasRef}
            unit={1}
            editable={editableStickers}
            selectedId={selectedSticker}
            onSelect={onSelectSticker}
            onUpdate={onUpdateSticker}
            onRemove={onRemoveSticker}
            className="on-canvas"
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="muted" style={{ fontSize: 11.5 }}>
          Tip: double-click a day to pin an event · drag stickers while editing is unlocked.
        </span>
        <button className="btn btn-sm" onClick={() => setExpanded(null)} disabled={!expanded}>
          <ChevronDown size={12} /> Collapse lists
        </button>
      </div>
    </div>
  );
}
