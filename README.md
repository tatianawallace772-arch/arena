# Encyclopædia — The Modern Encyclopedia

A **Britannica-inspired encyclopedia website** built with **Next.js (App Router)**
and the free **[Wikipedia API](https://en.wikipedia.org/w/api.php)**
(MediaWiki API).

Search, browse, and read articles on history, science, geography, biography,
arts, space, and more — with a classic encyclopedia look: serif typography,
parchment tones, and gold accents.

## Features

- 🔍 **Full-text search** with autocomplete suggestions (`action=query&list=search`, `opensearch`)
- 📖 **Article pages** with full rendered content, infoboxes, images, and table of contents (`action=parse`)
- 🏠 **Home page** with featured articles, popular searches, and topic browsing
- 📅 **On This Day** — births & events for today (`/api/rest_v1/feed/onthisday`)
- 🎲 **Random article** button (`list=random`)
- 🗂️ **Browse by topic** — 12 curated subjects
- 🏷️ **Categories** on every article
- 📱 Responsive, mobile-friendly layout

## Tech

- **Next.js 14** (App Router) + React 18 + TypeScript
- **Wikipedia API** — all data fetched client-side from the browser
  (Wikipedia supports CORS via `origin=*`), so the app works anywhere
  with no API key and no backend required
- No external CSS framework — hand-crafted Britannica-style design in `app/globals.css`

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve production build
```

## API usage

All requests go to `https://en.wikipedia.org/w/api.php` (see `lib/wiki.ts`):

| Purpose | Endpoint |
|---|---|
| Search | `action=query&list=search` |
| Suggestions | `action=opensearch` |
| Summary + thumbnail | `action=query&prop=extracts\|pageimages\|description` |
| Full article | `action=parse&prop=text\|sections\|images` |
| Random | `action=query&list=random` |
| Categories | `action=query&prop=categories` |
| On this day | `GET /api/rest_v1/feed/onthisday/selected/{month}/{day}` |

Internal Wikipedia links (`/wiki/...`) are rewritten to `/article/...` routes,
and protocol-relative image URLs are fixed automatically.

## Project structure

```
app/
  page.tsx               # Home (hero, featured, topics, on this day)
  browse/page.tsx        # Topic browsing
  search/page.tsx        # Search results
  article/[title]/page.tsx  # Article reader
  layout.tsx             # Header + footer shell
  globals.css            # Britannica-style design system
components/
  Header.tsx  Footer.tsx  SearchBar.tsx  ArticleCard.tsx
lib/
  wiki.ts                # Wikipedia API layer
```

> Not affiliated with Encyclopædia Britannica, Inc. Article content © Wikipedia
> contributors, CC BY-SA.
