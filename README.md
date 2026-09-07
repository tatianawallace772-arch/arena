# Nano Banana Studio

A fully working AI image generator that needs **no API key, no signup, no backend and no build step**. It renders through Google's
**Nano Banana** models (Gemini image generation) using [Pollinations.AI](https://github.com/pollinations/pollinations)' public keyless
endpoint, entirely from your browser.

Open it, type a prompt, press <kbd>⌘/Ctrl</kbd>+<kbd>⏎</kbd>.

```bash
node server.js        # → http://localhost:3000
```

> The "server" is a 90-line static file host so ES modules load over `http://` instead of `file://`. There is no API anywhere in this
> repo — every request goes browser → provider, so nothing to deploy and nothing to pay for.

---

## What it does

| | |
|---|---|
| **Generate** | prompt → image, with model, aspect ratio, 1K/2K/4K tier, seed, batch size |
| **Nano Banana** | `nanobanana` (Gemini 2.5 Flash Image) is the default; `nanobanana-pro` (Gemini 3 Pro Image) for 4K + typography |
| **Graceful degradation** | if the provider gates a model behind a key, the app detects it, falls back to a model that answers (Flux → Turbo → Sana) and tells you which one served |
| **Style presets** | 12 one-click prompt treatments (editorial photo, cinematic, product studio, anime cel, 3D, watercolour, ink, logo, isometric, retro print, macro) |
| **Prompt doctor** | live specificity meter + "add a light source / name the medium / add a lens" hints |
| **Exclude** | "avoid: text, watermark, blur" folded into the prompt as natural language |
| **Batch + variations** | 1–4 images per run, each on its own seed, queued so the free tier does not reject them |
| **Seed control** | lock, roll, copy-from-result, per-image variations ×3 |
| **Edits (experimental)** | up to 8 reference image URLs for models that accept them (`image=` param) |
| **Download** | real blob download with a descriptive filename; falls back to "open full size" when the CDN blocks cross-origin reads |
| **History** | every render kept in `localStorage` (settings + provider URL, never bytes) — click a tile to restore the exact setup |
| **Share setup** | copies a URL that reproduces your prompt, style, model, ratio, seed, batch — token excluded |
| **Offline mock renderer** | draws deterministic SVG artwork in-page from prompt + seed. Zero network, same queue, same history. Great for demos, flights and CI |
| **Theme** | dark (default) / light, remembered. Reduced-motion and keyboard-only friendly |

## Why "no API key" has a rate limit

The keyless tier is anonymous and shared, so the provider allows roughly **one request every 15 seconds**, and free images **may carry a
watermark**. This app treats that as a design constraint rather than a surprise:

- every request goes through a **single-slot pacer**, so a batch of four renders at 15s spacing instead of 429-ing three times;
- `retry-after` on a 429 pushes the next slot out automatically and the UI shows a live cooldown bar;
- transient failures (429 / 5xx / timeout) retry, non-retryable ones (gated model, bad params) do not burn attempts — they trigger the
  model fallback instead;
- the copy always says what happened ("Rate limited — cooling down, then retrying"), never a bare error code.

If you *do* have a Pollinations token, paste it under **Advanced** for higher limits and watermark-free output. It stays in
`localStorage` on your machine and is never included in share links.

## Architecture

```
index.html          semantic markup; every control is a real form element
styles/app.css      design system: tokens, dark/light themes, responsive grid, reduced-motion
js/
  config.js         provider contract, model catalog, sizing maths, state sanitising   ← no DOM, no network
  prompts.js        style presets, prompt library, specificity heuristics              ← no DOM, no network
  pollinations.js   URL builder, fetch/<img> transports, error taxonomy, mock renderer
  queue.js          Pacer (free-tier spacing + back-off) and JobQueue (sequential, abortable)
  state.js          ~30-line observable store
  storage.js        localStorage + share-URL serialisation, quota-aware history
  main.js           UI builders, result cards, run pipeline, keyboard, theme, boot
server.js           zero-dependency static file server
tests/              56 tests: unit + jsdom integration (real page, real clicks)
```

Two transports, deliberately:

1. `fetch()` first — it can read status codes, so rate limits, gated models and 5xx get *different* handling, and the response becomes a
   Blob you can download without a second request.
2. `<img>` fallback — if the CDN omits CORS headers the read fails as a `TypeError`, and a plain image load still displays the render
   (download then degrades to "open full size").

State lives in one store; `localStorage` and the URL are both derived from it. Untrusted input (stored state, shared links) always passes
through `sanitizeState()`, which clamps models, ratios, sizes, seeds and reference URLs.

## Tests

```bash
npm test          # 56 tests: unit + jsdom integration (no dependencies needed)
npm run lint      # eslint, flat config, zero warnings
```

Coverage worth naming, because these are the bugs that actually bite:

- **sizing** — every ratio × tier resolves to an integer size on a 16px grid inside the model's cap; garbage custom sizes clamp;
- **URL building** — prompt survives percent-encoding, flags only sent when on, references repeated, empty token never sent;
- **error taxonomy** — 429/403/402/400/5xx/200-with-JSON-error map onto the right code, `retry-after` honoured;
- **pacing** — consecutive requests are spaced, `setInterval(0)` releases waiting jobs, a stricter pace never delays a scheduled one;
- **queue** — sequential, one failure does not stall the batch, `cancelAll()` aborts and drains;
- **persistence** — corrupt JSON returns null instead of throwing at boot, history caps at 60 and *trims itself on a quota error*;
- **share links** — round-trip every control, tokens never included, hostile query values rejected;
- **every control writes through** — each model chip, style preset, ratio tile, resolution tier, stepper, switch, seed field and select
  is *clicked* in jsdom and asserted to reach the store, the pacer and the derived hints (this is what catches a handler that quietly
  stopped setting anything);
- **the real page in jsdom** — boots `index.html` + `main.js`, then: types a prompt, watches the doctor react, generates a batch,
  asserts cards/`<img>` src/badges/specs/filmstrip/`localStorage`/URL, clicks Download and proves a mock render never touches the
  network, forces a `403 api key required` response and asserts the app **falls back to a working model and shows an image**, forces a
  `429` and asserts the cooldown message + retry affordance, restores a run from a history tile, and proves a second run does not revoke
  object URLs that are still on screen;
- **CSS** — parsed with css-tree and validated against the property dictionary; every class generated from JS must have a rule; every
  `var(--token)` must be defined in *both* themes; breakpoints, focus ring and reduced-motion must exist.

`npm i -D jsdom css-tree csstree-validator eslint globals @eslint/js` enables the integration + CSS tests; they self-skip when absent, so
`npm test` works on a bare checkout. `node scripts/shot.mjs` writes PNGs to `.shots/` when a headless Chromium is available.

## Using it as a plain page

`index.html` + `js/` + `styles/` are all you need. Drop the three paths into any static host (GitHub Pages, Netlify, an S3 bucket) and it
works — there is no bundler, no framework, no runtime dependency, and `package.json` exists only to hold scripts and optional dev tools.

Query parameters are honoured (short keys we emit, or the long names below), so any run is reproducible by URL:

```
?prompt=a%20corgi%20in%20a%20linen%20suit&model=nanobanana&aspect=16:9&seed=7&mock=1
```

## Legal / etiquette

- Generated images come from a third-party free service: expect watermarks on the anonymous tier, and no uptime promise.
- Keep the `referrer=nano-banana-studio` parameter — it is how the provider attributes keyless traffic, and it is what keeps this free.
- Output is whatever the provider's model terms allow; don't assume commercial rights.
- This repo is CC0 (see `LICENSE`): take it, rename it, ship it.
