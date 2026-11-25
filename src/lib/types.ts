export type ThemeId = 'cookie' | 'candy' | 'midnight' | 'frost';

export type Settings = {
  theme: ThemeId;
  weekStart: 0 | 1;
  showHolidays: boolean;
  showNotes: boolean;
  showLegend: boolean;
  name: string;
};

export type Note = {
  text: string;
  updatedAt: number;
};

export type DayEntry = {
  note?: Note;
  stickers: string[];
  done: boolean;
};

export type Placement = {
  sticker: string;
  x: number;
  y: number;
};

export type MonthData = {
  decorations: Placement[];
};

export type CalendarState = {
  version: 1;
  days: Record<string, DayEntry>;
  months: Record<string, MonthData>;
  settings: Settings;
};

export type Selection = { kind: 'day'; key: string } | { kind: 'month'; key: string } | null;

export const STORAGE_KEY = 'sticker-calendar.v1';
export const SETTINGS_KEY = 'sticker-calendar.settings.v1';

export const defaultSettings = (): Settings => ({
  theme: 'candy',
  weekStart: 0,
  showHolidays: true,
  showNotes: true,
  showLegend: true,
  name: '',
});

export const emptyState = (): CalendarState => ({
  version: 1,
  days: {},
  months: {},
  settings: defaultSettings(),
});

export const emptyDay = (): DayEntry => ({ stickers: [], done: false });

export const monthKeyOf = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}`;

export const parseMonthKey = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m - 1 };
};

export const THEMES: Array<{ id: ThemeId; name: string; dot: string }> = [
  { id: 'candy', name: 'Candy Cane', dot: '#d7263d' },
  { id: 'cookie', name: 'Cookie Cream', dot: '#b07a4b' },
  { id: 'midnight', name: 'Midnight Cocoa', dot: '#5b6ee1' },
  { id: 'frost', name: 'Winter Frost', dot: '#4a9bd1' },
];

export function loadState(): CalendarState {
  const base = emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<CalendarState>;
    if (!parsed || typeof parsed !== 'object') return base;
    const settings = { ...base.settings, ...(loadSettings() ?? parsed.settings ?? {}) };
    return {
      ...base,
      days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
      months: parsed.months && typeof parsed.months === 'object' ? parsed.months : {},
      settings,
    };
  } catch {
    return base;
  }
}

function loadSettings(): Partial<Settings> | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<Settings>;
  } catch {
    return null;
  }
}

export function saveState(state: CalendarState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    return true;
  } catch {
    return false;
  }
}

/** True when the browser has no saved calendar yet (used to seed a demo month). */
export function isFirstVisit() {
  try {
    return localStorage.getItem(STORAGE_KEY) === null;
  } catch {
    return true;
  }
}
