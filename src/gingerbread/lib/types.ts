export type { MonthRef } from './calendar';

export type WeekStart = 0 | 1;

export type EventColor = 'peppermint' | 'cocoa' | 'pine' | 'frosting' | 'sugarplum' | 'caramel';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  time?: string; // HH:mm (24h)
  endTime?: string;
  color: EventColor;
  notes?: string;
  sticker?: string; // sticker id used as the event's badge
  done?: boolean;
}

export interface Sticker {
  id: string;
  name: string;
  kind: 'art' | 'glyph';
  /** art stickers: image src. glyph stickers: emoji. */
  src?: string;
  glyph?: string;
  /** Sticker height in px at base scale. */
  base: number;
}

export interface PlacedSticker {
  id: string;
  stickerId: string;
  date: string;
  x: number; // 0-100 % within the day cell / day panel
  y: number; // 0-100 %
  scale: number;
  rotation: number;
  z: number;
}

export type ViewMode = 'month' | 'week' | 'day' | 'year' | 'agenda';

export type Density = 'cozy' | 'compact';

export type AudioMood = 'gingerbread' | 'frost' | 'quiet';

/** Where the soundtrack comes from: the built-in synth loop or an uploaded file. */
export type TrackMode = 'synth' | 'custom';

export interface TrackMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  duration: number;
  addedAt: number;
}

export interface Settings {
  weekStartsOn: WeekStart;
  showHolidays: boolean;
  density: Density;
  celebration: boolean;
  soundOn: boolean;
  sfxVolume: number;
  musicOn: boolean;
  musicVolume: number;
  mood: AudioMood;
  /** Which soundtrack source is active. */
  trackMode: TrackMode;
  /** Selected custom track id (null = first in the library). */
  trackId: string | null;
  shuffleTracks: boolean;
  repeatTracks: 'off' | 'all' | 'one';
  /** Lightweight metadata for uploaded audio files, stored in IndexedDB. */
  trackLibrary: TrackMeta[];
}

export interface Countdown {
  id: string;
  label: string;
  date: string;
  emoji: string;
}
