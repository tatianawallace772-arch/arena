import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Music2, Plus, Search, Settings, Sparkles, Upload, Volume2, VolumeX, X } from 'lucide-react';
import { MONTH_NAMES, monthLabel, monthIndexFromAnchor, monthFromIndex } from '../lib/calendar';
import { EVENT_COLORS, stickerById } from '../lib/data';
import type { CalendarEvent, MonthRef, ViewMode } from '../lib/types';

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'year', label: 'Year' },
];

interface Props {
  current: MonthRef;
  setCurrent: (m: MonthRef) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  events: CalendarEvent[];
  onSelectDate: (iso: string, eventId?: string) => void;
  onNewEvent: () => void;
  onSettings: () => void;
  onExport: () => void;
  onImport: () => void;
  onCelebrate: () => void;
  onToday: () => void;
  soundOn: boolean;
  musicOn: boolean;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onOpenAudio: () => void;
}

export default function TopBar({
  current,
  setCurrent,
  view,
  setView,
  events,
  onSelectDate,
  onNewEvent,
  onSettings,
  onExport,
  onImport,
  onCelebrate,
  onToday,
  soundOn,
  musicOn,
  onToggleSound,
  onToggleMusic,
  onOpenAudio,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = monthIndexFromAnchor(current.year, current.month);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return events
      .filter((ev) => {
        const hay = `${ev.title} ${ev.notes ?? ''} ${ev.date}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [events, query]);

  const commit = (iso: string, id?: string) => {
    onSelectDate(iso, id);
    setOpen(false);
    setQuery('');
  };

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden>
          🍪
        </div>
        <div className="brand-text">
          <div className="brand-title">Gingerbread</div>
          <div className="brand-sub">Calendar</div>
        </div>
      </div>

      <div className="topbar-divider" aria-hidden />

      <div className="month-switch">
        <button className="icon-btn" aria-label="Previous month" onClick={() => setCurrent(monthFromIndex(index - 1))}>
          <ChevronLeft size={17} />
        </button>
        <h1>
          {monthLabel(current)}
          <small>Cookies &amp; plans</small>
        </h1>
        <button className="icon-btn" aria-label="Next month" onClick={() => setCurrent(monthFromIndex(index + 1))}>
          <ChevronRight size={17} />
        </button>
        <button className="btn btn-sm" onClick={onToday}>
          Today
        </button>
      </div>

      <div className="spacer" />

      <div ref={boxRef} style={{ position: 'relative' }}>
        <div className="searchbox">
          <Search size={15} color="#a2633a" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Search cookies, plans, dates…"
            aria-label="Search events"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setCursor(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(results.length - 1, c + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === 'Enter') {
                const hit = results[cursor];
                if (hit) commit(hit.date, hit.id);
                else if (/^\d{4}-\d{2}-\d{2}$/.test(query.trim())) commit(query.trim());
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
          {query ? (
            <button className="btn btn-ghost btn-sm" style={{ padding: 0 }} aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={13} />
            </button>
          ) : (
            <kbd>⌘K</kbd>
          )}
        </div>
        {open && query.trim() && (
          <div className="pop">
            <div className="pop-head">Events</div>
            {results.length === 0 && <div className="pop-empty">No cookies found for “{query}”.</div>}
            {results.map((ev, i) => {
              const color = EVENT_COLORS[ev.color];
              const st = ev.sticker ? stickerById(ev.sticker) : undefined;
              return (
                <button
                  key={ev.id}
                  className={`pop-item ${i === cursor ? 'active' : ''}`}
                  onClick={() => commit(ev.date, ev.id)}
                  onMouseEnter={() => setCursor(i)}
                >
                  {st?.kind === 'art' && st.src ? (
                    <img src={st.src} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
                  ) : (
                    <span aria-hidden>{st?.glyph ?? <span style={{ width: 8, height: 8, borderRadius: 99, background: color.dot }} />}</span>
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                  <span className="when">
                    {MONTH_NAMES[Number(ev.date.slice(5, 7)) - 1].slice(0, 3)} {Number(ev.date.slice(-2))}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="viewswitch" role="tablist" aria-label="Calendar view">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            className={view === v.id ? 'active' : ''}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onNewEvent} title="New event (N)">
        <Plus size={15} /> Event
      </button>

      <div className="audio-cluster" role="group" aria-label="Sound">
        <button
          className={`icon-btn ${soundOn ? 'is-on' : ''}`}
          title={soundOn ? 'Mute interface sounds (S)' : 'Unmute interface sounds (S)'}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Mute interface sounds' : 'Unmute interface sounds'}
          onClick={onToggleSound}
        >
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button
          className={`icon-btn music-btn ${musicOn ? 'is-on' : ''}`}
          title={musicOn ? 'Pause the gingerbread soundtrack' : 'Play the gingerbread soundtrack'}
          aria-pressed={musicOn}
          aria-label={musicOn ? 'Pause soundtrack' : 'Play soundtrack'}
          onClick={onToggleMusic}
          onDoubleClick={onOpenAudio}
        >
          <Music2 size={16} />
          {musicOn && <span className="eq" aria-hidden><i /><i /><i /></span>}
        </button>
      </div>

      <button className="icon-btn" title="Celebrate!" aria-label="Throw confetti" onClick={onCelebrate}>
        <Sparkles size={16} />
      </button>
      <button className="icon-btn" title="Export calendar (.json)" aria-label="Export" onClick={onExport}>
        <Download size={16} />
      </button>
      <button className="icon-btn" title="Import calendar (.json)" aria-label="Import" onClick={onImport}>
        <Upload size={16} />
      </button>
      <button className="icon-btn" title="Sound &amp; settings" aria-label="Sound and settings" onClick={onSettings}>
        <Settings size={16} />
      </button>
    </header>
  );
}
