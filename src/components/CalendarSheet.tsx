import { useMemo } from 'react';
import DayCell from './DayCell';
import MonthDecorations from './MonthDecorations';
import { Emoji } from './Emoji';
import { MONTHS, monthMatrix, weekdayLabels, keyOf, longDate } from '../lib/dates';
import { holidaysForYear, holidaysInMonth, upcomingHolidays, daysUntilHoliday } from '../lib/holidays';
import type { CalendarState, Placement } from '../lib/types';
import { monthKeyOf } from '../lib/types';

type Props = {
  year: number;
  month: number;
  state: CalendarState;
  selectedDay: string | null;
  editingDecorations: boolean;
  freshMascot: string | null;
  onSelectDay: (date: Date) => void;
  onSelectMonth: () => void;
  onDecorationsChange: (next: Placement[]) => void;
  onSelectHoliday: (key: string) => void;
};

export default function CalendarSheet({
  year,
  month,
  state,
  selectedDay,
  editingDecorations,
  freshMascot,
  onSelectDay,
  onSelectMonth,
  onDecorationsChange,
  onSelectHoliday,
}: Props) {
  const { settings } = state;
  const rows = useMemo(
    () => monthMatrix(year, month, settings.weekStart),
    [year, month, settings.weekStart],
  );
  const labels = weekdayLabels(settings.weekStart);
  const holidayMap = useMemo(() => holidaysForYear(year), [year]);
  const monthHolidays = useMemo(() => holidaysInMonth(year, month), [year, month]);
  const upcoming = useMemo(() => upcomingHolidays(new Date(), 5), []);
  const deco = state.months[monthKeyOf(year, month)]?.decorations ?? [];
  const today = new Date();
  const todayKeyStr = keyOf(today);
  const nextHoliday = upcoming[0];
  const upcomingInMonth = (key: string) =>
    key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);

  // hide empty trailing weeks so the page feels tight
  const visibleRows = useMemo(() => {
    let last = 0;
    rows.forEach((row, i) => {
      if (row.some((d) => d.getMonth() === month)) last = i;
    });
    return rows.slice(0, Math.max(last + 1, 5));
  }, [rows, month]);

  return (
    <section className="calendar-sheet" aria-label={`${MONTHS[month]} ${year} calendar`}>
      <div className="sheet-lace" aria-hidden="true" />
      <MonthDecorations
        placements={deco}
        onChange={onDecorationsChange}
        freshId={freshMascot}
        active={editingDecorations}
      />

      <div className="sheet-head">
        <div className="sheet-title">
          <button className="sheet-month" onClick={onSelectMonth} title="Month options & styling">
            {MONTHS[month]}
          </button>
          <span className="sheet-year">{year}</span>
        </div>
        <div className="sheet-meta">
          {monthHolidays.slice(0, 3).map(({ key, holiday }) => (
            <button key={key} className={`pill ${holiday.tone}`} onClick={() => onSelectHoliday(key)}>
              <Emoji name={holiday.emoji} size={14} />
              {holiday.label}
            </button>
          ))}
          {monthHolidays.length === 0 && settings.showHolidays && (
            <span className="pill">
              <Emoji name="leaf" size={13} /> A calm month — no holidays
            </span>
          )}
          {editingDecorations && (
            <button
              className="pill red"
              onClick={() => onDecorationsChange([])}
              title="Remove all mascot decorations"
            >
              <Emoji name="teddy" size={13} /> {deco.length} mascots · clear
            </button>
          )}
        </div>
      </div>

      <div className="grid-wrap">
        <div className="weekday-row" aria-hidden="true">
          {labels.map((l, i) => (
            <span
              key={l}
              className={`weekday${
                (settings.weekStart === 0 && (i === 0 || i === 6)) ||
                (settings.weekStart === 1 && (i === 5 || i === 6))
                  ? ' weekend'
                  : ''
              }`}
            >
              {l}
            </span>
          ))}
        </div>

        <div className="month-grid" role="grid" aria-label="Days">
          {visibleRows.flat().map((date) => {
            const key = keyOf(date);
            const inMonth = date.getMonth() === month && date.getFullYear() === year;
            const holiday = settings.showHolidays ? holidayMap[key] : undefined;
            const countdown = holiday && inMonth ? daysUntilHoliday(key, today) : undefined;
            return (
              <DayCell
                key={key}
                date={date}
                entry={state.days[key] ?? { stickers: [], done: false }}
                holiday={holiday}
                inMonth={inMonth}
                isToday={key === todayKeyStr}
                selected={key === selectedDay}
                showHolidays={settings.showHolidays}
                showNotes={settings.showNotes}
                countdown={countdown}
                onSelect={onSelectDay}
              />
            );
          })}
        </div>
      </div>

      <div className="sheet-foot">
        {settings.showLegend ? (
          <div className="legend">
            <span>
              <i className="legend-dot" /> Today
            </span>
            <span>
              <i className="legend-dot gold" /> Note
            </span>
            <span>
              <i className="legend-dot holly" /> Done
            </span>
            <span>
              <Emoji name="teddy" size={13} /> Drag mascots when decorating
            </span>
          </div>
        ) : (
          <span />
        )}

        <div className="holiday-strip">
          {upcoming
            .filter(({ key }) => !upcomingInMonth(key))
            .slice(0, 3)
            .map(({ key, holiday }) => {
              const until = daysUntilHoliday(key, today);
              return (
                <button key={key} className="holiday-chip" onClick={() => onSelectHoliday(key)}>
                  <Emoji name={holiday.emoji} size={14} />
                  {holiday.short}
                  <small>{until <= 0 ? 'soon' : until === 1 ? 'tomorrow' : `in ${until}d`}</small>
                </button>
              );
            })}
          {nextHoliday && (
            <span className="pill gold" title={longDate(nextHoliday.key)}>
              <Emoji name="calendar" size={13} /> next: {nextHoliday.holiday.short}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
