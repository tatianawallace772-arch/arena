# 🐟 Fish Audio Playground

A **browser-only test console** for the [Fish Audio](https://fish.audio) text-to-speech
API — pure HTML, CSS and vanilla JavaScript, no frameworks and no build step.

![stack](https://img.shields.io/badge/stack-HTML%20%2F%20CSS%20%2F%20JS-22d3ee)

## What it exercises

| Endpoint | Used for |
|---|---|
| `POST /v1/tts` | Speech synthesis (model, prosody, emotion markers, mp3/opus/wav) |
| `GET /model` | Voice library search, pagination, language filter, "my voices" |
| `GET /wallet/api/credit` | Live credit balance (refreshed after each generation) |

Plus client-side goodies: voice picker with cover art, emotion/delivery marker
chips (`[happy]`, `[whispering]`, `[emphasis]`, …), speed/volume/temperature
controls, generation history with replay & download, a request log that
shows how every call reached the API, and a **🎛 Sound Lab** powered by the
**Web Audio API** — play any generated clip (or a test-tone oscillator)
through a live graph of biquad filter → panner → gain → limiter → analyser,
with waveform overview, playhead, oscilloscope and spectrum views. The lab
runs entirely in the browser, no API credits needed.

## Run it

```bash
node server.js        # → http://localhost:8080   (zero dependencies)
```

Then paste your API key (from <https://fish.audio/app/api-keys/>) into the
**Connection** panel. To pre-fill it, copy `config.example.js` to `config.js`
and add the key there — `config.js` is **gitignored**.

Any other static host works too (`python3 -m http.server`, nginx, GitHub
Pages…), but then a CORS relay is required (see below).

## The CORS situation (why "transports"?)

`api.fish.audio` does **not** return `Access-Control-Allow-Origin`, so a
browser page opened from any other origin is blocked from calling it
directly. The app therefore supports three transports and auto-detects a
working one at startup:

1. **Local proxy** (best) — `server.js` forwards `/api/*` to
   `https://api.fish.audio` from Node, same-origin, no CORS involved, and
   your key never touches a third party.
2. **Direct** — browser → `api.fish.audio`. Kept in case Fish Audio enables
   CORS one day.
3. **CORS relay** — browser → public relay → `api.fish.audio`. Presets for
   [corsproxy.io](https://corsproxy.io) (free key from
   [console.corsproxy.io](https://console.corsproxy.io) recommended) and
   `api.cors.lol`, or paste any relay URL template containing `{url}`.

The transport actually used is shown in the header badge and in the request
log. Deploying your own relay is ~20 lines on Cloudflare Workers /
Deno Deploy if you don't want a shared one.

## Files

```
index.html          UI structure
style.css           dark ocean theme
app.js              transport layer, API client, UI logic
server.js           zero-dependency static server + /api proxy (Node 18+)
config.example.js   template for config.js (gitignored, holds the API key)
```

## Security notes

- The API key is kept in `localStorage` (and optionally gitignored
  `config.js`) — client-side only. **Anyone who opens the page can use it.**
  Fine for local testing, never fine for production.
- This repository is public: the key must never be committed. Rotate it at
  <https://fish.audio/app/api-keys/> if it leaks anywhere.
- For real apps, call Fish Audio from your backend and expose your own API
  to the browser.
- A public CORS relay sees your traffic (including the `Authorization`
  header). Prefer the local proxy when the key matters.

## Error codes the console maps for you

`400` bad reference id / params · `401` invalid key · `402` out of credits ·
`429` rate limit · `503` Fish Audio overloaded
