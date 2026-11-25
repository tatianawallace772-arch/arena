import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  WEEKDAYS,
  addMonths,
  daysUntilGingerbreadSeason,
  monthFromIndex,
  monthGrid,
  monthLabel,
  monthIndexFromAnchor,
  relativeDayLabel,
  seasonName,
  toISO,
} from '../lib/calendar';
import { EVENT_COLORS, holidayFor, stickerById } from '../lib/data';
import type { CalendarEvent, Countdown, MonthRef, PlacedSticker } from '../lib/types';
import { StickerGlyph } from './StickerGlyph';

const DOW_BASE = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  current: MonthRef;
  setCurrent: (m: MonthRef) => void;
  selected: string;
  setSelected: (iso: string) => void;
  events: CalendarEvent[];
  stickers: PlacedSticker[];
  countdowns: Countdown[];
  onAddCountdown: () => void;
  onRemoveCountdown: (id: string) => void;
  weekStartsOn: 0 | 1;
}

export default function Sidebar({
  current,
  setCurrent,
  selected,
  setSelected,
  events,
  stickers,
  countdowns,
  onAddCountdown,
  onRemoveCountdown,
  weekStartsOn,
}: Props) {
  const today = useMemo(() => new Date(), []);
  const mini = useMemo(() => monthGrid(current, today, weekStartsOn), [current, today, weekStartsOn]);
  const miniIndex = monthIndexFromAnchor(current.year, current.month);
  const prev = monthFromIndex(miniIndex - 1);
  const next = monthFromIndex(miniIndex + 1);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date);
      if (list) list.push(ev);
      else map.set(ev.date, [ev]);
    }
    return map;
  }, [events]);

  const stickerByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stickers) map.set(s.date, (map.get(s.date) ?? 0) + 1);
    return map;
  }, [stickers]);

  const monthEvents = useMemo(
    () => events.filter((e) => e.date.startsWith(`${current.year}-${String(current.month + 1).padStart(2, '0')}`)),
    [events, current],
  );

  const season = daysUntilGingerbreadSeason(today);
  const upcoming = useMemo(() => {
    const todayISO = toISO(today);
    return [...events]
      .filter((e) => !e.done && e.date >= todayISO)
      .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
      .slice(0, 3);
  }, [events, today]);

  const eventsThisMonth = monthEvents.length;
  const stickersThisMonth = stickers.filter((s) =>
    s.date.startsWith(`${current.year}-${String(current.month + 1).padStart(2, '0')}`),
  ).length;
  const doneThisMonth = monthEvents.filter((e) => e.done).length;
  const busiestDay = useMemo(() => {
    let best = { iso: '', count: 0 };
    for (const [iso, list] of byDate) {
      if (!iso.startsWith(`${current.year}-${String(current.month + 1).padStart(2, '0')}`)) continue;
      if (list.length > best.count) best = { iso, count: list.length };
    }
    return best;
  }, [byDate, current]);

  return (
    <aside className="rail">
      <div className="card">
        <div className="card-head">
          <span aria-hidden>🗓️</span>
          <span className="card-title">Month Map</span>
        </div>
        <div className="mini-month">
          <div className="mini-head">
            <button className="icon-btn" style={{ width: 26, height: 26, borderRadius: 9 }} aria-label="Previous month" onClick={() => setCurrent(prev)}>
              <ChevronLeft size={14} />
            </button>
            <span>{monthLabel(current)}</span>
            <button className="icon-btn" style={{ width: 26, height: 26, borderRadius: 9 }} aria-label="Next month" onClick={() => setCurrent(next)}>
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="mini-grid">
            {(weekStartsOn === 1 ? [...DOW_BASE.slice(1), DOW_BASE[0]] : DOW_BASE).map((d, i) => (
              <div className="mini-dow" key={`${d}-${i}`}>
                {d}
              </div>
            ))}
            {mini.slice(0, 42).map((day) => {
              const count = byDate.get(day.iso)?.length ?? 0;
              const dot = stickerByDate.get(day.iso) ?? 0;
              return (
                <button
                  key={day.iso}
                  className={[
                    'mini-day',
                    day.inCurrentMonth ? '' : 'out',
                    day.isToday ? 'today' : '',
                    day.iso === selected ? 'selected' : '',
                    count ? 'has-events' : '',
                    holidayFor(day.iso) ? 'holiday' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={`${day.iso}${count ? ` · ${count} event${count > 1 ? 's' : ''}` : ''}${
                    dot ? ` · ${dot} sticker${dot > 1 ? 's' : ''}` : ''
                  }`}
                  onClick={() => {
                    setSelected(day.iso);
                    if (!day.inCurrentMonth) setCurrent({ year: day.date.getFullYear(), month: day.date.getMonth() });
                  }}
                >
                  {day.dayOfMonth}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span aria-hidden>🍪</span>
          <span className="card-title">{seasonName(current.month)}</span>
          <span className="spacer" />
          <span className="smallcaps">{monthLabel(current)}</span>
        </div>
        <div className="card-body">
          <div className="stats">
            <div className="stat">
              <span className="glyph" aria-hidden>📌</span>
              <div>
                <b>{eventsThisMonth}</b>
                <span>Events · {doneThisMonth} done</span>
              </div>
            </div>
            <div className="stat">
              <span className="glyph" aria-hidden>✨</span>
              <div>
                <b>{stickersThisMonth}</b>
                <span>Stickers on the calendar</span>
              </div>
            </div>
            <div className="stat">
              <span className="glyph" aria-hidden>🎂</span>
              <div>
                <b style={{ fontSize: 13 }}>
                  {season.inSeason ? `Season! ${season.days}d left` : `${season.days} days`}
                </b>
                <span>Until gingerbread season</span>
              </div>
            </div>
            {busiestDay.iso && (
              <div className="stat">
                <span className="glyph" aria-hidden>🔥</span>
                <div>
                  <b style={{ fontSize: 13 }}>{busiestDay.count} on the {Number(busiestDay.iso.slice(-2))}th</b>
                  <span>Busiest day this month</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span aria-hidden>⏳</span>
          <span className="card-title">Cookie Countdowns</span>
          <span className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={onAddCountdown} title="Add a countdown">
            + Add
          </button>
        </div>
        <div className="card-body">
          <div className="countdown">
            {countdowns.length === 0 && <div className="empty">No countdowns yet 🍪</div>}
            {countdowns.map((c) => {
              const diff = Math.round(
                (new Date(c.date + 'T00:00:00').getTime() -
                  new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
                  86_400_000,
              );
              return (
                <div className={`country ${diff < 0 ? 'past' : ''}`} key={c.id}>
                  <span className="emoji" aria-hidden>
                    {c.emoji}
                  </span>
                  <div className="meta">
                    <div className="label">{c.label}</div>
                    <div className="sub">{relativeDayLabel(c.date, today)}</div>
                  </div>
                  <div className="days">
                    {diff < 0 ? '✓' : diff}
                    <small>{diff < 0 ? 'was' : 'days'}</small>
                  </div>
                  <button
                    className="btn btn-sm btn-ghost"
                    aria-label={`Remove ${c.label} countdown`}
                    onClick={() => onRemoveCountdown(c.id)}
                    style={{ padding: '2px 6px' }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span aria-hidden>🕯️</span>
          <span className="card-title">Coming Up</span>
        </div>
        <div className="card-body">
          {upcoming.length === 0 ? (
            <div className="empty">Nothing scheduled — add something sweet.</div>
          ) : (
            <div className="agenda-list" style={{ gap: 7 }}>
              {upcoming.map((ev) => {
                const color = EVENT_COLORS[ev.color];
                const st = ev.sticker ? stickerById(ev.sticker) : undefined;
                return (
                  <button
                    key={ev.id}
                    className="agenda-item"
                    style={{
                      padding: '8px 10px',
                      ['--chip-dot' as string]: color.dot,
                      ['--chip-soft' as string]: color.soft,
                    }}
                    onClick={() => {
                      const d = new Date(ev.date + 'T00:00:00');
                      setSelected(ev.date);
                      setCurrent({ year: d.getFullYear(), month: d.getMonth() });
                    }}
                  >
                    <span className="bubble" style={{ background: color.dot, boxShadow: `0 0 0 3px ${color.soft}` }} />
                    <div className="body">
                      <div className="title">{ev.title}</div>
                      <div className="notes">
                        {relativeDayLabel(ev.date, today)}
                        {ev.time ? ` · ${formatTime(ev.time)}` : ''}
                      </div>
                    </div>
                    {st && st.kind === 'art' && st.src ? (
                      <img className="sticker-mini" src={st.src} alt="" />
                    ) : st ? (
                      <span aria-hidden style={{ fontSize: 18 }}>{st.glyph}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="pinboard" style={{ borderRadius: 0, border: 0, boxShadow: 'none', minHeight: 168 }}>
          <div className="pinboard-art" style={{ backgroundImage: 'url(/img/poster.jpg)' }} />
          <div className="pinboard-shade" />
          <div className="pinboard-copy" style={{ padding: '14px 16px', maxWidth: '82%' }}>
            <div className="eyebrow">Featured sticker</div>
            <h2 style={{ fontSize: 18 }}>Gingerbread Starr Nova</h2>
            <p style={{ fontSize: 11 }}>Two poses, endless days. Drag her onto any date.</p>
          </div>
          <div className="pinboard-badge">Poster · Dec 19</div>
        </div>
      </div>
    </aside>
  );
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

export { formatTime, WEEKDAYS };
