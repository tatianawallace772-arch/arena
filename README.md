# Junction — a fully functional social network demo (with a `facebook-scraper` import pipeline)

Junction is a complete, clickable social app in the spirit of Facebook: a feed with stories and
reactions, threaded comments, a working messenger, friends and requests, groups, watch, marketplace,
events, memories, a global search, saved posts, settings, dark mode — **and a real data-import path
built on [`facebook-scraper`](https://github.com/kevinzg/facebook-scraper)** so public Facebook pages
can become live Junction pages with posts, images, reaction counts, and links.

Everything is client-side: posts, reactions, comments, friendships, chats, stories, and imports
persist in your browser's `localStorage`. There is no backend and no account.

![stack](https://img.shields.io/badge/React-19-blue) ![stack](https://img.shields.io/badge/Vite-6-purple)
![stack](https://img.shields.io/badge/Python-3-yellow) ![data](https://img.shields.io/badge/facebook--scraper-import-green)

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the production build
```

Node 20+ is recommended. The demo seed loads automatically on first visit; **Settings → Reset demo**
restores it at any time.

## What actually works

| Area | Behaviour |
| --- | --- |
| **Feed** | For you / Friends / Groups / Saved tabs, stories tray, composer with photo upload, 6 text backgrounds, audience picker, feeling, check-in. Posts sort newest-first and survive reloads. |
| **Reactions** | Hover the Like button for the full picker (👍 ❤️ 🥰 😆 😮 😢 😡). Counts update live, switching reactions is net-zero, clicking your own reaction removes it. |
| **Comments** | Inline thread under every post, "view all", per-comment likes, new comments persist. |
| **Sharing** | Share sheet with a quoted repost in your feed, share-count increments, copy-link. |
| **Stories** | Photo stories per person, auto-advancing viewer with progress bars, keyboard arrows, replies toast, and **upload your own story**. |
| **Messenger** | Conversation list with unread badges, search, message send, emoji reactions on bubbles, day separators, and a polite auto-reply in 1:1 chats. |
| **Friends** | Requests (accept/delete), suggestions, all-friends grid, birthdays, unfriend, add-friend from anywhere. |
| **Groups** | Join/leave, group feed, group-scoped composer, member list, rules. |
| **Watch** | Featured video, catalogue grid, lightbox player with sound toggle. |
| **Marketplace** | Category filters, search, save listings, listing detail with seller card, "message seller" opens a real conversation, create-listing modal. |
| **Events** | Upcoming events derived from today's date, detail pages, going/interested counts. |
| **Memories** | "On this day" carousel with year badges. |
| **Search** | ⌘K / `/` overlay: people, pages, groups, posts, listings, videos, and shortcuts with keyboard navigation. |
| **Notifications** | Popover + full page, filters, unread state, inline accept for friend requests. |
| **Profile** | Cover, avatar, tabs (posts / about / friends / photos / reels), intro, friend grid, photo lightbox, edit-profile modal. |
| **Settings** | Dark/light theme (persisted), notification prefs, privacy toggles, **export your data to JSON**, **import a backup**, reset demo. |
| **Import** | Load a `facebook-scraper` bundle, preview the posts and reaction totals, then merge it into the feed as a page account. |

The feed ships with 20 seeded posts, 9 stories, 6 groups, 4 videos, 6 listings, 5 events, and 20 people
with realistic copy so every surface has something to show. All photography and portraits are
AI-generated for this demo; nothing is scraped at build time.

## The scraper pipeline

Junction expects a small JSON bundle. `tools/fb_import.py` produces it with `facebook-scraper`,
which reads public page HTML without an API key.

```bash
# 1. install the scraper
pip install facebook-scraper

# 2. scrape a public page (or group) into a bundle
python tools/fb_import.py --page nasa --pages 2 --out public/data/imports/nasa.json
python tools/fb_import.py --group 132544256152450 --pages 1 --out public/data/imports/group.json
python tools/fb_import.py --page nasa --cookies cookies.txt   # for pages that need a login wall

# 3. bring it into the app
#    Junction → Import from Facebook → Choose JSON file → pick the bundle → Import
```

`tools/make_sample_bundle.py` writes the offline sample used by the **Load sample bundle** button
(`public/data/imports/sample-page.json`), so the import flow can be demoed without any network calls.

### Bundle format (v1)

```jsonc
{
  "format": "junction-fb-bundle",
  "version": 1,
  "source": "facebook-scraper",
  "generatedAt": "2026-11-25T18:00:00Z",
  "page": { "id": "nasa", "name": "NASA", "handle": "nasa", "avatar": "https://…", "url": "https://facebook.com/nasa" },
  "posts": [
    {
      "id": "1220…",
      "at": 1700000000000,          // epoch ms
      "text": "post body",
      "images": ["https://…"],      // first four are used
      "video": null,
      "link": { "url": "https://…", "title": "…", "desc": "…" },
      "reactions": { "like": 1200, "love": 300, "wow": 20 },
      "commentsCount": 42,
      "shares": 8,
      "url": "https://facebook.com/…"
    }
  ]
}
```

The importer creates a page-account for `page` (with a verified badge on its posts) and converts each
post into a normal Junction post — photo, video, or link preview — with its reaction counts and share
count intact, so it sorts and filters exactly like native content. Re-importing a bundle adds
duplicate posts, which is handy for testing and easy to reset from Settings.

> **Use responsibly.** `facebook-scraper` is an unofficial client for *public* content. Scrape only
> pages/groups you have permission to collect, respect Facebook's terms and rate limits, and never
> use it against private data. Junction is not affiliated with Meta Platforms.

## Project layout

```
src/
  App.tsx                  # hash router + shell composition
  lib/
    types.ts               # User, Post, Comment, Story, Conversation, bundle types…
    seed.ts                # the demo network (people, posts, groups, listings, events…)
    store.tsx              # reducer-ish store + localStorage persistence + actions
    router.tsx             # tiny hash router (#/profile/priya, #/groups/g1…)
    util.ts                # reactions, time formatting, colors, helpers
    media.ts               # image upload → downscaled data URL
  components/
    Chrome.tsx             # top bar, left rail, right rail, mobile nav
    PostCard.tsx           # reactions, comments, share sheet, post menu, media
    Composer.tsx           # create-post modal
    Stories.tsx            # story tray + viewer
    SearchOverlay.tsx      # ⌘K search
    ui.tsx                 # Avatar, Modal, toasts, lightbox, overlay context
    Breadcrumb.tsx
  pages/                   # Home, Friends, Groups, Watch, Marketplace, Profile,
                           # Messages, Notifications, Saved, Memories, Events,
                           # Settings, Import, Games, About
  styles/global.css        # design tokens, layout system, dark theme, responsive
tools/
  fb_import.py             # facebook-scraper → Junction bundle CLI
  make_sample_bundle.py    # offline sample bundle generator
public/
  assets/{avatars,covers,photos,videos}   # AI-generated demo media
  data/imports/sample-page.json           # sample bundle for the importer
```

### State model

`src/lib/store.tsx` keeps one JSON object (`AppState`) in React state and mirrors it to
`localStorage` under `junction.state.v4` (debounced). Actions are plain functions on the store:
`toggleReaction`, `addComment`, `createPost`, `sharePost`, `acceptRequest`, `sendMessage`,
`joinGroup`, `toggleListingSave`, and so on. Post IDs, comment IDs, and conversation IDs are stable
so deep links like `#/post/p1` work. Imports add page accounts (`fb-<handle>`) with their posts at
the top of the feed.

### Routes

`#/` · `#/friends` · `#/friends/requests` · `#/groups` · `#/groups/:id` · `#/watch` ·
`#/marketplace` · `#/marketplace/:id` · `#/profile/:id` · `#/messages` · `#/messages/:id` ·
`#/notifications` · `#/saved` · `#/memories` · `#/events` · `#/events/:id` · `#/settings` ·
`#/import` · `#/games` · `#/about` · `#/post/:id`

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` / `/` | Open search |
| `↑` `↓` `↵` | Move through results / open |
| `Esc` | Close any overlay, modal, or story |
| `←` `→` | Previous / next story |

## Deploy

The app is a static Vite build, so any static host works.
**Install** `npm install` · **Build** `npm run build` · **Output** `dist`.

Because routing is hash-based, no rewrite rules are needed.

## Attribution

- Portraits, photography, and video in `public/assets` are **AI-generated** for this demo.
- Sample imported page data is fictional; the scraper tool targets public Facebook pages only when
  you run it yourself.
- `facebook-scraper` is MIT-licensed; see its [repository](https://github.com/kevinzg/facebook-scraper).
- Junction is an independent demo and is **not affiliated with Meta Platforms**.
