# arena

**ARENA AI**

## Kimi AI Test Playground

A zero-dependency web app for testing [Kimi](https://www.moonshot.ai/) (Moonshot AI) chat models in the browser.

### Features
- 💬 Live chat with streaming (SSE) responses
- 🔑 API key stays in your browser's `localStorage` — never written to disk by the server
- 🔀 Dual connection mode: **Direct** (browser → Moonshot) or **Proxy** (via the server), with automatic fallback
- 🤖 Model picker (auto-loads your account's available models from `/v1/models`)
- 🎛️ Tunables: system prompt, temperature, top-p, max tokens, stream on/off
- ⏱️ Per-message stats: first-token latency, total time, prompt/completion tokens
- 🧪 One-click quick tests (identity, math reasoning, logic trap, codegen, creativity)

### Run it

```bash
npm start          # serves on http://localhost:3000
# or
PORT=8080 node server.js
```

Then open the app, click ⚙️, paste your Moonshot API key (from <https://platform.moonshot.ai>), hit **Test connection**, pick a model, and chat.

### How it works

```
Browser (UI + your key in localStorage)
   │
   ├─ Direct mode:  https://api.moonshot.ai/v1/*   (browser calls Moonshot itself)
   │
   └─ Proxy mode:   server.js ── /api/chat   → https://api.moonshot.ai/v1/chat/completions (streamed)
                              └─ /api/models → https://api.moonshot.ai/v1/models
```

**Auto mode** probes direct first and falls back to the proxy automatically (e.g. if CORS or a
firewall blocks one of the paths). Use **Proxy** when you want the key to travel only app→server→Moonshot.

Environment variables:

| Variable             | Default                        | Purpose                          |
| -------------------- | ------------------------------ | -------------------------------- |
| `PORT`               | `3000`                         | HTTP port to listen on           |
| `MOONSHOT_BASE_URL`  | `https://api.moonshot.ai/v1`   | Upstream API base (e.g. switch to `https://api.moonshot.cn/v1` for the China endpoint) |

### Files

- `server.js` — static file server + streaming API proxy (no npm dependencies)
- `public/` — the chat UI (vanilla HTML/CSS/JS)
