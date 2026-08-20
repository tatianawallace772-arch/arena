# Core Codex

**Core Codex** is a full-stack AI coding agent — a Z Code-style experience powered by the
latest **z.ai GLM models** (GLM-5.3, GLM-5.2, GLM-5-Turbo, GLM-4.7, GLM-4.7-Flash,
GLM-4.5-Air, GLM-4.5-Flash). No login, no build step, zero npm dependencies.

```
node server.js          # → http://localhost:3000  (PORT env var optional)
```

## What's inside

| Area | Details |
| --- | --- |
| **Agent workspace** | Streaming chat with live agent stage traces ("Understanding requirements → Writing app.js…"), multi-file projects rendered in a workspace panel as code streams in, syntax highlighting, per-file copy, one-click **.zip export** |
| **Models** | Full z.ai lineup, latest first — selectable per session, server-validated |
| **API keys (BYOK)** | Paste a z.ai API key in Settings → it's validated (format + live ping), stored **only in your browser**, and used to proxy generation through the live `api.z.ai` chat-completions API. No key? The built-in **Core Codex Local Engine** keeps everything working offline |
| **Secure checkout** | Plans mirroring the GLM Coding Plan (Lite **$18** / Pro **$72** / Max **$160** per month, **30% off** annual, quotas ~80 / ~400 / ~1,600 prompts per 5h). Server-authoritative pricing, Luhn + expiry + CVC validation server-side, simulated PSP authorization (test declines: `4000 0000 0000 0002`), animated processing state, receipt + confetti. **PAN is never stored — brand + last4 only** |
| **No login** | Plan, sessions, usage windows and keys live in `localStorage` — nothing to sign up for |

## End-to-end flow

1. **Landing** — hero, live terminal demo, model catalog, features.
2. **Agent** — describe a project ("build a todo app") → plan streams → files write live → download the `.zip`. Ask mode answers questions. Quotas enforced per plan (Z Code-style 5-hour windows).
3. **Pricing** — compare plans, toggle monthly/annual.
4. **Checkout** — pay (test card `4242 4242 4242 4242`, any future expiry) → plan activates instantly, header badge and quotas update.
5. **Settings** — manage your z.ai API key, default model, local data.

## Architecture

```
server.js        Node http server — static hosting + JSON/SSE APIs, rate limiting,
                 strict CSP, z.ai live proxy with automatic local fallback
engine.js        Core Codex Local Engine — staged plans, streamed multi-file
                 projects (todo app, landing page, snake game, REST API, Python
                 CLI, algorithms+tests, React component) and a knowledge base
public/          SPA (no framework, no build step)
  index.html     shell + routed views
  css/styles.css full design system
  js/lib.js      API client, SSE reader, markdown renderer, syntax highlighter,
                 ZIP writer (CRC32, store method), toasts/modals, local state
  js/agent.js    agent workspace (sessions, streaming chat, workspace panel)
  js/checkout.js pricing + secure checkout + receipt
  js/app.js      router, landing page, settings/upgrade modals
scripts/
  test-lib.js    headless tests: markdown, highlighter, ZIP validity
  test-ui.js     end-to-end DOM harness: runs the real frontend against the
                 real server (landing → generation → pricing → checkout)
```

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | service status + z.ai reachability |
| `GET /api/models` | z.ai model catalog |
| `GET /api/plans` | plan catalog (server-authoritative pricing) |
| `POST /api/keys/validate` | validate a z.ai API key (format + live check) |
| `POST /api/agent` | SSE generation stream (`meta`, `stage`, `file-start/-delta/-end`, `delta`, `notice`, `usage`, `done`) |
| `POST /api/checkout` | process an order (validation + simulated authorization) |
| `GET /api/orders/:id` | receipt lookup |

## Notes

- The z.ai path activates whenever a key is present **and** `api.z.ai` is reachable from
  the host. On networks where it isn't (like this sandbox), the app transparently falls
  back to the local engine — visible in the header chip — so the experience never breaks.
- Orders are appended to `data/orders.json` (PAN-free) and can be re-fetched by id.
