# SpotAPIfy — a Spotify-style web player

A Spotify-like music web app built on the [`spotapi`](https://pypi.org/project/spotapi/)
Python package. It serves live Spotify catalog metadata (search, albums, artists,
playlists) through a Flask backend and renders it in a Spotify-style dark UI with a
full playback bar, queue, likes, and search.

![mode](https://img.shields.io/badge/modes-live%20%7C%20demo-1db954)

## Features

- **Live Spotify metadata** via `spotapi`'s anonymous public catalogue — no API key
  needed (runs on a dedicated worker thread since `SyncCatalogue` is thread-bound).
- **Offline demo mode** with a bundled catalog (6 artists, 10 albums, 60 tracks,
  8 playlists) so the app works with zero network access.
- **Synthesized audio previews** in demo mode — every track gets a deterministic,
  chiptune-style 12-second preview generated as WAV, so the player bar fully works.
- **Generated SVG cover art** — deterministic gradient covers for demo content, no
  external image assets required.
- **Spotify-style UI**: sidebar with playlists, greeting home page with quick picks,
  search with top-result layout and browse categories, album/artist/playlist detail
  pages with color-matched hero gradients, bottom player bar with shuffle / repeat /
  seek / volume / queue, liked songs and recents persisted in `localStorage`.

## Quick start

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

Open http://localhost:5000

## Modes

Controlled with the `SPOTAPI_MODE` environment variable:

| Mode   | Behaviour |
|--------|-----------|
| `auto` | (default) Probe Spotify via `spotapi`; use live data if reachable, else the demo catalog |
| `live` | Always use live Spotify metadata |
| `demo` | Always use the offline demo catalog |

```bash
SPOTAPI_MODE=demo .venv/bin/python app.py
```

Live mode uses spotapi's anonymous public catalogue. To unlock personalized
endpoints, export your Spotify cookie string:

```bash
export SPOTIFY_COOKIES='sp_dc=...; sp_key=...'
```

> Note: live mode streams real metadata but not audio (Spotify's catalogue API
> exposes no playable previews); the player links out to open.spotify.com.
> Demo mode is the full end-to-end experience with synthesized audio.

## Project layout

```
app.py              Flask app + JSON API routes
spotify_service.py  Provider layer: SpotapiService (live) + DemoService (offline)
demo_catalog.py     Bundled artists / albums / tracks / playlists
audio_synth.py      Deterministic WAV preview synthesis (cached in .cache/)
covers.py           Deterministic SVG cover art generator
static/             Single-page frontend (index.html, styles.css, app.js)
```

## API

| Endpoint | Description |
|---|---|
| `GET /api/status` | Active mode and provider health |
| `GET /api/home` | Greeting page sections and quick picks |
| `GET /api/search?q=…` | Tracks, albums, artists, playlists, top result |
| `GET /api/album/<id>` / `artist` / `playlist` / `track` | Detail views |
| `GET /api/covers/<id>.svg?kind=…` | Generated cover art |
| `GET /api/preview/<id>.wav` | Synthesized audio preview (demo tracks) |
