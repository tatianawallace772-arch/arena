# 🐋 deepseek-tui

A **DeepSeek-style chat interface for your terminal**, recreated in Rust with
[ratatui](https://ratatui.rs) — DeepSeek-blue branding, a chat-history
sidebar, message bubbles, and replies that stream in word-by-word like the
real thing.

> **This is a simulator.** It is fully offline: there is no API client, no
> API key, and no model. Replies come from a keyword-matching "mock brain"
> (`src/mock.rs`) with fake latency, so the UI feels alive with zero setup.
> Not affiliated with DeepSeek — it's a fan-made homage.

---

## Features

- 💬 **Chat sessions** — create, switch, and delete chats; titles are picked
  automatically from your first message
- 🌊 **Simulated streaming** — a "thinking…" spinner, then words arrive with
  human-ish pacing (longer pauses after punctuation)
- 🎨 **DeepSeek look** — `#4D6BFE` brand blue, assistant bubbles with the
  whale, right-aligned user bubbles, chat sidebar, status bar
- ⌨️ **Real editing** — char/word editing, sent-message history recall
  (↑/↓), horizontal input scroll for long lines
- 🖱️ **Mouse support** — wheel to scroll, click chats in the sidebar, click
  the **+ New chat** button
- 📜 **Scrollback** — PgUp/PgDn or the wheel; the view auto-follows while
  streaming unless you scroll up
- ❓ **Help overlay** — `F1`
- 🦀 **Zero-config** — two dependencies (`ratatui`, `crossterm`), no config
  files, nothing persisted

## Quick start

Requires Rust **1.74+** ([install via rustup](https://rustup.rs)).

```bash
cd deepseek-tui
cargo run --release
```

That's it. Type a message and press **Enter**.

## Controls

| Key                | Action                                        |
| ------------------ | --------------------------------------------- |
| `Enter`            | Send message                                  |
| `Tab`              | Switch focus: input ⇄ chats sidebar           |
| `↑` / `↓`          | Recall sent messages (input) · select chat (sidebar) |
| `PgUp` / `PgDn`    | Scroll the conversation                       |
| `Mouse wheel`      | Scroll the conversation                       |
| `Ctrl+N`           | New chat                                      |
| `d`                | Delete selected chat (sidebar focus)          |
| `←` / `→`          | Move cursor (with `Ctrl`: jump by word)       |
| `Ctrl+W` / `Ctrl+U`| Delete word / clear input line                |
| `Home` / `End`     | Jump to start / end of input                  |
| `F1`               | Help overlay                                  |
| `Esc` / `Ctrl+C`   | Quit                                          |

Messages sent while a reply is still streaming are **queued** and sent
automatically when the current reply finishes.

## Preview (no build required)

Open [`preview/index.html`](preview/index.html) in a browser — it's a static,
pixel-faithful mock-up of the TUI so you can see the design before
compiling. The real app is, of course, interactive.

## Teach the mock brain new tricks

All canned replies live in `src/mock.rs`. Add a `const REPLY: &str = "…"`
and a branch in `reply()`:

```rust
} else if p.contains("coffee") {
    COFFEE
}
```

`{q}` in a reply is replaced with a truncated quote of the user's prompt.
Streaming pacing (token delay, thinking time) lives in `src/app.rs`
(`tokenize`, `App::pump`) if you want it faster, slower, or snarkier.

## Project layout

```
deepseek-tui/
├── Cargo.toml
├── src/
│   ├── main.rs   # bootstrap + 60 FPS event loop
│   ├── app.rs    # state, keyboard/mouse handling, streaming engine
│   ├── ui.rs     # ratatui rendering (header, sidebar, bubbles, input, help)
│   ├── mock.rs   # the keyword-matching mock brain
│   └── rng.rs    # tiny xorshift PRNG (std-only)
└── preview/
    └── index.html  # static visual preview of the TUI
```

## Tests

```bash
cargo test
```

Covers the streaming tokenizer, the word-wrap estimator, input editing with
multi-byte characters, and mock-reply routing.

## License

CC0 1.0 (see [`../LICENSE`](../LICENSE)). Unofficial fan project — not
affiliated with or endorsed by DeepSeek.
