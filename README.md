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
| **Keyboard** | `N` new event · `T` today · `←/→` change month · `M/W/D/A/Y` switch view · `Delete` remove selected sticker · `Esc` close. |
| **Celebration** | Confetti of cookies, snowflakes and candy canes on every save (toggleable). |

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
  styles/gingerbread.css  the whole design system
```

## Design notes

Gingerbread palette (`--cookie-*`), royal-icing surfaces, peppermint accents, and a
sprinkle-scattered desk background. Display type is Fredoka (bundled), body type is
Manrope — both installed locally via `@fontsource-variable`, so no network fonts
are fetched at runtime.
