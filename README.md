# 🍪 Gingerbread Calendar

A cookie-decorated planner with **Gingerbread Starr Nova** stickers, built with
React 19 + TypeScript + Vite. Month, week, day, agenda and year views; drag-and-drop
sticker art; countdowns; confetti; and everything saved locally in the browser.

![stack](https://img.shields.io/badge/React-19-blue) ![stack](https://img.shields.io/badge/Vite-6-purple)

## What it does

| Feature | Notes |
| --- | --- |
| **Five views** | Month canvas, week time-grid, single-day sheet, grouped agenda and a 12-month cookie year. |
| **Sticker art** | The two supplied Starr Nova illustrations are matted to transparent PNGs and render on any day at any size/tilt. 16 cookie glyph stickers round out the sheet. |
| **Drag & drop stickers** | Unlock “Editing” on the month canvas, then drag a sticker to move it (even between days) or grab its corner to resize. Double-click tilts it 15°. |
| **Events** | Title, date, start/end time, icing colour, optional sticker badge, notes and a done toggle. Double-click a day to add one. |
| **Holidays** | 18 baked-in holidays flagged with a dashed cookie outline and glyph (can be toggled off). |
| **Countdowns** | “Cookie Countdowns” card with days-remaining for any date, plus a live gingerbread-season counter. |
| **Search** | `⌘K` / `Ctrl+K` finds events by title, note or date. |
| **Persistence** | Events, stickers, settings and countdowns live in `localStorage` and sync across tabs. JSON export/import for backup. |
| **Keyboard** | `N` new event · `T` today · `←/→` change month · `M/W/D/A/Y` switch view · `S` mute sounds · `P` toggle soundtrack · `Delete` remove selected sticker · `Esc` close. |
| **Celebration** | Confetti of cookies, snowflakes and candy canes on every save (toggleable). |
| **Web Audio** | Synthesised sound effects plus a generative music-box soundtrack with three moods. Volume sliders, a sound-test grid, and `S` / `P` toggles. |

## Custom soundtrack

In **Settings → Sound & music → Custom soundtrack**, drop in or browse for MP3,
M4A, AAC, OGG, Opus, WAV, FLAC or WebM audio. The browser's audio decoder is
checked before accepting a file; files are limited to 25 MB each. The player has
seek, previous/next, shuffle, repeat and a track list, and custom music replaces
the generated synth loop. Choose **Synth loop** any time to switch back.

Audio files are stored locally in the browser's IndexedDB; only small track
metadata is kept with calendar settings. Nothing is uploaded. Audio binaries are
not included in JSON calendar exports; clearing browser site data removes saved
tracks, so keep the original audio files as your backup.
The music-volume control and modal ducking also apply to custom tracks.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the production build
```

Node 20+ recommended. There is no backend — all state is client-side.

## Sticker assets

`public/stickers/nova-hero.png` and `public/stickers/nova-card.png` are the
character cut out of the supplied artwork with a threshold + largest-component
matte, so they can sit on the gingerbread paper without a coloured halo.
`public/img/poster.jpg` is the promotional art used for the pinboard banner.

## Sound design

Sound effects and the built-in soundtrack are generated at runtime with the Web
Audio API. Uploaded custom soundtrack files are stored on-device in IndexedDB.
`lib/audio.ts` owns a single `BakeryAudio` engine:

- **Effects** are short oscillator + filtered-noise recipes (`tap`, `save`, `place`,
  `delete`, `toggle`, `open`, `close`, `error`, `celebrate`), each with an
  attack/release envelope, stereo panning and optional bell partials so nothing clicks.
- **Music** is a generative 3/4 music-box loop: a pentatonic melody over a bass note and
  sleigh-bell shimmer, scheduled ahead of time on a 200 ms lookahead ticker so timing
  stays sample-accurate. Three moods (`gingerbread`, `frost`, `quiet`) change key, tempo
  and bell density. Opening the event editor or settings ducks either soundtrack source to 35%.
- The `AudioContext` is created lazily on the first gesture (browser autoplay rules), and
  `useCalendarAudio` keeps volumes/mute state in sync with the saved settings.

## Project layout

```
src/gingerbread/
  App.tsx                 app shell, state, shortcuts
  components/
    TopBar.tsx            month switching, search, view switch, tools
    Sidebar.tsx           mini month, stats, countdowns, coming up
    MonthView.tsx         the month canvas + sticker layer
    StickerCanvas.tsx     positioned drag/resize sticker layer
    WeekView.tsx          hour grid with all-day lane and now line
    DayView.tsx           single-day sheet + sticker panel
    AgendaView.tsx        grouped list for the month
    YearView.tsx          12 mini months
    StickerTray.tsx       drawer of art + cookie stickers
    EventModal.tsx        create/edit an event
    SettingsModal.tsx     week start, density, holidays, data tools
  lib/
    calendar.ts           dates, grids, countdown helpers
    data.ts               colors, stickers, holidays, sample plans
    types.ts              shared types
    useLocal.ts           persistent state + JSON helpers
    audio.ts              Web Audio engine (effects + both soundtrack buses)
    tracks.ts             supported formats + IndexedDB storage
    useCustomTrack.ts     custom audio player + Media Session controls
    useCalendarAudio.ts   binds the engine to saved settings
  styles/gingerbread.css  the whole design system
```

## Design notes

Gingerbread palette (`--cookie-*`), royal-icing surfaces, peppermint accents, and a
sprinkle-scattered desk background. Display type is Fredoka (bundled), body type is
Manrope — both installed locally via `@fontsource-variable`, so no network fonts
are fetched at runtime.
