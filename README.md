# Sticker Calendar

A cozy little **calendar simulator** built around three sticker pals. Plan a month, jot notes,
stamp stickers on any day, and decorate the page with draggable mascot stickers.

![stack](https://img.shields.io/badge/React-19-blue) ![stack](https://img.shields.io/badge/Vite-6-purple)

## What it does

| Area | Notes |
| --- | --- |
| **Month grid** | Playful calendar with today highlight, weekend tint, optional holiday emoji + names, done check-marks, note previews and countdown ribbons. |
| **Stickers everywhere** | 40 bundled stickers: three mascot pals (cut from the uploaded artwork into transparent PNGs) plus cosy, sparkle and sweets sets. Tap to stamp, tap again to remove. |
| **Day details** | Notes (auto-saved), stickers, a Done toggle and clear-day. |
| **Decorate mode** | Drop mascot pals onto the calendar page and drag them anywhere; they stay per month. |
| **Holidays** | Computed US holidays incl. Easter, Mother's/Father's Day, Thanksgiving and more, with an upcoming-countdown rail. |
| **Themes** | Candy Cane, Cookie Cream, Midnight Cocoa and Winter Frost palettes. |
| **Export** | Download the current month as a PNG poster, or export/import the whole calendar as JSON. |
| **Persistence** | Everything lives in `localStorage`; a demo month is seeded on first visit. |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle
npm run preview    # serve the production build
```

## Notes on the art

`santa-cheer.png`, `santa-goggles.png` and `santa-peace.png` in `public/stickers/` are
transparent cut-outs of the three uploaded sticker images. Small emoji stickers use
OpenMoji SVGs so they render the same on every platform.

## Structure

```
src/
  App.tsx                 month state, selection, sheet/settings modals, export wiring
  components/             calendar sheet, day cells, decorations, cards and modals
  lib/                    dates, holidays, sticker catalog, store, PNG export
  styles/global.css       design tokens, themes and responsive layout
public/stickers/          mascot sticker PNGs
```
