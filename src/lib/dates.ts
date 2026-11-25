export const MONTHS = [
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

export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export const WEEKDAYS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAYS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local-date key, `YYYY-MM-DD`. */
export const keyOf = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => keyOf(new Date());

export const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const addMonthKey = (year: number, month: number, delta: number) => {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
};

export const daysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

export const startOfMonth = (year: number, month: number) => new Date(year, month, 1);

export const weekdayLabels = (weekStart: 0 | 1) =>
  weekStart === 1 ? [...WEEKDAYS_MON] : [...WEEKDAYS_SUN];

/** 6×7 matrix of dates covering the month, padded to full weeks. */
export function monthMatrix(year: number, month: number, weekStart: 0 | 1): Date[][] {
  const first = startOfMonth(year, month);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = addDays(first, -offset);
  const rows: Date[][] = [];
  for (let r = 0; r < 6; r += 1) {
    const row: Date[] = [];
    for (let c = 0; c < 7; c += 1) row.push(addDays(start, r * 7 + c));
    rows.push(row);
  }
  return rows;
}

export const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

export const isSameMonth = (date: Date, year: number, month: number) =>
  date.getFullYear() === year && date.getMonth() === month;

/** Whole days from a → b (negative when b is earlier). */
export const daysBetween = (aKey: string, bKey: string) =>
  Math.round((fromKey(bKey).getTime() - fromKey(aKey).getTime()) / 86_400_000);

export const longDate = (key: string) =>
  fromKey(key).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

export const mediumDate = (key: string) =>
  fromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const monthLabel = (year: number, month: number) => `${MONTHS[month]} ${year}`;

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};
