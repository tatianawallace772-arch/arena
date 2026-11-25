// Date helpers for the Gingerbread Calendar. Everything is local-time and
// month-indexed from a single anchor month so the calendar can run for years.

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** First month of the calendar grid: 12 months of the gingerbread year. */
export const ANCHOR_YEAR = 2026;
export const ANCHOR_MONTH = 0; // January
export const MONTH_COUNT = 12;

export interface MonthRef {
  year: number;
  month: number; // 0-11
}

export interface CalendarDay {
  date: Date;
  iso: string;
  dayOfMonth: number;
  weekday: number;
  isToday: boolean;
  isWeekend: boolean;
  inCurrentMonth: boolean;
}

export const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function monthIndexFromAnchor(year: number, month: number): number {
  return (year - ANCHOR_YEAR) * 12 + (month - ANCHOR_MONTH);
}

export function monthFromIndex(index: number): MonthRef {
  const total = ANCHOR_MONTH + index;
  return {
    year: ANCHOR_YEAR + Math.floor(total / 12),
    month: ((total % 12) + 12) % 12,
  };
}

export function firstOfMonth({ year, month }: MonthRef): Date {
  return new Date(year, month, 1);
}

/** Six-week grid (42 cells) with leading/trailing days from adjacent months. */
export function monthGrid({ year, month }: MonthRef, today = new Date(), weekStartsOn: 0 | 1 = 0): CalendarDay[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(year, month, 1 - offset);
  const todayISO = toISO(today);
  const cells: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toISO(date);
    cells.push({
      date,
      iso,
      dayOfMonth: date.getDate(),
      weekday: date.getDay(),
      isToday: iso === todayISO,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      inCurrentMonth: date.getMonth() === month && date.getFullYear() === year,
    });
  }
  return cells;
}

export function daysInMonthGrid({ year, month }: MonthRef, weekStartsOn: 0 | 1 = 0): CalendarDay[][] {
  const cells = monthGrid({ year, month }, new Date(), weekStartsOn);
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  // Drop a wholly redundant trailing week so the grid stays tight.
  const last = weeks[weeks.length - 1];
  if (last.every((c) => !c.inCurrentMonth)) weeks.pop();
  return weeks;
}

export function monthLabel({ year, month }: MonthRef): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

export function addMonths(ref: MonthRef, delta: number): MonthRef {
  return monthFromIndex(monthIndexFromAnchor(ref.year, ref.month) + delta);
}

const SEASON_BY_MONTH = [
  'Deep Winter',
  'Frost & Cocoa',
  'Sugar Thaw',
  'Sprinkle Spring',
  'Bloom & Butter',
  'Strawberry Sun',
  'Firefly Nights',
  'Peach Frosting',
  'Spice Harvest',
  'Maple Moon',
  'First Snowfall',
  'Gingerbread Tide',
] as const;

export function seasonName(month: number): string {
  return SEASON_BY_MONTH[month];
}

export function formatLongDate(date: Date): string {
  return `${WEEKDAYS_LONG[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatShortDate(iso: string): string {
  const d = fromISO(iso);
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function relativeDayLabel(iso: string, today = new Date()): string {
  const target = fromISO(iso);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((target.getTime() - base.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -7) return `${-diff} days ago`;
  return formatShortDate(iso);
}

/** Whole days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

/** Countdown to the next gingerbread season (December 1) or the current one. */
export function daysUntilGingerbreadSeason(today = new Date()): { days: number; target: Date; inSeason: boolean } {
  const y = today.getFullYear();
  const seasonStart = new Date(y, 11, 1);
  const seasonEnd = new Date(y, 11, 31);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (base >= seasonStart && base <= seasonEnd) {
    return { days: daysBetween(toISO(base), toISO(seasonEnd)), target: seasonEnd, inSeason: true };
  }
  const next = base < seasonStart ? seasonStart : new Date(y + 1, 11, 1);
  return {
    days: daysBetween(toISO(base), toISO(next)),
    target: next,
    inSeason: false,
  };
}

export function weekdayDatesForMonth({ year, month }: MonthRef, weekday: number): CalendarDay[] {
  const total = daysInMonth(year, month);
  const out: CalendarDay[] = [];
  for (let d = 1; d <= total; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === weekday) {
      const iso = toISO(date);
      out.push({
        date,
        iso,
        dayOfMonth: d,
        weekday,
        isToday: iso === toISO(new Date()),
        isWeekend: weekday === 0 || weekday === 6,
        inCurrentMonth: true,
      });
    }
  }
  return out;
}
