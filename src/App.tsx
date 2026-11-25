import { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from './components/TopBar';
import CalendarSheet from './components/CalendarSheet';
import HeroCard from './components/HeroCard';
import DayCard from './components/DayCard';
import QuickStickerCard from './components/QuickStickerCard';
import HolidayCard from './components/HolidayCard';
import StickerSheetModal from './components/StickerSheetModal';
import SettingsModal from './components/SettingsModal';
import MonthPicker from './components/MonthPicker';
import { Emoji } from './components/Emoji';
import { useStore } from './lib/store';
import { emptyDay, monthKeyOf, type Placement } from './lib/types';
import { MASCOTS } from './lib/stickers';
import { MONTHS, addMonthKey, daysInMonth, keyOf, monthLabel, todayKey, weekdayLabels } from './lib/dates';
import { exportMonthImage, primeStickerImages } from './lib/exportImage';
import { downloadFile } from './lib/file';

export default function App() {
  const { state, setDay, clearDay, setDecorations, setSettings, resetAll, toast, updateDay } = useStore();
  const now = useMemo(() => new Date(), []);
  const today = todayKey();

  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingDecorations, setEditingDecorations] = useState(false);
  const [freshMascot, setFreshMascot] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  useEffect(() => {
    void primeStickerImages();
  }, []);

  const shiftMonth = useCallback((delta: number) => {
    setView((v) => addMonthKey(v.year, v.month, delta));
  }, []);

  const goToday = useCallback(() => {
    const d = new Date();
    setView({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedDay(todayKey());
  }, []);

  // keyboard shortcuts: ← → months, T today
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.key === 'ArrowLeft') shiftMonth(-1);
      else if (e.key === 'ArrowRight') shiftMonth(1);
      else if (e.key.toLowerCase() === 't') goToday();
      else if (e.key.toLowerCase() === 's') setSheetOpen(true);
      else if (e.key === 'Escape') {
        setSheetOpen(false);
        setSettingsOpen(false);
        setPickerOpen(false);
        setSelectedDay(null);
        setEditingDecorations(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shiftMonth, goToday]);

  const stats = useMemo(() => {
    const days = daysInMonth(view.year, view.month);
    let stickerCount = 0;
    let noteCount = 0;
    let doneCount = 0;
    for (let d = 1; d <= days; d += 1) {
      const key = keyOf(new Date(view.year, view.month, d));
      const entry = state.days[key];
      if (!entry) continue;
      stickerCount += entry.stickers.length;
      if (entry.note?.text) noteCount += 1;
      if (entry.done) doneCount += 1;
    }
    return { stickerCount, noteCount, doneCount };
  }, [state.days, view]);

  const monthDeco = state.months[monthKeyOf(view.year, view.month)]?.decorations ?? [];

  const addMascot = useCallback(() => {
    const mKey = monthKeyOf(view.year, view.month);
    const mascot = MASCOTS[Math.floor(Math.random() * MASCOTS.length)];
    const existing = state.months[mKey]?.decorations ?? [];
    const slot = existing.length % 3;
    const next: Placement[] = [
      ...existing,
      {
        sticker: mascot.id,
        x: [72, 3, 58][slot] + Math.random() * 8,
        y: [2, 64, 58][slot] + Math.random() * 8,
      },
    ];
    setDecorations(mKey, next);
    setFreshMascot(mascot.id);
    setEditingDecorations(true);
    toast(`${mascot.name} hopped onto the page — drag to place!`);
    window.setTimeout(() => setFreshMascot(null), 700);
  }, [state.months, view, setDecorations, toast]);

  const onSelectDay = useCallback(
    (date: Date) => {
      const key = keyOf(date);
      if (date.getMonth() !== view.month || date.getFullYear() !== view.year) {
        setView({ year: date.getFullYear(), month: date.getMonth() });
      }
      setSelectedDay(key);
    },
    [view.month, view.year],
  );

  const selectedEntry = selectedDay ? state.days[selectedDay] ?? emptyDay() : null;
  const shortDate = (key: string) =>
    new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const targetLabel = selectedDay ? shortDate(selectedDay) : monthLabel(view.year, view.month);

  const addStickerToTarget = useCallback(
    (id: string) => {
      if (selectedDay) {
        updateDay(selectedDay, (d) => ({ ...d, stickers: [...d.stickers, id].slice(-9) }));
        return;
      }
      const inView = view.year === now.getFullYear() && view.month === now.getMonth();
      const key = inView ? today : keyOf(new Date(view.year, view.month, 1));
      const current = state.days[key] ?? emptyDay();
      setDay(key, { ...current, stickers: [...current.stickers, id].slice(-9) });
      toast(`Added to ${shortDate(key)} — tap a day for another spot`);
    },
    [selectedDay, updateDay, view, now, setDay, state.days, toast, today],
  );

  const exportImage = useCallback(async () => {
    setBusy(true);
    try {
      await exportMonthImage(view.year, view.month, state);
      toast('Saved a PNG of this month');
    } catch {
      toast('Hmm, that export failed. Try again?');
    } finally {
      setBusy(false);
    }
  }, [view, state, toast]);

  const exportJson = useCallback(() => {
    downloadFile(
      `sticker-calendar-${view.year}-${String(view.month + 1).padStart(2, '0')}.json`,
      JSON.stringify(state, null, 2),
      'application/json',
    );
    toast('Backup downloaded');
  }, [state, view, toast]);

  const importJson = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || !parsed.days) throw new Error('bad file');
        Object.entries(parsed.days as Record<string, unknown>).forEach(([k, v]) => {
          if (!v || typeof v !== 'object') return;
          const entry = v as { stickers?: string[]; note?: { text: string }; done?: boolean };
          setDay(k, {
            stickers: Array.isArray(entry.stickers) ? entry.stickers.slice(0, 9) : [],
            note: entry.note?.text
              ? { text: String(entry.note.text).slice(0, 220), updatedAt: Date.now() }
              : undefined,
            done: Boolean(entry.done),
          });
        });
        if (parsed.months && typeof parsed.months === 'object') {
          Object.entries(parsed.months as Record<string, { decorations?: Placement[] }>).forEach(
            ([k, v]) => {
              if (Array.isArray(v?.decorations)) setDecorations(k, v.decorations.slice(0, 6));
            },
          );
        }
        setSettingsOpen(false);
        toast('Calendar imported');
      } catch {
        toast('That file didn’t look like a Sticker Calendar backup');
      }
    },
    [setDay, setDecorations, toast],
  );

  const jumpToHoliday = useCallback(
    (key: string) => {
      onSelectDay(new Date(`${key}T12:00:00`));
    },
    [onSelectDay],
  );

  const weekdays = weekdayLabels(state.settings.weekStart);

  return (
    <div className="app">
      <TopBar
        year={view.year}
        month={view.month}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        onToday={goToday}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenStickerSheet={() => setSheetOpen(true)}
        onExport={exportImage}
        onJumpMonth={() => setPickerOpen(true)}
      />

      {state.settings.name && (
        <div className="greeting">
          <Emoji name="pencil" size={14} /> {state.settings.name}&rsquo;s calendar
        </div>
      )}

      <div className="board">
        <div className="sheet-column">
          <CalendarSheet
            year={view.year}
            month={view.month}
            state={state}
            selectedDay={selectedDay}
            editingDecorations={editingDecorations}
            freshMascot={freshMascot}
            onSelectDay={onSelectDay}
            onSelectMonth={() => setSettingsOpen(true)}
            onDecorationsChange={(next) => setDecorations(monthKeyOf(view.year, view.month), next)}
            onSelectHoliday={jumpToHoliday}
          />
          <div className="sheet-actions">
            <button
              className={`chip-btn${editingDecorations ? ' primary' : ''}`}
              aria-pressed={editingDecorations}
              onClick={() => {
                setEditingDecorations((v) => !v);
                if (!editingDecorations) toast('Drag the mascots anywhere on the page');
              }}
            >
              <Emoji name="teddy" size={15} /> Decorate
            </button>
            <button className="chip-btn holly" onClick={addMascot}>
              + Mascot
            </button>
            <button className="chip-btn" onClick={() => setSelectedDay(today)}>
              <Emoji name="pin" size={14} /> Today
            </button>
            <span className="stat-strip">
              <span>
                <Emoji name="star" size={13} /> {stats.stickerCount} stickers
              </span>
              <span>
                <Emoji name="memo" size={13} /> {stats.noteCount} notes
              </span>
              <span>
                <Emoji name="check" size={13} /> {stats.doneCount} done
              </span>
            </span>
          </div>
          <div className="kbd-hint">
            <span>Shortcuts</span>
            <kbd>←</kbd>
            <kbd>→</kbd> months · <kbd>T</kbd> today · <kbd>S</kbd> stickers ·{' '}
            {weekdays[0]} starts the week
          </div>
        </div>

        <aside className="rail">
          <HeroCard
            monthIndex={view.month}
            monthName={MONTHS[view.month]}
            stickerCount={stats.stickerCount}
            noteCount={stats.noteCount}
            onAddMascot={addMascot}
            onOpenSheet={() => setSheetOpen(true)}
          />

          {selectedDay && selectedEntry ? (
            <DayCard
              key={selectedDay}
              dayKey={selectedDay}
              entry={selectedEntry}
              onUpdate={(up) => updateDay(selectedDay, up)}
              onClear={() => {
                clearDay(selectedDay);
                toast('Cleared — a fresh page');
              }}
              onClose={() => setSelectedDay(null)}
              onOpenSheet={() => setSheetOpen(true)}
            />
          ) : (
            <QuickStickerCard
              targetLabel={targetLabel}
              onAdd={addStickerToTarget}
              onOpenSheet={() => setSheetOpen(true)}
            />
          )}

          <HolidayCard onGoTo={jumpToHoliday} />

          <section className="card" aria-label="Page mascots">
            <div className="card-head">
              <Emoji name="teddy" size={16} />
              <h2>Page mascots</h2>
              <span className="spacer" />
              <span className="pill">{monthDeco.length} on page</span>
            </div>
            <div className="card-body">
              <p className="empty-hint" style={{ padding: 0, marginBottom: 10 }}>
                Mascot pals sit on the calendar page. Tap one to place it, then use{' '}
                <strong>Decorate</strong> to drag it around.
              </p>
              <div className="mascot-row">
                {MASCOTS.map((m) => (
                  <button
                    key={m.id}
                    className="mascot-tile"
                    title={`Place ${m.name} on the page`}
                    onClick={() => {
                      const mKey = monthKeyOf(view.year, view.month);
                      setDecorations(mKey, [
                        ...(state.months[mKey]?.decorations ?? []),
                        { sticker: m.id, x: 6 + Math.random() * 76, y: 4 + Math.random() * 70 },
                      ]);
                      setFreshMascot(m.id);
                      setEditingDecorations(true);
                      toast(`${m.name} is ready to drag`);
                      window.setTimeout(() => setFreshMascot(null), 700);
                    }}
                  >
                    <img src={m.src} alt={m.name} draggable={false} loading="lazy" />
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>

      <p className="footer-note">
        {busy ? 'saving your poster…' : 'saved automatically in this browser'} ·{' '}
        <button onClick={() => setSettingsOpen(true)}>settings</button> ·{' '}
        <button onClick={() => setSheetOpen(true)}>sticker sheet</button>
      </p>

      <StickerSheetModal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPick={(id) => addStickerToTarget(id)}
        targetLabel={targetLabel}
      />

      <SettingsModal
        open={settingsOpen}
        settings={state.settings}
        onClose={() => setSettingsOpen(false)}
        onPatch={setSettings}
        onReset={() => {
          resetAll();
          setSettingsOpen(false);
          setSelectedDay(null);
          const d = new Date();
          setView({ year: d.getFullYear(), month: d.getMonth() });
        }}
        onExportJson={exportJson}
        onImportJson={importJson}
      />

      <MonthPicker
        open={pickerOpen}
        year={view.year}
        month={view.month}
        onClose={() => setPickerOpen(false)}
        onPick={(y, m) => setView({ year: y, month: m })}
        onToday={() => {
          const d = new Date();
          setView({ year: d.getFullYear(), month: d.getMonth() });
        }}
      />
    </div>
  );
}
