import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import MonthView from './components/MonthView';
import WeekView from './components/WeekView';
import DayView from './components/DayView';
import AgendaView from './components/AgendaView';
import YearView from './components/YearView';
import StickerTray from './components/StickerTray';
import EventModal, { type EventDraft } from './components/EventModal';
import SettingsModal from './components/SettingsModal';
import { downloadJSON, readFileAsText, uid, usePersistentState } from './lib/useLocal';
import { useCalendarAudio } from './lib/useCalendarAudio';
import { bakeryAudio, type SfxName } from './lib/audio';
import { toISO, monthFromIndex, firstOfMonth, monthIndexFromAnchor } from './lib/calendar';
import { seedEvents, stickerById } from './lib/data';
import type { CalendarEvent, Countdown, MonthRef, PlacedSticker, Settings, ViewMode } from './lib/types';

const DEFAULT_SETTINGS: Settings = {
  weekStartsOn: 0,
  showHolidays: true,
  density: 'cozy',
  celebration: true,
  soundOn: true,
  sfxVolume: 0.5,
  musicOn: false,
  musicVolume: 0.22,
  mood: 'gingerbread',
};

const SEED_COUNTDOWNS: Countdown[] = [
  { id: 'cd-1', label: 'Gingerbread Day', date: '2026-11-21', emoji: '🍪' },
  { id: 'cd-2', label: 'Christmas', date: '2026-12-25', emoji: '🎄' },
  { id: 'cd-3', label: 'Starr Nova Drop', date: '2026-12-19', emoji: '⭐' },
];

const ARTWORK_IDS = ['nova-hero', 'nova-card'];

const now = new Date();

export default function App() {
  const [view, setView] = usePersistentState<ViewMode>('gb.view', 'month');
  const [currentMonth, setCurrentMonth] = usePersistentState<MonthRef>('gb.month', {
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [selected, setSelected] = usePersistentState<string>('gb.selected', toISO(now));
  const [events, setEvents] = usePersistentState<CalendarEvent[]>('gb.events', seedEvents);
  const [stickers, setStickers] = usePersistentState<PlacedSticker[]>('gb.stickers', []);
  // Stored settings are merged over the defaults so calendars saved before the
  // audio features existed pick up sound/music preferences cleanly.
  const [storedSettings, setSettings] = usePersistentState<Partial<Settings>>('gb.settings', DEFAULT_SETTINGS);
  const settings: Settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...storedSettings }), [storedSettings]);
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...patch })),
    [setSettings],
  );
  const [countdowns, setCountdowns] = usePersistentState<Countdown[]>('gb.countdowns', SEED_COUNTDOWNS);
  const [editableStickers, setEditableStickers] = usePersistentState<boolean>('gb.stickersEditable', true);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ id: string; msg: string; glyph: string } | null>(null);
  const [confetti, setConfetti] = useState<{ id: number; pieces: { left: number; delay: number; dur: number; glyph: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = useMemo(() => new Date(), []);

  // ---- Web Audio -------------------------------------------------------
  const { sfx, unlock, toggleMusic } = useCalendarAudio(settings);
  const [musicPlaying, setMusicPlaying] = useState(false);

  // The first click/keypress anywhere unlocks the AudioContext.
  useEffect(() => {
    const onFirst = () => unlock();
    window.addEventListener('pointerdown', onFirst, { once: true });
    window.addEventListener('keydown', onFirst, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirst);
      window.removeEventListener('keydown', onFirst);
    };
  }, [unlock]);

  useEffect(() => {
    setMusicPlaying(bakeryAudio.isMusicOn);
  }, [settings.musicOn, settings.mood]);

  // Duck the soundtrack while a dialog is open.
  useEffect(() => {
    bakeryAudio.duck(Boolean(draft) || settingsOpen);
  }, [draft, settingsOpen]);

  const say = useCallback((msg: string, glyph = '🍪', sound: SfxName = 'tap') => {
    setToast({ id: uid('toast'), msg, glyph });
    sfx(sound);
  }, [sfx]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const celebrate = useCallback(() => {
    sfx('celebrate');
    const glyphs = ['🍪', '❄️', '✨', '🍬', '⭐', '🎀', '🎄', '🧁'];
    const pieces = Array.from({ length: 46 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      dur: 2.2 + Math.random() * 1.8,
      glyph: glyphs[i % glyphs.length],
    }));
    setConfetti({ id: Date.now(), pieces });
    setTimeout(() => setConfetti(null), 4600);
  }, [sfx]);

  // Seed a few stickers on the very first visit only.
  const [seeded, setSeeded] = usePersistentState<boolean>('gb.stickersSeeded', false);
  useEffect(() => {
    if (seeded) return;
    setSeeded(true);
    const seed: PlacedSticker[] = [
      { id: uid('st'), stickerId: 'nova-hero', date: '2026-12-19', x: 50, y: 52, scale: 0.62, rotation: -3, z: 5 },
      { id: uid('st'), stickerId: 'ginger-bread', date: '2026-11-21', x: 80, y: 72, scale: 0.9, rotation: 8, z: 4 },
      { id: uid('st'), stickerId: 'nova-card', date: '2026-12-24', x: 50, y: 55, scale: 0.55, rotation: 4, z: 5 },
      { id: uid('st'), stickerId: 'candy-cane', date: '2026-12-12', x: 82, y: 70, scale: 0.85, rotation: -12, z: 4 },
      { id: uid('st'), stickerId: 'star', date: '2026-12-31', x: 22, y: 70, scale: 0.9, rotation: 10, z: 4 },
    ];
    if (stickers.length === 0) setStickers(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectDate = useCallback(
    (iso: string, eventId?: string) => {
      setSelected(iso);
      const d = new Date(`${iso}T00:00:00`);
      if (!Number.isNaN(d.getTime())) setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() });
      if (eventId) {
        const ev = events.find((e) => e.id === eventId);
        if (ev) setDraft({ ...ev });
      }
    },
    [events, setCurrentMonth, setSelected],
  );

  const openEvent = useCallback((ev: CalendarEvent) => setDraft({ ...ev }), []);

  const newEvent = useCallback(
    (iso: string, time?: string) => {
      setDraft({ title: '', date: iso, time, color: 'peppermint', sticker: undefined });
    },
    [],
  );

  const saveEvent = useCallback(
    (next: EventDraft) => {
      if (next.id) {
        setEvents((list) => list.map((e) => (e.id === next.id ? ({ ...e, ...next } as CalendarEvent) : e)));
        say('Plan updated', '✏️', 'save');
      } else {
        const created: CalendarEvent = { ...next, id: uid('ev') } as CalendarEvent;
        setEvents((list) => [...list, created]);
        say('Plan pinned to the calendar', '📌', 'save');
      }
      setDraft(null);
      if (settings.celebration) celebrate();
    },
    [celebrate, say, setEvents, settings.celebration],
  );

  const deleteEvent = useCallback(() => {
    if (!draft?.id) return;
    setEvents((list) => list.filter((e) => e.id !== draft.id));
    setDraft(null);
    say('Plan removed', '🧹', 'delete');
  }, [draft, say, setEvents]);

  const placeSticker = useCallback(
    (stickerId: string, iso = selected) => {
      const st = stickerById(stickerId);
      if (!st) return;
      const onDay = stickers.filter((s) => s.date === iso).length;
      const base = st.base > 100 ? 0.55 : 0.85;
      const placed: PlacedSticker = {
        id: uid('st'),
        stickerId,
        date: iso,
        x: 30 + Math.random() * 40,
        y: 28 + Math.random() * 40,
        scale: Number((base * (1 - Math.min(onDay, 2) * 0.1)).toFixed(2)),
        rotation: Math.round((Math.random() - 0.5) * 22),
        z: 4 + onDay,
      };
      setStickers((list) => [...list, placed]);
      setSelectedSticker(placed.id);
      setEditableStickers(true);
      if (settings.celebration) celebrate();
      say(`${st.name} added to ${iso}`, '✨', 'place');
    },
    [celebrate, selected, setEditableStickers, setStickers, settings.celebration, say, stickers],
  );

  const updateSticker = useCallback(
    (id: string, patch: Partial<PlacedSticker>) => {
      setStickers((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [setStickers],
  );

  const removeSticker = useCallback(
    (id: string) => {
      setStickers((list) => list.filter((s) => s.id !== id));
      setSelectedSticker((cur) => (cur === id ? null : cur));
    },
    [setStickers],
  );

  const clearMonthStickers = useCallback(() => {
    const prefix = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;
    setStickers((list) => list.filter((s) => !s.date.startsWith(prefix)));
    say('Stickers cleared from this month', '🧹', 'delete');
  }, [currentMonth, say, setStickers]);

  const clearDayStickers = useCallback(() => {
    setStickers((list) => list.filter((s) => s.date !== selected));
    say('Stickers cleared from this day', '🧹', 'delete');
  }, [say, selected, setStickers]);

  const shuffleStickers = useCallback(() => {
    const prefix = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;
    setStickers((list) =>
      list.map((s) =>
        s.date.startsWith(prefix)
          ? {
              ...s,
              x: 22 + Math.random() * 56,
              y: 25 + Math.random() * 45,
              rotation: Math.round((Math.random() - 0.5) * 30),
            }
          : s,
      ),
    );
    say('Scattered the sticker sheet', '✨', 'place');
  }, [currentMonth, say, setStickers]);

  const exportAll = useCallback(() => {
    downloadJSON(`gingerbread-calendar-${toISO(new Date())}.json`, {
      app: 'gingerbread-calendar',
      version: 1,
      exportedAt: new Date().toISOString(),
      events,
      stickers,
      countdowns,
      settings,
    });
    say('Exported your calendar', '⬇️', 'save');
  }, [countdowns, events, say, settings, stickers]);

  const importFile = useCallback(
    async (file: File) => {
      try {
        const text = await readFileAsText(file);
        const data = JSON.parse(text) as {
          events?: CalendarEvent[];
          stickers?: PlacedSticker[];
          countdowns?: Countdown[];
          settings?: Settings;
        };
        if (Array.isArray(data.events)) setEvents(data.events);
        if (Array.isArray(data.stickers)) setStickers(data.stickers);
        if (Array.isArray(data.countdowns)) setCountdowns(data.countdowns);
        if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        say('Calendar imported', '📥', 'save');
      } catch {
        say('That file could not be read', '⚠️', 'error');
      }
    },
    [say, setCountdowns, setEvents, setSettings, setStickers],
  );

  const resetSample = useCallback(() => {
    setEvents(seedEvents);
    setCountdowns(SEED_COUNTDOWNS);
    say('Sample plans restored', '🍪', 'place');
  }, [say, setCountdowns, setEvents]);

  const clearAll = useCallback(() => {
    setEvents([]);
    setStickers([]);
    setCountdowns([]);
    setSettingsOpen(false);
    say('Everything cleared — fresh cookie sheet', '🧼', 'delete');
  }, [say, setCountdowns, setEvents, setSettingsOpen, setStickers]);

  const addCountdown = useCallback(() => {
    setCountdowns((list) => [
      ...list,
      { id: uid('cd'), label: 'New countdown', date: selected, emoji: '🍪' },
    ]);
    say('Countdown added', '⏳', 'place');
  }, [say, selected, setCountdowns]);

  const removeCountdown = useCallback(
    (id: string) => setCountdowns((list) => list.filter((c) => c.id !== id)),
    [setCountdowns],
  );

  const gotoToday = useCallback(() => {
    const t = new Date();
    setCurrentMonth({ year: t.getFullYear(), month: t.getMonth() });
    setSelected(toISO(t));
    setView('month');
  }, [setCurrentMonth, setSelected, setView]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const index = monthIndexFromAnchor(currentMonth.year, currentMonth.month);
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          newEvent(selected);
          break;
        case 't':
          gotoToday();
          break;
        case 'arrowright':
          setCurrentMonth(monthFromIndex(index + 1));
          break;
        case 'arrowleft':
          setCurrentMonth(monthFromIndex(index - 1));
          break;
        case 'm':
          setView('month');
          break;
        case 'w':
          setView('week');
          break;
        case 'd':
          setView('day');
          break;
        case 'a':
          setView('agenda');
          break;
        case 'y':
          setView('year');
          break;
        case 'delete':
        case 'backspace':
          if (selectedSticker) removeSticker(selectedSticker);
          break;
        case 's':
          updateSettings({ soundOn: !settings.soundOn });
          break;
        case 'p':
          updateSettings({ musicOn: !settings.musicOn });
          break;
        case 'escape':
          setSelectedSticker(null);
          setDraft(null);
          setSettingsOpen(false);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    currentMonth,
    gotoToday,
    newEvent,
    removeSticker,
    selected,
    selectedSticker,
    setCurrentMonth,
    setSettings,
    setView,
  ]);

  const monthStickers = useMemo(
    () => stickers.filter((s) => s.date.startsWith(`${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`)),
    [currentMonth, stickers],
  );

  const dayStickers = useMemo(() => stickers.filter((s) => s.date === selected), [selected, stickers]);

  const handleAddEvent = useCallback((iso: string, time?: string) => newEvent(iso, time), [newEvent]);

  return (
    <div className={`app density-${settings.density}`}>
      <TopBar
        current={currentMonth}
        setCurrent={setCurrentMonth}
        view={view}
        setView={setView}
        events={events}
        onSelectDate={selectDate}
        onNewEvent={() => newEvent(selected)}
        onSettings={() => setSettingsOpen(true)}
        onExport={exportAll}
        onImport={() => fileRef.current?.click()}
        onCelebrate={celebrate}
        onToday={gotoToday}
        soundOn={settings.soundOn}
        musicOn={musicPlaying}
        onToggleSound={() => {
          updateSettings({ soundOn: !settings.soundOn });
        }}
        onToggleMusic={() => {
          const next = !musicPlaying;
          updateSettings({ musicOn: next });
          setMusicPlaying(next);
          if (next) bakeryAudio.startMusic(settings.mood);
          else bakeryAudio.stopMusic();
          if (next) say('Gingerbread soundtrack on', '🎵', 'open');
          else say('Soundtrack paused', '🔇', 'close');
        }}
        onOpenAudio={() => setSettingsOpen(true)}
      />

      <Sidebar
        current={currentMonth}
        setCurrent={setCurrentMonth}
        selected={selected}
        setSelected={setSelected}
        events={events}
        stickers={stickers}
        countdowns={countdowns}
        onAddCountdown={addCountdown}
        onRemoveCountdown={removeCountdown}
        weekStartsOn={settings.weekStartsOn}
      />

      <main style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        {view === 'month' && (
          <MonthView
            current={currentMonth}
            events={events}
            stickers={monthStickers}
            selected={selected}
            today={today}
            weekStartsOn={settings.weekStartsOn}
            showHolidays={settings.showHolidays}
            editableStickers={editableStickers}
            selectedSticker={selectedSticker}
            onSelectSticker={setSelectedSticker}
            onUpdateSticker={updateSticker}
            onRemoveSticker={removeSticker}
            onSelectDay={(iso) => setSelected(iso)}
            onAddEvent={handleAddEvent}
            onOpenEvent={openEvent}
            onClearStickers={clearMonthStickers}
            onShuffleStickers={shuffleStickers}
            onToggleEditable={() => setEditableStickers((v) => !v)}
          />
        )}
        {view === 'week' && (
          <WeekView
            selected={selected}
            setSelected={setSelected}
            weekStartsOn={settings.weekStartsOn}
            events={events}
            onOpenEvent={openEvent}
            onAddEvent={handleAddEvent}
          />
        )}
        {view === 'day' && (
          <DayView
            selected={selected}
            setSelected={setSelected}
            events={events}
            stickers={dayStickers}
            editableStickers={editableStickers}
            selectedSticker={selectedSticker}
            onSelectSticker={setSelectedSticker}
            onUpdateSticker={updateSticker}
            onRemoveSticker={removeSticker}
            onOpenEvent={openEvent}
            onAddEvent={handleAddEvent}
          />
        )}
        {view === 'agenda' && (
          <AgendaView current={currentMonth} events={events} onOpenEvent={openEvent} onSelectDay={(iso) => { setSelected(iso); setView('day'); }} />
        )}
        {view === 'year' && (
          <YearView year={currentMonth.year} events={events} onPickMonth={(m) => { setCurrentMonth(m); setView('month'); }} />
        )}

        <StickerTray
          targetDate={selected}
          onPlace={(id) => placeSticker(id)}
          onPlaceArtHero={() => placeSticker(ARTWORK_IDS[0])}
          placed={dayStickers}
          onClearSelectedDay={clearDayStickers}
          onClearAll={() => {
            setStickers([]);
            say('Sticker sheet cleared', '🧹', 'delete');
          }}
        />
      </main>

      {draft && (
        <EventModal draft={draft} onSave={saveEvent} onDelete={draft.id ? deleteEvent : undefined} onClose={() => setDraft(null)} />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
          eventCount={events.length}
          stickerCount={stickers.length}
          onReset={resetSample}
          onExport={exportAll}
          onImport={() => fileRef.current?.click()}
          onClearAll={clearAll}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = '';
        }}
      />

      <div className="toasts" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span className="glyph" aria-hidden>
              {toast.glyph}
            </span>
            {toast.msg}
          </div>
        )}
      </div>

      {confetti && (
        <div className="confetti" key={confetti.id} aria-hidden>
          {confetti.pieces.map((p, i) => (
            <i
              key={i}
              style={{
                left: `${p.left}%`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.dur}s`,
                fontSize: 14 + ((i * 7) % 12),
              }}
            >
              {p.glyph}
            </i>
          ))}
        </div>
      )}
    </div>
  );
}
