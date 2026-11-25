import { holidaysForYear } from './holidays';
import { keyOf, addDays, daysInMonth } from './dates';
import type { CalendarState, DayEntry } from './types';
import { emptyState, monthKeyOf } from './types';

const noteIdeas: Array<[number, string]> = [
  [3, 'Hot cocoa + movie night'],
  [7, 'Grocery run: marshmallows, sprinkles, oranges'],
  [11, 'Call Grandma — tell her about the sticker calendar'],
  [16, 'Library books due'],
  [21, 'Bake cookies for the neighbors'],
  [26, 'Cozy walk around the block'],
];

/** Give a brand-new calendar a cheerful, lived-in demo month. */
export function seedDemoState(now = new Date()): CalendarState {
  const state = emptyState();
  const year = now.getFullYear();
  // November + December are the showcase months for the mascot artwork
  const month = now.getMonth() === 10 ? 11 : now.getMonth();
  const days = daysInMonth(year, month);
  const clampDay = (d: number) => Math.min(d, days);

  const put = (day: number, entry: Partial<DayEntry>) => {
    const key = keyOf(new Date(year, month, clampDay(day)));
    state.days[key] = { stickers: [], done: false, ...entry };
  };

  put(1, { stickers: ['star'], done: true });
  put(5, { stickers: ['hot-cocoa'], note: { text: 'Treat myself to a cocoa ☕', updatedAt: Date.now() } });
  put(9, { stickers: ['gingerbread'] });
  put(clampDay(14), { stickers: ['heart'], note: { text: 'Halfway through the month — keep going', updatedAt: Date.now() } });
  put(clampDay(now.getDate()), { stickers: ['santa-cheer'] });

  for (const [day, text] of noteIdeas) {
    const key = keyOf(new Date(year, month, clampDay(day)));
    const existing = state.days[key];
    if (existing) {
      if (!existing.note) existing.note = { text, updatedAt: Date.now() };
    } else {
      state.days[key] = { stickers: [], done: false, note: { text, updatedAt: Date.now() } };
    }
  }

  // sprinkle holiday stickers on each holiday in view
  const holidays = holidaysForYear(year);
  for (const [key, holiday] of Object.entries(holidays)) {
    const date = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
    if (date.getFullYear() !== year || date.getMonth() !== month) continue;
    const pickup: Record<string, string> = {
      "Valentine's Day": 'heart',
      "St. Patrick's Day": 'clover',
      'Christmas Day': 'tree',
      'Christmas Eve': 'candle',
      'Independence Day': 'party',
      Halloween: 'moon',
      Thanksgiving: 'gingerbread',
      "New Year's Eve": 'sparkles',
      "New Year's Day": 'sparkles',
    };
    const sticker = pickup[holiday.label];
    if (!sticker) continue;
    state.days[key] = { ...(state.days[key] ?? { stickers: [], done: false }), stickers: [sticker] };
  }

  // decorative mascots around the page
  const monthKey = monthKeyOf(year, month);
  state.months[monthKey] = {
    decorations: [
      { sticker: 'santa-cheer', x: 4, y: 69 },
      { sticker: 'santa-goggles', x: 64, y: -2 },
      { sticker: 'santa-peace', x: 76, y: 62 },
    ],
  };

  const tomorrowKey = keyOf(addDays(now, 1));
  if (!state.days[tomorrowKey]) {
    state.days[tomorrowKey] = { stickers: ['sparkles'], done: false };
  }

  return state;
}
