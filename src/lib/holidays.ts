import type { EmojiName } from '../components/Emoji';
import { addDays, keyOf, monthMatrix } from './dates';

export type HolidayTone = 'red' | 'green' | 'gold' | 'plum';

export type Holiday = {
  label: string;
  emoji: EmojiName;
  tone: HolidayTone;
  /** Short label used inside small calendar cells. */
  short: string;
};

const holiday = (label: string, short: string, emoji: EmojiName, tone: HolidayTone): Holiday => ({
  label,
  short,
  emoji,
  tone,
});

const nthWeekday = (year: number, month: number, weekday: number, n: number) => {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
};

const lastWeekday = (year: number, month: number, weekday: number) => {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
};

/** Gregorian Easter Sunday. */
const easterSunday = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 114);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};

const cache = new Map<number, Record<string, Holiday>>();

export function holidaysForYear(year: number): Record<string, Holiday> {
  const hit = cache.get(year);
  if (hit) return hit;

  const entries: Array<[Date, Holiday]> = [
    [new Date(year, 0, 1), holiday("New Year's Day", "New Year", 'confetti', 'gold')],
    [nthWeekday(year, 0, 1, 3), holiday('Martin Luther King Jr. Day', 'MLK Day', 'dove', 'plum')],
    [new Date(year, 1, 14), holiday("Valentine's Day", "Valentine's", 'heartbox', 'red')],
    [nthWeekday(year, 1, 1, 3), holiday("Presidents' Day", 'Presidents’', 'tophat', 'plum')],
    [new Date(year, 2, 14), holiday('Pi Day', 'Pi Day', 'pie', 'gold')],
    [new Date(year, 2, 17), holiday("St. Patrick's Day", "St. Paddy's", 'clover', 'green')],
    [easterSunday(year), holiday('Easter Sunday', 'Easter', 'bunny', 'green')],
    [nthWeekday(year, 4, 0, 2), holiday("Mother's Day", "Mother's", 'bouquet', 'red')],
    [lastWeekday(year, 4, 1), holiday('Memorial Day', 'Memorial', 'medal', 'plum')],
    [nthWeekday(year, 5, 0, 3), holiday("Father's Day", "Father's", 'cap', 'green')],
    [new Date(year, 5, 19), holiday('Juneteenth', 'Juneteenth', 'sunface', 'gold')],
    [new Date(year, 6, 4), holiday('Independence Day', 'July 4', 'fireworks', 'red')],
    [nthWeekday(year, 8, 1, 1), holiday('Labor Day', 'Labor Day', 'tools', 'gold')],
    [new Date(year, 9, 31), holiday('Halloween', 'Halloween', 'pumpkin', 'gold')],
    [new Date(year, 10, 11), holiday('Veterans Day', 'Veterans', 'medal', 'plum')],
    [nthWeekday(year, 10, 4, 4), holiday('Thanksgiving', 'Thanksgiving', 'turkey', 'gold')],
    [new Date(year, 11, 24), holiday('Christmas Eve', 'Christmas Eve', 'candle', 'green')],
    [new Date(year, 11, 25), holiday('Christmas Day', 'Christmas', 'tree', 'red')],
    [new Date(year, 11, 31), holiday("New Year's Eve", "New Year's Eve", 'confetti', 'gold')],
  ];

  const map: Record<string, Holiday> = {};
  for (const [date, h] of entries) map[keyOf(date)] = h;
  cache.set(year, map);
  return map;
}

/** next `count` holidays starting today (inclusive), spanning up to two years. */
export function upcomingHolidays(from: Date, count = 4) {
  const out: Array<{ key: string; date: Date; holiday: Holiday }> = [];
  const startKey = keyOf(from);
  for (const year of [from.getFullYear(), from.getFullYear() + 1]) {
    const map = holidaysForYear(year);
    for (const [key, h] of Object.entries(map)) {
      if (key < startKey) continue;
      out.push({ key, date: new Date(year, Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))), holiday: h });
    }
  }
  out.sort((a, b) => (a.key < b.key ? -1 : 1));
  return out.slice(0, count);
}

export function holidaysInMonth(year: number, month: number) {
  const seen = new Set<string>();
  const out: Array<{ key: string; holiday: Holiday }> = [];
  for (const date of monthMatrix(year, month, 0).flat()) {
    const key = keyOf(date);
    if (seen.has(key)) continue;
    seen.add(key);
    const h = holidaysForYear(date.getFullYear())[key];
    if (h) out.push({ key, holiday: h });
  }
  return out;
}

/** Days from today until the next holiday (0 when the next one is today). */
export function daysUntilHoliday(key: string, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

export const holidayEmojiForDate = (date: Date) => holidaysForYear(date.getFullYear())[keyOf(date)];

export const tomorrow = (date: Date) => addDays(date, 1);
