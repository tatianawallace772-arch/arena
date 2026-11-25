import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isFirstVisit, loadState, saveState, emptyDay, monthKeyOf, type CalendarState, type DayEntry, type Placement, type Settings } from './types';
import { seedDemoState } from './seed';
import { keyOf } from './dates';
import { Emoji } from '../components/Emoji';

type Store = {
  state: CalendarState;
  /** Bumps every time the user changes something — used for "unsaved" nudges. */
  revision: number;
  setDay: (key: string, entry: DayEntry) => void;
  updateDay: (key: string, up: (entry: DayEntry) => DayEntry) => void;
  clearDay: (key: string) => void;
  setDecorations: (monthKey: string, decorations: Placement[]) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
  toast: (message: string) => void;
};

const StoreContext = createContext<Store | null>(null);

const initialState = (): CalendarState => (isFirstVisit() ? seedDemoState() : loadState());

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CalendarState>(initialState);
  const [revision, setRevision] = useState(0);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);
  const timers = useRef<number[]>([]);
  const toastId = useRef(0);
  const saveTimer = useRef<number | undefined>(undefined);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveState(state), 250);
    return () => window.clearTimeout(saveTimer.current);
  }, [state]);

  const toast = useCallback((message: string) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((t) => [...t.slice(-2), { id, message }]);
    timers.current.push(
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600),
    );
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const bump = useCallback(() => setRevision((r) => r + 1), []);

  const setDay = useCallback(
    (key: string, entry: DayEntry) => {
      setState((s) => ({ ...s, days: { ...s.days, [key]: entry } }));
      bump();
    },
    [bump],
  );

  const updateDay = useCallback(
    (key: string, up: (entry: DayEntry) => DayEntry) => {
      setState((s) => {
        const current = s.days[key] ?? emptyDay();
        const next = up(current);
        const days = { ...s.days, [key]: next };
        return { ...s, days };
      });
      bump();
    },
    [bump],
  );

  const clearDay = useCallback(
    (key: string) => {
      setState((s) => {
        const days = { ...s.days };
        delete days[key];
        return { ...s, days };
      });
      bump();
    },
    [bump],
  );

  const setDecorations = useCallback(
    (mKey: string, decorations: Placement[]) => {
      setState((s) => ({
        ...s,
        months: { ...s.months, [mKey]: { ...(s.months[mKey] ?? { decorations: [] }), decorations } },
      }));
      bump();
    },
    [bump],
  );

  const setSettings = useCallback(
    (patch: Partial<Settings>) => {
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      bump();
    },
    [bump],
  );

  const resetAll = useCallback(() => {
    setState(seedDemoState());
    bump();
  }, [bump]);

  const value = useMemo<Store>(
    () => ({ state, revision, setDay, updateDay, clearDay, setDecorations, setSettings, resetAll, toast }),
    [state, revision, setDay, updateDay, clearDay, setDecorations, setSettings, resetAll, toast],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span className="toast-emoji">
              <Emoji name="ribbon" size={16} />
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/** Convenience helpers shared by panels. */
export function useDay(key: string | null) {
  const { state } = useStore();
  return key ? (state.days[key] ?? emptyDay()) : emptyDay();
}

export const useMonthKey = (year: number, month: number) => monthKeyOf(year, month);

export const dateKey = (date: Date) => keyOf(date);
