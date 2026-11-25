import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEKDAYS_LONG, fromISO, monthLabel, relativeDayLabel, toISO } from '../lib/calendar';
import { EVENT_COLORS } from '../lib/data';
import type { CalendarEvent } from '../lib/types';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am - 9pm

function addDaysISO(iso: string, delta: number): string {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta));
}

function startOfWeekISO(iso: string, weekStartsOn: 0 | 1): string {
  const d = fromISO(iso);
  const shift = (d.getDay() - weekStartsOn + 7) % 7;
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - shift));
}

function timeToMinutes(t?: string): number {
  if (!t) return -1;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

interface Props {
  selected: string;
  setSelected: (iso: string) => void;
  weekStartsOn: 0 | 1;
  events: CalendarEvent[];
  onOpenEvent: (ev: CalendarEvent) => void;
  onAddEvent: (iso: string, time?: string) => void;
}

export default function WeekView({ selected, setSelected, weekStartsOn, events, onOpenEvent, onAddEvent }: Props) {
  const days = useMemo(() => {
    const start = startOfWeekISO(selected, weekStartsOn);
    return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  }, [selected, weekStartsOn]);

  const todayISO = useMemo(() => toISO(new Date()), []);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowHour = Math.floor(nowMinutes / 60);
  const nowPct = (nowMinutes % 60) / 60;

  const allDay = (iso: string) => events.filter((e) => e.date === iso && !e.time);
  const timed = (iso: string) => events.filter((e) => e.date === iso && e.time);

  const monthSpan = useMemo(() => {
    const first = fromISO(days[0]);
    const last = fromISO(days[6]);
    const a = `${monthLabel({ year: first.getFullYear(), month: first.getMonth() })}`;
    const b = `${monthLabel({ year: last.getFullYear(), month: last.getMonth() })}`;
    return a === b ? a : `${a.split(' ')[0]} – ${b}`;
  }, [days]);

  return (
    <div className="calendar-wrap">
      <div className="month-head-strip">
        <span className="season-pill">Week of {relativeDayLabel(days[0], new Date())}</span>
        <span className="smallcaps">{monthSpan}</span>
        <div className="spacer" />
        <button className="icon-btn" aria-label="Previous week" onClick={() => setSelected(addDaysISO(selected, -7))}>
          <ChevronLeft size={16} />
        </button>
        <button className="icon-btn" aria-label="Next week" onClick={() => setSelected(addDaysISO(selected, 7))}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="week-grid">
        <div className="week-head">
          <div style={{ display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, color: 'var(--cookie-400)' }}>
            TIME
          </div>
          {days.map((iso) => {
            const d = fromISO(iso);
            return (
              <div key={iso} className={iso === todayISO ? 'is-today' : ''}>
                <div className="wg-day">{WEEKDAYS_LONG[d.getDay()].slice(0, 3)}</div>
                <div className="wg-num">{d.getDate()}</div>
                <button className="btn btn-sm btn-ghost" style={{ padding: '0 4px', fontSize: 10 }} onClick={() => onAddEvent(iso)}>
                  + add
                </button>
              </div>
            );
          })}
        </div>

        {allDay(days[0]).length + allDay(days[1]).length + allDay(days[2]).length + allDay(days[3]).length + allDay(days[4]).length + allDay(days[5]).length + allDay(days[6]).length > 0 && (
          <>
            <div className="hour-label" style={{ fontSize: 9, paddingTop: 8 }}>ALL DAY</div>
            {days.map((iso) => (
              <div key={`ad-${iso}`} className="hour-cell" style={{ minHeight: 34, padding: 3, background: 'rgba(253,241,223,0.5)' }}>
                {allDay(iso).map((ev) => {
                  const color = EVENT_COLORS[ev.color];
                  return (
                    <button
                      key={ev.id}
                      className="week-event"
                      style={{
                        position: 'static',
                        display: 'block',
                        width: '100%',
                        marginBottom: 3,
                        ['--chip-dot' as string]: color.dot,
                        ['--chip-soft' as string]: color.soft,
                        ['--chip-ink' as string]: color.ink,
                      }}
                      onClick={() => onOpenEvent(ev)}
                    >
                      {ev.title}
                    </button>
                  );
                })}
              </div>
            ))}
          </>
        )}

        {HOURS.map((h) => (
          <div key={h} style={{ display: 'contents' }}>
            <div className="hour-label">{h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}</div>
            {days.map((iso) => (
              <div
                key={`${iso}-${h}`}
                className={`hour-cell week-daycol ${iso === todayISO ? 'is-today' : ''}`}
                onDoubleClick={() => onAddEvent(iso, `${String(h).padStart(2, '0')}:00`)}
                title={`Double-click to add at ${h}:00`}
              >
                {timed(iso)
                      .filter((ev) => {
                        const m = timeToMinutes(ev.time);
                        return m >= h * 60 && m < (h + 1) * 60;
                      })
                      .map((ev) => {
                        const color = EVENT_COLORS[ev.color];
                        const start = timeToMinutes(ev.time);
                        const end = ev.endTime ? timeToMinutes(ev.endTime) : start + 60;
                        const top = ((start - h * 60) / 60) * 100;
                        const height = Math.max(24, ((end - start) / 60) * 100);
                        return (
                          <button
                            key={ev.id}
                            className="week-event"
                            style={{
                              top: `${top}%`,
                              height: `calc(${height}% - 4px)`,
                              ['--chip-dot' as string]: color.dot,
                              ['--chip-soft' as string]: color.soft,
                              ['--chip-ink' as string]: color.ink,
                            }}
                            onClick={() => onOpenEvent(ev)}
                          >
                            <b>{ev.time}</b>
                            {ev.title}
                          </button>
                        );
                      })
                    }
                {iso === todayISO && h === nowHour && nowMinutes >= HOURS[0] * 60 && nowMinutes < (HOURS[HOURS.length - 1] + 1) * 60 && (
                  <div className="now-line" style={{ top: `${nowPct * 100}%` }} />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { addDaysISO, startOfWeekISO, timeToMinutes, HOURS };
