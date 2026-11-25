import { useMemo } from 'react';
import { MONTH_NAMES, monthFromIndex, monthIndexFromAnchor, monthLabel, monthGrid, toISO } from '../lib/calendar';
import { holidayFor } from '../lib/data';
import type { CalendarEvent, MonthRef } from '../lib/types';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  year: number;
  events: CalendarEvent[];
  onPickMonth: (m: MonthRef) => void;
}

export default function YearView({ year, events, onPickMonth }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISO(today);
  const currentMonth = today.getFullYear() === year ? today.getMonth() : -1;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) map.set(ev.date, (map.get(ev.date) ?? 0) + 1);
    return map;
  }, [events]);

  return (
    <div className="calendar-wrap">
      <div className="month-head-strip">
        <span className="season-pill">🍪 The whole cookie year — {year}</span>
        <span className="smallcaps">{events.filter((e) => e.date.startsWith(String(year))).length} plans in {year}</span>
      </div>
      <div className="year-grid">
        {MONTH_NAMES.map((name, month) => {
          const ref = { year, month };
          const cells = monthGrid(ref, today);
          const monthCount = events.filter((e) => e.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;
          return (
            <button
              key={name}
              className={`year-month ${month === currentMonth ? 'is-current' : ''}`}
              onClick={() => onPickMonth(monthFromIndex(monthIndexFromAnchor(year, month)))}
              aria-label={`Open ${monthLabel(ref)}`}
            >
              <div className="year-month-head">
                <h3>{name}</h3>
                <span className="mini-count">{monthCount ? `${monthCount} ·` : ''} {monthCount ? '🍪' : ''}</span>
              </div>
              <div className="year-dows">
                {DOW.map((d, i) => (
                  <span key={`${d}${i}`}>{d}</span>
                ))}
              </div>
              <div className="year-days">
                {cells.slice(0, 42).map((day) => (
                  <span
                    key={day.iso}
                    className={[
                      'year-day',
                      day.inCurrentMonth ? '' : 'out',
                      day.iso === todayISO ? 'today' : '',
                      counts.get(day.iso) ? 'has-event' : '',
                      holidayFor(day.iso) ? 'holiday' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={holidayFor(day.iso)?.name ?? day.iso}
                  >
                    {day.dayOfMonth}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
