import { useMemo } from 'react';
import { MONTH_NAMES, formatLongDate, formatShortDate, fromISO, monthLabel, relativeDayLabel, toISO } from '../lib/calendar';
import { EVENT_COLORS, stickerById } from '../lib/data';
import type { CalendarEvent, MonthRef } from '../lib/types';

interface Props {
  current: MonthRef;
  events: CalendarEvent[];
  onOpenEvent: (ev: CalendarEvent) => void;
  onSelectDay: (iso: string) => void;
}

export default function AgendaView({ current, events, onOpenEvent, onSelectDay }: Props) {
  const todayISO = useMemo(() => toISO(new Date()), []);
  const prefix = `${current.year}-${String(current.month + 1).padStart(2, '0')}`;

  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      if (!ev.date.startsWith(prefix)) continue;
      const list = map.get(ev.date);
      if (list) list.push(ev);
      else map.set(ev.date, [ev]);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([iso, list]) => [
        iso,
        list.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99')),
      ]) as [string, CalendarEvent[]][];
  }, [events, prefix]);

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.date >= todayISO)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5),
    [events, todayISO],
  );

  return (
    <div className="calendar-wrap">
      <div className="month-head-strip">
        <span className="season-pill">📋 Agenda — {monthLabel(current)}</span>
        <span className="smallcaps">{groups.length} days with plans</span>
      </div>

      {groups.length === 0 ? (
        <div className="empty" style={{ padding: 40 }}>
          <span className="big">🍽️</span>
          An empty tray for {MONTH_NAMES[current.month]}. Add an event to start plating.
        </div>
      ) : (
        <div className="agenda-groups">
          {groups.map(([iso, list]) => (
            <section className="agenda-group" key={iso}>
              <div className="agenda-group-head">
                <span aria-hidden style={{ fontSize: 18 }}>🗓️</span>
                <h3>{formatLongDate(fromISO(iso))}</h3>
                <span className="count">
                  {relativeDayLabel(iso)} · {list.length} item{list.length > 1 ? 's' : ''}
                </span>
                <button className="btn btn-sm btn-ghost" onClick={() => onSelectDay(iso)}>
                  Open day →
                </button>
              </div>
              <div className="agenda-group-body">
                {list.map((ev) => {
                  const color = EVENT_COLORS[ev.color];
                  const st = ev.sticker ? stickerById(ev.sticker) : undefined;
                  return (
                    <button
                      key={ev.id}
                      className={`agenda-item ${ev.done ? 'done' : ''}`}
                      style={{ ['--chip-dot' as string]: color.dot, ['--chip-soft' as string]: color.soft }}
                      onClick={() => onOpenEvent(ev)}
                    >
                      <span className="time">{ev.time ?? 'All day'}</span>
                      <span className="bubble" />
                      <span className="body">
                        <span className="title">{ev.title}</span>
                        {ev.notes && <span className="notes">{ev.notes}</span>}
                      </span>
                      {st?.kind === 'art' && st.src ? (
                        <img className="sticker-mini" src={st.src} alt="" />
                      ) : st ? (
                        <span aria-hidden style={{ fontSize: 18 }}>{st.glyph}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <span aria-hidden>🔜</span>
          <span className="card-title">Next up, regardless of month</span>
        </div>
        <div className="card-body" style={{ display: 'grid', gap: 7 }}>
          {upcoming.length === 0 && <div className="empty">Nothing ahead. Suspiciously calm.</div>}
          {upcoming.map((ev) => (
            <button key={ev.id} className="agenda-item" style={{ padding: '8px 10px' }} onClick={() => onOpenEvent(ev)}>
              <span className="time">{formatShortDate(ev.date)}</span>
              <span className="body">
                <span className="title">{ev.title}</span>
              </span>
              <span className="smallcaps">{relativeDayLabel(ev.date)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
