# ◆ Arena Code Agent

A personal AI coding agent with a real Linux terminal, a full file editor and git
version control — all in one browser window. The agent loop runs on
[Inception Labs' Mercury](https://docs.inceptionlabs.ai) models (Mercury 3 by default).

Unlike a chat window that only talks about code, this agent **acts**: it reads your
repository, writes and patches files, runs real shell commands in a PTY, runs your
tests, and commits the result.

```
┌──────────────┬───────────────────────────────┬──────────────────────┐
│  Explorer    │   Agent chat                  │  Editor (Monaco)     │
│  Search      │   streaming answers           │  multi-tab           │
│  Source      │   tool cards you can expand   │  syntax highlighting │
│  control     │   approval prompts            ├──────────────────────┤
│              │                               │  Terminal (xterm.js) │
│              │                               │  real bash + PTY     │
└──────────────┴───────────────────────────────┴──────────────────────┘
```

---

## Quick start

```bash
cd arena
npm install
cp .env.example .env        # then add your Inception Labs API key
npm start
```

Open <http://localhost:3000>.

Get an API key from <https://platform.inceptionlabs.ai>. Your key stays on the
server — it is never sent to the browser.

> **Building on a machine without network access?** `node-pty` is a native module.
> If its prebuilt binary cannot be downloaded, point node-gyp at local headers:
> `npm_config_nodedir=/usr/local npm install`.

### Configuration

Everything lives in `.env`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `INCEPTION_API_KEY` | — | **Required.** Your Inception Labs key. |
| `INCEPTION_BASE_URL` | `https://api.inceptionlabs.ai/v1` | API base URL. |
| `INCEPTION_MODEL` | `mercury-3` | Default model. |
| `INCEPTION_TEMPERATURE` | `0.7` | Inception only accepts 0.5–1.0; values are clamped. |
| `INCEPTION_MAX_TOKENS` | `16384` | Max output tokens per step. |
| `INCEPTION_REASONING_EFFORT` | `medium` | `instant`, `low`, `medium`, `high`. |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Where the web server listens. |
| `WORKSPACE_ROOT` | the repo | Directory the agent may read/write/run in. |
| `AGENT_TOKEN` | empty | Optional shared secret required to connect. |
| `AGENT_MAX_STEPS` | `40` | Tool-call steps allowed per turn. |
| `AGENT_COMMAND_TIMEOUT_MS` | `120000` | Per-command timeout. |

Models are **not** hardcoded in the UI: the model menu is filled from
`GET /v1/models`, so any model your key can use appears automatically.

---

## What it can do

### 1. A real Linux terminal

The terminal panel is `xterm.js` wired to a genuine PTY (`node-pty`) running your
login shell — not a simulated command line. `vim`, `top`, `git rebase -i`, `htop`
and anything else that needs a TTY work, because it **is** a TTY.

* Full colour, mouse reporting, resize handling, 5 000 lines of scrollback
* Reconnects automatically if the socket drops
* Interactive programs work; the agent's own commands use a separate
  non-interactive runner so it never hangs on a prompt

### 2. File editing

* **Monaco** editor (the engine behind VS Code) with syntax highlighting for
  ~40 languages, a dark theme, multi-tab editing and ⌘S / Ctrl+S to save
* Explorer tree, create file/folder, rename, delete, search across the repo
* Automated tests cover the agent's `edit_file` path, including the case where an
  edit target is ambiguous (it refuses rather than guessing)

### 3. Git version control

A source-control panel with branch, ahead/behind, changed files, commit box,
stage-all and recent log. One click on a changed file shows its diff.

### 4. The agent itself

The agent uses **native tool calling** (not JSON-in-prose scraping), streaming
results as it goes:

| Tool | Purpose |
| --- | --- |
| `list_dir`, `find_files`, `search` | Explore the repository |
| `read_file` | Read with line numbers and optional ranges |
| `write_file`, `create_file` | Create or fully rewrite files |
| `edit_file` | Surgical find/replace; refuses ambiguous matches |
| `rename_path`, `delete_path`, `mkdir` | Organise the tree |
| `run_command` | Run anything: builds, tests, package managers |
| `git_status`, `git_diff`, `git_log`, `git_stage`, `git_commit`, `git_branch` | Version control |
| `finish` | Signal completion with a summary |

**Approval mode.** Flip *Approve edits* in the chat header and the agent pauses
before every write, delete or command, showing you exactly what it wants to do.
"Skip" sends the refusal back to the model so it can adapt instead of retrying.
With approvals off, the agent runs autonomously.

---

## Security model

This tool runs code, so the boundaries matter:

* **Path sandbox.** Every path is resolved against `WORKSPACE_ROOT`, and
  `..`-traversal *and* symlinks that point outside are rejected. Covered by tests.
* **API key isolation.** The key lives only in the server process. The browser
  never sees it; all model calls are proxied.
* **Output sanitising.** Model output is rendered as Markdown with `<script>`,
  `<iframe>`, `on*` handlers and `javascript:` URLs stripped before insertion.
* **Process hygiene.** Commands run in their own process group and are killed on
  timeout; terminal sessions are terminated when the socket closes.
* **Optional auth.** Set `AGENT_TOKEN` to require a shared secret on every HTTP
  and WebSocket connection.
* **Prompt discipline.** The system prompt forbids exfiltration of secrets and
  destructive system commands.

It is still a coding agent with shell access: run it against a workspace you
trust, not as a public sandbox for untrusted users.

---

## Architecture

```
server/
  index.js      Express REST API + two WebSocket endpoints (/ws/agent, /ws/terminal)
  diagnostics.js Staged connectivity checks: DNS → TCP → TLS → HTTP → auth → models
  doctor.js     `npm run doctor` — the same checks as a CLI report
  agent.js      The agent loop: stream → tool calls → results → repeat
  inception.js  Inception Labs client: SSE streaming, tool-call assembly, retries
  tools.js      18 tool definitions + implementations
  workspace.js  Sandboxed filesystem (traversal & symlink guards), search, glob
  git.js        Git operations
  terminal.js   PTY session manager
  exec.js       One-shot command runner with timeout & process-group kill
public/
  index.html    The IDE shell
  app.js        Client: chat, trees, tabs, terminal, git panel
  styles.css    Dark theme
test/
  smoke.js          REST API, sandboxing, PTY terminal (17 assertions)
  ui.js             Boots the real client in jsdom (15 assertions)
  mock-inception.js A fake streaming Inception API for offline testing
  agent-e2e.js      Full agent loop against the mock (17 assertions)
  approval.js       Approval gating in "ask" mode (7 assertions)
  diagnostics.js    Connectivity stages, error messages, working-API round trip
  run-all.sh        Runs everything
```

The agent loop is deliberately simple and inspectable:

```js
for (step = 0; step < maxSteps; step++) {
  stream = chatStream({ messages, tools })       // stream text + tool calls
  messages.push(assistantMessage)                 // record the turn
  for (call of toolCalls) {
    result = execute(call)                        // real side effects
    messages.push({ role: 'tool', content: result })
  }
}
```

Text is forwarded to the browser as it streams; tool calls are assembled from
their SSE fragments, executed, and the results fed back until the model stops
calling tools or calls `finish`.

---

## Tests

```bash
npm test
```

```
19 passed   backend: REST, sandbox escapes, real PTY command execution
11 passed   diagnostics: staged DNS/TCP/TLS/HTTP reporting, error messages
19 passed   UI: client boots, tree/git/chat render, XSS stripped, diag card
17 passed   agent loop: streaming, tool calls, real file writes, git tools
 7 passed   approval gate: risky tools pause, denials reach the model
```

The end-to-end suites run against `test/mock-inception.js`, a local server that
speaks the same SSE protocol as Inception Labs (including fragmented tool-call
arguments), so the agent loop is verified without spending tokens or needing
network access.

---

## API reference

Beyond the UI, the server exposes a small REST API (all under `/api`):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Status, workspace, model, key present, API reachable |
| `GET` | `/diagnostics` | Staged connectivity report: DNS → TCP → TLS → HTTP → auth → models |
| `GET` | `/models` | Live model list from Inception |
| `GET` | `/files?path&depth` | Directory listing |
| `GET`/`PUT`/`POST`/`DELETE` | `/file` | Read, write, create, delete |
| `POST` | `/rename` | Move a file or directory |
| `GET` | `/search?q&pattern&regex` | Content search |
| `GET` | `/git/status`, `/git/diff`, `/git/log`, `/git/branches` | Read git state |
| `POST` | `/git/stage`, `/git/unstage`, `/git/commit`, `/git/checkout`, `/git/push`, `/git/pull`, `/git/init` | Mutate git state |
| `POST` | `/exec` | One-shot command |

WebSocket `/ws/agent` speaks JSON: `chat`, `abort`, `approval`, `reset`,
`set_model`, `set_approval_mode`, and emits `turn_start`, `text_delta`,
`tool_call`, `tool_result`, `approval_request`, `usage`, `error`, `turn_end`.

---

## Troubleshooting

### "Could not reach Inception Labs"

Run the built-in connectivity check — it walks the connection one stage at a time
and tells you exactly where it breaks:

```bash
npm run doctor
```

```
Inception Labs connectivity check
  base url   https://api.inceptionlabs.ai/v1
  api key    set (…b0ec)

  ✓ DNS resolution   12 address(es): 3.163.175.77 (IPv4), …
  ✓ TCP connection
  ✗ TLS handshake
  ✗ HTTP response

✗ The connection to api.inceptionlabs.ai was reset during setup
  What to do: The TCP connection opened but something reset it before/while the
  TLS handshake completed. That pattern is almost always an egress firewall or
  proxy allowlisting specific hosts …
  error code: ECONNRESET
```

The same report is available in the browser (**Diagnose connection** appears on
any network error, and at startup if the API is known to be unreachable) and over
HTTP at `GET /api/diagnostics`.

**What each stage means**

| Stage that fails | Meaning | Fix |
| --- | --- | --- |
| DNS | The hostname does not resolve | Check DNS and `INCEPTION_BASE_URL` |
| TCP | Nothing answers on the port | Firewall; or nothing is listening |
| TLS | TCP opened, then reset during the handshake | **Egress allowlist / firewall / VPN** — allowlist `api.inceptionlabs.ai` |
| HTTP | Connected, but got an error status | Base URL path, or API outage |
| API key | 401/403/402 from the API | Wrong/revoked key, or inactive billing |

A **TLS-stage reset with a working TCP connection** is the signature of an egress
allowlist: the packet is dropped rather than answered, which is why the error
surfaces as a bare `ECONNRESET` / `fetch failed`. Compare against a host that is
known to work:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.inceptionlabs.ai/
curl -s -o /dev/null -w '%{http_code}\n' https://registry.npmjs.org/
```

If the second prints `200` and the first prints `000`, the network — not the app —
is blocking Inception. Run the agent somewhere with unrestricted outbound HTTPS,
or allowlist the host.

**"No Inception Labs API key configured"** — add `INCEPTION_API_KEY` to `.env` and
restart.

**"Inception Labs rejected the API key (401)"** — the key is wrong or revoked;
generate a new one.

**"That model is not available on this account"** — older and newer keys can see
different models. Pick another entry from the model menu. Note `mercury-coder`
was retired in favour of Mercury 2/3.

**Terminal shows nothing** — the PTY needs to build against your Node version.
Reinstall with local headers: `npm_config_nodedir=$(dirname $(dirname $(which node))) npm rebuild node-pty`.

**Editor is blank** — Monaco is served from `node_modules/monaco-editor/min/vs`.
Run `npm install` again if that folder is missing.

---

## License

MIT — see [LICENSE](LICENSE).
