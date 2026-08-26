# arena

One web app, two backends, switchable in the UI:

| Mode | Backend | Key env var | Default base URL |
| --- | --- | --- | --- |
| **stealth/ox-alpha** | [OpenRouter](https://openrouter.ai) | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` |
| **big-pickle** | [OpenCode Zen](https://opencode.ai/zen) | `OPENCODE_API_KEY` | `https://opencode.ai/zen/v1` |

Both upstreams are OpenAI-compatible (`POST /chat/completions`, SSE streaming,
`data: [DONE]` terminator), so a single client in `lib/upstream.js` serves both;
only the base URL, key and headers differ.

**No dependencies.** Node ≥ 20 built-ins only (`node:http`, global `fetch`,
`node:test`). `npm install` is unnecessary.

## Run

```bash
cp .env.example .env      # then paste your keys into .env
npm start                 # http://localhost:3000
```

Bind address defaults to `0.0.0.0` so it works behind a preview host or reverse
proxy; the browser only ever calls same-origin relative URLs, so keys stay in
the server process and CORS is a non-issue.

```bash
npm test                  # 11 integration + unit tests against a fake upstream
```

## Layout

```
server.js          http server, routing, request validation, SSE proxy, static files
lib/env.js         .env loading (no deps), mode registry, key masking
lib/upstream.js    OpenAI-compatible client (chat completions + models, errors, timeouts)
public/            index.html, styles.css, app.js — the two-mode chat UI
test/app.test.js   boots the real server against a fake OpenRouter/Zen upstream
.env.example       configuration template (real .env is git-ignored)
```

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/config` | Mode list, base URLs, models, and whether each key is set (masked) |
| `POST` | `/api/chat` | `{ mode: "stealth"\|"pickle", messages: [{role, content}], stream?: bool, model?: string }` → SSE stream, or JSON when `stream: false` |
| `GET` | `/api/health` | Per-provider `GET /models` probe (`skipped: true` when the key is absent) |

Errors come back as `{ "error": { "status", "message", ... } }`. An upstream
401 (bad key) is passed through with its message; a missing key is a `503` that
names the env var, and never reaches the network.

Request limits: 256 KiB body (`MAX_BODY_BYTES`), 64 messages (`MAX_MESSAGES`),
60 s upstream timeout (`UPSTREAM_TIMEOUT_MS`), roles restricted to
`system|user|assistant` with non-empty string content.

## Configuration

Everything is env-var driven — see `.env.example`. Notables:

- `OPENROUTER_MODEL` / `OPENCODE_MODEL` — any provider model slug; the UI can
  also override per request via the `model` field.
- `OPENROUTER_SITE_URL` / `OPENROUTER_APP_TITLE` — sent as `HTTP-Referer` /
  `X-Title` for OpenRouter rankings.
- `OPENCODE_API_KEY` is also accepted as `OPENCODE_ZEN_API_KEY`, and
  `OPENROUTER_API_KEY` as `OPENROUTER_KEY`.

## Security

- `.env` and `.env.*` are git-ignored; `.env.example` ships with empty values.
- Keys are read from the environment per request and are never logged, never
  returned by any endpoint, and never sent to the browser. `/api/config` shows
  only a mask like `sk-or-v1-a...wxyz` (10 leading + 4 trailing characters).
- Static serving refuses paths outside `public/`.
- **Rotate any key that has been pasted into chat, a ticket, or a screenshot.**
  Once a secret has been in a message it should be treated as public.

## Notes on this sandbox

Outbound HTTPS from the sandbox is allowlisted (npm registry reachable, provider
APIs are not — the TLS handshake to `openrouter.ai` and `opencode.ai` fails), so
the live upstreams cannot be exercised here. `npm test` therefore drives the real
`server.js` against a fake OpenAI-compatible upstream on `127.0.0.1`, covering
streaming, non-streaming, key forwarding, OpenRouter attribution headers, 401
pass-through, missing-key handling, validation limits, health probes, static
serving and path traversal. Point `OPENROUTER_BASE_URL` / `OPENCODE_BASE_URL` at
a mock the same way to test locally.
