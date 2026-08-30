# Claude Code — terminal simulator

A browser recreation of the [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI: the real
text UI — box-drawn panels, the streaming transcript, `⎿` tool results, diffs, permission prompts, the
context meter, vim bindings, slash commands — driven by a **scripted local agent over a virtual repo**.

No API keys, no network, no backend. Everything happens in the tab, and the terminal is real
(xterm.js rendering an ANSI screen buffer this repo writes to).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 78 tests on node's built-in runner, no framework
npm run build && npm run preview   # production bundle on :4173
```

Type `claude` at the shell prompt that greets you, or open `?demo=1` to watch a whole bug-fix session
type itself.

## What is actually simulated

The agent is a scenario router, not a language model. Prompts are matched against a library of scripted
sessions; the "tools" they call run for real against a virtual working tree — reads list real lines,
edits apply as real text replacements, `git diff` prints a real unified diff computed from the file it
just changed, and `npm test` re-derives its results from the files on that tree.

That means a fix shown in the transcript is a fix you can inspect:

| Prompt | What happens |
| --- | --- |
| `why are the tests failing? fix it` | reproduces the failure, finds `parseSortKey`, edits `src/util/sort.js`, re-runs the suite, shows `7 tests passed` |
| `fix the sql injection in the store` | parameterises the queries, adds an allowlist, runs the tests |
| `add a body size limit to the api` | writes `readJson`, edits the router, adds tests, lints |
| `add keyset pagination to /api/mixtapes` | plans it, asks, edits `src/store.js` + `src/routes.js`, admits the suite is still red on an unrelated case |
| `refactor the log call sites` | reads the graph, splits `routes.js`, reports lines added/removed |
| `write the README for this repo` | reads the source, writes `README.md` into the virtual repo, shows the diff |
| `explain this codebase` | grounded tour with a real file table |

The repo is `pocketmix`, a deliberately small Express-ish app (16 files) with **one planted bug** so the
fix-it flow has something true to say. `/init` writes a `CLAUDE.md`, `Esc Esc` rewinds the tree to a
checkpoint, `/undo` is not needed because every turn is snapshotted.

## Keyboard

| Key | |
| --- | --- |
| `Enter` | submit · `Shift`/`Alt`+`Enter` or `\`+`Enter` for a newline |
| `Esc` | interrupt a turn · dismiss a popup · `Esc Esc` to rewind |
| `Tab` | accept a completion (slash commands, `@file` mentions) |
| `↑ / ↓` | history at an empty prompt, selection inside dialogs |
| `Shift+Tab` | cycle `manual → accept edits → plan → auto` |
| `Ctrl+O` | expand tool output and thinking |
| `Ctrl+R` | reverse-search the prompt history (type to filter) |
| `Ctrl+T` | show/hide the task panel |
| `Ctrl+C` | copy if there is a selection, else clear the prompt (`Ctrl+C Ctrl+C` exits) |
| `Ctrl+L` | clear screen · `Ctrl+K/U/W/A/E/B/F/D/H` readline edits |
| `?` | shortcut sheet |

Vim mode (`/vim`) puts the prompt in `NORMAL` on `Esc`: `h l 0 $ w b e` move, `i a A I` enter insert, `x`
and `dd` delete, `cw` change a word, `gg` / `G` jump, all on the input line.

## Slash commands

`/help /demo /play /clear /compact /context /cost /model /theme /status /config /doctor /permissions
/vim /init /mcp /agents /hooks /export /copy /transcript /resume /stats /statusline /terminal-setup
/review /pr-comments /login /logout /bug /exit`

`/model` and `/theme` open pickers; `/export` takes `cast | md | ansi | txt`; `/compact` actually
collapses the transcript and releases tokens; `/login` explains that this build has no live backend
(`agent.api` is the extension point if you want to wire one).

## Sharing and recording

* `Recorder` captures every ANSI payload with timestamps → **asciinema v2 `.cast`** (`/export cast`, or
  the toolbar). Drop the file on asciinema.org/player and it plays.
* `?replay=4` (or the Replay button) re-types the current session at 4× into the same terminal.
* `Copy ANSI` puts the transcript on the clipboard with colours intact, so a paste into a terminal or a
  PR comment still looks like the CLI.
* `/export md` wraps the plain transcript in a markdown document.
* Sessions persist to `localStorage` (≤12) and come back via `/resume`.

## URL parameters

```
?prompt=why%20are%20the%20tests%20failing        pre-filled first turn
?scenario=fix-tests                              route straight to a scenario
?demo=1                                          scripted session, types itself
?autoplay=1                                       …without the demo prompt
?speed=3                                          pacing multiplier
?theme=light|dark|ansi
?cols=120&rows=36&fit=0                          fixed geometry (fit addon off)
?font=14                                          font size, persisted
?replay=4                                         replay the recording at speed
```

`src/tui/app.js` is DOM-free and ANSI-only, so the same app can be driven headlessly — that is how the
tests work:

```js
import { createHarness, settle } from './tests/helpers/harness.js';
const h = createHarness({ cols: 104, rows: 34 });
h.keys('fix the failing tests and run them');
h.press('\r');
await settle(h.app, { answer: '2' });   // answers permission prompts with option 2
console.log(h.app.fullTranscriptPlain());
h.dispose();
```

## Layout

```
src/ansi/     text.js widths, wrapping, fit, formatters · screen.js cell buffer + frame diff
              theme.js dark/light/ansi palettes, memoised SGR interning
src/ui/       markdown.js md → styled runs (tables, fences, nowrap rows) · diff.js line diff + Edit
              semantics · highlight.js tiny js/ts/bash/html lexer
src/app/      vfs.js the virtual repo · tools.js Read/Glob/Grep/Write/Edit/Bash + a shell
              scenarios.js the scripted sessions · agent.js turn loop, approvals, usage, compaction
src/tui/      app.js layout, input, dialogs, keys, export · render.js every line builder
              spinner.js frames, verbs, "✻ Brewed for 4s"
src/share/    recorder.js asciinema v2 + parseCast
src/main.js   xterm wiring, resize/fit, clipboard, toolbar, session storage
```

Two decisions worth knowing about:

1. **The screen is diffed, not appended.** `Screen.diff()` emits only the cells that changed, so a
   browser resize (or a mid-turn wrap change) repaints cleanly instead of garbling history. On turn end
   the full transcript is dumped into xterm's native scrollback, where selection and copy behave.
2. **Agent decides content, TUI owns presentation.** The Agent never touches ANSI or the DOM; the TUI
   never decides what Claude says. Anything you want to change about looks lives in `src/tui/render.js`.

## Extending

* **New scenario** — add an object to `SCENARIOS` in `src/app/scenarios.js` with `match(prompt, ctx)`
  and `plan(ctx)`. Steps are `think | text | tool | todos | notice | error | wait`; `text.md` may be a
  function of `ctx` so the prose can quote real test tallies (`ctx.tests().pass`). Keep the arithmetic in
  the plan: `editFrom()` derives each `Edit`'s `old_string` from the live tree, so edits apply instead of
  failing.
* **New tool** — implement it in `src/app/tools.js`, add it to the `Agent.exec` switch, and give
  `needsApproval` an opinion about whether it should ask.
* **New look** — themes in `src/ansi/theme.js`; box-drawing and every line builder in `src/tui/render.js`.

## Notes

Unofficial fan project, not affiliated with Anthropic. Nothing is sent anywhere: no fetch, no keys, no
telemetry. The mock shell has no network egress on purpose — `curl` says so.
