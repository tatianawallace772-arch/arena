//! deepseek-tui — a DeepSeek-style chat interface for the terminal.
//!
//! An unofficial, fully offline *simulator*: chat sessions, DeepSeek-blue
//! styling, streaming replies — all powered by a keyword-matching mock brain
//! (`src/mock.rs`). No API key, no network.

mod app;
mod mock;
mod rng;
mod ui;

use std::io;
use std::time::{Duration, Instant};

use app::App;
use crossterm::event::{self, DisableMouseCapture, EnableMouseCapture, Event};
use crossterm::execute;
use ratatui::DefaultTerminal;

/// ~60 FPS event loop tick.
const TICK_MS: u64 = 16;

fn main() -> io::Result<()> {
    let mut terminal = ratatui::init();
    let result = run(&mut terminal);
    ratatui::restore();
    result
}

fn run(terminal: &mut DefaultTerminal) -> io::Result<()> {
    execute!(io::stdout(), EnableMouseCapture)?;
    let mut app = App::new();
    let mut last_tick = Instant::now();
    let result = event_loop(terminal, &mut app, &mut last_tick);
    execute!(io::stdout(), DisableMouseCapture)?;
    result
}

fn event_loop(
    terminal: &mut DefaultTerminal,
    app: &mut App,
    last_tick: &mut Instant,
) -> io::Result<()> {
    loop {
        if event::poll(Duration::from_millis(TICK_MS))? {
            if let Ok(ev) = event::read() {
                match ev {
                    Event::Key(k) => app.on_key(k),
                    Event::Mouse(m) => app.on_mouse(m),
                    _ => {}
                }
            }
        }

        let now = Instant::now();
        let dt = now.saturating_duration_since(*last_tick);
        *last_tick = now;
        app.on_tick(dt);

        if app.should_quit {
            return Ok(());
        }

        terminal.draw(|frame| ui::draw(frame, app))?;
    }
}
