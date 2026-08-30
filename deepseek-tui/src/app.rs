//! Application state: chat sessions, input editing, and the mock "streaming"
//! engine that reveals replies token-by-token with realistic pacing.

use std::collections::VecDeque;
use std::time::{Duration, Instant};

use crossterm::event::{
    KeyCode, KeyEvent, KeyEventKind, KeyModifiers, MouseButton, MouseEvent, MouseEventKind,
};
use ratatui::layout::{Position, Rect};
use ratatui::widgets::ListState;

use crate::mock;
use crate::rng::Rng;

const MAX_INPUT_CHARS: usize = 4096;
const SPINNER_MS: u16 = 80;
const MAX_FRAME_MS: u16 = 100; // clamp dt after suspends so streaming doesn't burst

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    User,
    Assistant,
}

#[derive(Debug, Clone)]
pub struct Message {
    pub role: Role,
    pub content: String,
    /// True while the assistant reply for this message is still streaming.
    pub streaming: bool,
}

#[derive(Debug, Clone)]
pub struct Session {
    pub title: String,
    pub messages: Vec<Message>,
    /// Rows scrolled up from the bottom. 0 = follow the newest message.
    pub scroll_up: u16,
    pub last_active: Instant,
}

impl Session {
    fn new() -> Self {
        Session {
            title: "New chat".to_string(),
            messages: Vec::new(),
            scroll_up: 0,
            last_active: Instant::now(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Focus {
    Input,
    Sidebar,
}

/// One chunk of a streamed reply plus the delay before the next chunk.
#[derive(Debug, Clone)]
pub struct Token {
    pub text: String,
    pub delay_ms: u16,
}

/// In-flight assistant reply.
pub struct StreamState {
    pub session: usize,
    pub msg_index: usize,
    pub tokens: Vec<Token>,
    pub pos: usize,
    /// Remaining "thinking" pause before the first token.
    pub thinking_ms: u16,
    pub budget_ms: f32,
}

/// Geometry captured during the last draw, for mouse hit-testing.
#[derive(Default, Clone)]
pub struct FrameAreas {
    pub input: Rect,
    pub sidebar: Rect,
    pub new_chat: Rect,
    /// (y_top, y_bottom, session index) hit rows inside the sidebar.
    pub sidebar_items: Vec<(u16, u16, usize)>,
}

pub struct App {
    pub sessions: Vec<Session>,
    pub current: usize,
    pub focus: Focus,
    pub input: String,
    /// Cursor position as a *character* index into `input`.
    pub cursor: usize,
    pub sent_history: Vec<String>,
    pub hist_pos: Option<usize>,
    /// Queued user messages: (session index, text). Sent while a reply is
    /// still streaming; drained once the current reply finishes.
    pub queue: VecDeque<(usize, String)>,
    pub streaming: Option<StreamState>,
    pub spinner: usize,
    spinner_ms: u16,
    pub tokens_estimate: usize,
    pub show_help: bool,
    pub should_quit: bool,
    pub rng: Rng,
    pub list_state: ListState,
    pub frame_areas: FrameAreas,
}

impl App {
    pub fn new() -> Self {
        App {
            sessions: vec![Session::new()],
            current: 0,
            focus: Focus::Input,
            input: String::new(),
            cursor: 0,
            sent_history: Vec::new(),
            hist_pos: None,
            queue: VecDeque::new(),
            streaming: None,
            spinner: 0,
            spinner_ms: 0,
            tokens_estimate: 0,
            show_help: false,
            should_quit: false,
            rng: Rng::from_entropy(),
            list_state: ListState::default(),
            frame_areas: FrameAreas::default(),
        }
    }

    // ------------------------------------------------------------------ tick

    /// Advance animations and the streaming engine. Called once per loop.
    pub fn on_tick(&mut self, dt: Duration) {
        let ms = (dt.as_millis().min(u16::MAX as u128) as u16).min(MAX_FRAME_MS);

        self.spinner_ms = self.spinner_ms.saturating_add(ms);
        while self.spinner_ms >= SPINNER_MS {
            self.spinner_ms -= SPINNER_MS;
            self.spinner = (self.spinner + 1) % 10;
        }

        let mut done = false;
        if let Some(st) = &mut self.streaming {
            if st.thinking_ms > 0 {
                st.thinking_ms = st.thinking_ms.saturating_sub(ms);
            } else {
                st.budget_ms += ms as f32;
                loop {
                    let Some(tok) = st.tokens.get(st.pos) else {
                        done = true;
                        break;
                    };
                    let delay = tok.delay_ms as f32;
                    if st.budget_ms + 0.001 < delay {
                        break;
                    }
                    st.budget_ms -= delay;
                    st.pos += 1;
                    let text = tok.text.clone();
                    let session = &mut self.sessions[st.session];
                    let msg = &mut session.messages[st.msg_index];
                    msg.content.push_str(&text);
                    self.tokens_estimate += (text.trim().len() + 3) / 4;
                    session.last_active = Instant::now();
                }
            }
        }

        if done {
            if let Some(st) = self.streaming.take() {
                if let Some(msg) = self
                    .sessions
                    .get_mut(st.session)
                    .and_then(|s| s.messages.get_mut(st.msg_index))
                {
                    msg.streaming = false;
                }
            }
            self.pump();
        }
    }

    /// Start streaming the next queued message, if the pipeline is idle.
    pub fn pump(&mut self) {
        if self.streaming.is_some() {
            return;
        }
        let Some((session_idx, prompt)) = self.queue.pop_front() else {
            return;
        };
        if session_idx >= self.sessions.len() {
            return;
        }
        let reply = mock::reply(&prompt, &mut self.rng);
        let tokens = tokenize(&reply, &mut self.rng);
        let session = &mut self.sessions[session_idx];
        session.messages.push(Message {
            role: Role::Assistant,
            content: String::new(),
            streaming: true,
        });
        let msg_index = session.messages.len() - 1;
        session.scroll_up = 0;
        self.streaming = Some(StreamState {
            session: session_idx,
            msg_index,
            tokens,
            pos: 0,
            thinking_ms: self.rng.range_u16(450, 950),
            budget_ms: 0.0,
        });
    }

    // ----------------------------------------------------------------- send

    pub fn send(&mut self) {
        let text = self.input.trim().to_string();
        if text.is_empty() {
            return;
        }
        self.input.clear();
        self.cursor = 0;
        self.sent_history.push(text.clone());
        self.hist_pos = None;
        self.tokens_estimate += (text.len() + 3) / 4;

        let idx = self.current;
        {
            let session = &mut self.sessions[idx];
            session.messages.push(Message {
                role: Role::User,
                content: text.clone(),
                streaming: false,
            });
            let user_msgs = session
                .messages
                .iter()
                .filter(|m| m.role == Role::User)
                .count();
            if user_msgs == 1 {
                session.title = truncate_chars(&text, 26);
            }
            session.scroll_up = 0;
            session.last_active = Instant::now();
        }
        self.queue.push_back((idx, text));
        self.pump();
    }

    // -------------------------------------------------------------- sessions

    pub fn new_session(&mut self) {
        self.sessions.push(Session::new());
        self.current = self.sessions.len() - 1;
        self.focus = Focus::Input;
    }

    pub fn select_session(&mut self, idx: usize) {
        if idx < self.sessions.len() {
            self.current = idx;
        }
    }

    pub fn prev_session(&mut self) {
        self.current = self.current.saturating_sub(1);
    }

    pub fn next_session(&mut self) {
        if self.current + 1 < self.sessions.len() {
            self.current += 1;
        }
    }

    pub fn delete_session(&mut self) {
        let idx = self.current;
        self.queue.retain(|(s, _)| *s != idx);
        if self
            .streaming
            .as_ref()
            .is_some_and(|st| st.session == idx)
        {
            self.streaming = None;
        }
        self.sessions.remove(idx);
        if let Some(st) = &mut self.streaming {
            if st.session > idx {
                st.session -= 1;
            }
        }
        for (s, _) in self.queue.iter_mut() {
            if *s > idx {
                *s -= 1;
            }
        }
        if self.sessions.is_empty() {
            self.sessions.push(Session::new());
        }
        self.current = idx.min(self.sessions.len() - 1);
    }

    pub fn scroll_chat(&mut self, delta: i16) {
        let session = &mut self.sessions[self.current];
        let next = session.scroll_up as i32 - delta as i32;
        session.scroll_up = next.clamp(0, u16::MAX as i32) as u16;
    }

    // --------------------------------------------------------------- editing

    fn byte_idx(&self, char_idx: usize) -> Option<usize> {
        self.input.char_indices().nth(char_idx).map(|(i, _)| i)
    }

    pub fn insert_char(&mut self, c: char) {
        if self.input.chars().count() >= MAX_INPUT_CHARS {
            return;
        }
        let at = self.byte_idx(self.cursor).unwrap_or(self.input.len());
        self.input.insert(at, c);
        self.cursor += 1;
    }

    pub fn backspace(&mut self) {
        if self.cursor == 0 {
            return;
        }
        if let Some(start) = self.byte_idx(self.cursor - 1) {
            let end = self.byte_idx(self.cursor).unwrap_or(self.input.len());
            self.input.replace_range(start..end, "");
            self.cursor -= 1;
        }
    }

    pub fn delete(&mut self) {
        if let Some(start) = self.byte_idx(self.cursor) {
            let end = self.byte_idx(self.cursor + 1).unwrap_or(self.input.len());
            self.input.replace_range(start..end, "");
        }
    }

    pub fn cursor_left(&mut self) {
        self.cursor = self.cursor.saturating_sub(1);
    }

    pub fn cursor_right(&mut self) {
        if self.cursor < self.input.chars().count() {
            self.cursor += 1;
        }
    }

    pub fn cursor_home(&mut self) {
        self.cursor = 0;
    }

    pub fn cursor_end(&mut self) {
        self.cursor = self.input.chars().count();
    }

    pub fn word_left(&mut self) {
        let chars: Vec<char> = self.input.chars().collect();
        let mut i = self.cursor.min(chars.len());
        while i > 0 && chars[i - 1].is_whitespace() {
            i -= 1;
        }
        while i > 0 && !chars[i - 1].is_whitespace() {
            i -= 1;
        }
        self.cursor = i;
    }

    pub fn word_right(&mut self) {
        let chars: Vec<char> = self.input.chars().collect();
        let mut i = self.cursor;
        while i < chars.len() && chars[i].is_whitespace() {
            i += 1;
        }
        while i < chars.len() && !chars[i].is_whitespace() {
            i += 1;
        }
        self.cursor = i;
    }

    pub fn delete_word_back(&mut self) {
        let chars: Vec<char> = self.input.chars().collect();
        let mut i = self.cursor.min(chars.len());
        while i > 0 && chars[i - 1].is_whitespace() {
            i -= 1;
        }
        while i > 0 && !chars[i - 1].is_whitespace() {
            i -= 1;
        }
        let start = self.byte_idx(i).unwrap_or(0);
        let end = self.byte_idx(self.cursor).unwrap_or(self.input.len());
        self.input.replace_range(start..end, "");
        self.cursor = i;
    }

    pub fn clear_line(&mut self) {
        self.input.clear();
        self.cursor = 0;
    }

    pub fn history_prev(&mut self) {
        if self.sent_history.is_empty() {
            return;
        }
        let pos = match self.hist_pos {
            None => self.sent_history.len() - 1,
            Some(p) => p.saturating_sub(1),
        };
        self.hist_pos = Some(pos);
        self.input = self.sent_history[pos].clone();
        self.cursor_end();
    }

    pub fn history_next(&mut self) {
        let Some(pos) = self.hist_pos else {
            return;
        };
        if pos + 1 >= self.sent_history.len() {
            self.hist_pos = None;
            self.input.clear();
            self.cursor = 0;
        } else {
            self.hist_pos = Some(pos + 1);
            self.input = self.sent_history[pos + 1].clone();
            self.cursor_end();
        }
    }

    // -------------------------------------------------------------- keyboard

    pub fn on_key(&mut self, key: KeyEvent) {
        if key.kind == KeyEventKind::Release {
            return;
        }

        if self.show_help {
            if matches!(
                key.code,
                KeyCode::F(1) | KeyCode::Esc | KeyCode::Enter | KeyCode::Char('q')
            ) {
                self.show_help = false;
            }
            return;
        }

        let ctrl = key.modifiers.contains(KeyModifiers::CONTROL);
        if ctrl {
            match key.code {
                KeyCode::Char('c') => {
                    self.should_quit = true;
                    return;
                }
                KeyCode::Char('n') => {
                    self.new_session();
                    return;
                }
                _ => {}
            }
        }

        if key.code == KeyCode::F(1) {
            self.show_help = true;
            return;
        }

        match self.focus {
            Focus::Input => match key.code {
                KeyCode::Tab | KeyCode::BackTab => self.focus = Focus::Sidebar,
                KeyCode::Esc => self.should_quit = true,
                KeyCode::Enter => self.send(),
                KeyCode::Backspace => {
                    if ctrl {
                        self.delete_word_back();
                    } else {
                        self.backspace();
                    }
                }
                KeyCode::Delete => self.delete(),
                KeyCode::Left => {
                    if ctrl {
                        self.word_left();
                    } else {
                        self.cursor_left();
                    }
                }
                KeyCode::Right => {
                    if ctrl {
                        self.word_right();
                    } else {
                        self.cursor_right();
                    }
                }
                KeyCode::Home => self.cursor_home(),
                KeyCode::End => self.cursor_end(),
                KeyCode::PageUp => self.scroll_chat(5),
                KeyCode::PageDown => self.scroll_chat(-5),
                KeyCode::Up => self.history_prev(),
                KeyCode::Down => self.history_next(),
                KeyCode::Char('w') if ctrl => self.delete_word_back(),
                KeyCode::Char('u') if ctrl => self.clear_line(),
                KeyCode::Char(c)
                    if !ctrl && !key.modifiers.contains(KeyModifiers::ALT) =>
                {
                    self.insert_char(c);
                }
                _ => {}
            },
            Focus::Sidebar => match key.code {
                KeyCode::Char('k') | KeyCode::Up => self.prev_session(),
                KeyCode::Char('j') | KeyCode::Down => self.next_session(),
                KeyCode::Tab | KeyCode::BackTab | KeyCode::Enter | KeyCode::Left => {
                    self.focus = Focus::Input
                }
                KeyCode::Esc => self.should_quit = true,
                KeyCode::Char('d') | KeyCode::Delete => self.delete_session(),
                KeyCode::PageUp => self.scroll_chat(5),
                KeyCode::PageDown => self.scroll_chat(-5),
                KeyCode::Home => self.current = 0,
                KeyCode::End => self.current = self.sessions.len().saturating_sub(1),
                _ => {}
            },
        }
    }

    // ----------------------------------------------------------------- mouse

    pub fn on_mouse(&mut self, m: MouseEvent) {
        match m.kind {
            MouseEventKind::ScrollUp => self.scroll_chat(3),
            MouseEventKind::ScrollDown => self.scroll_chat(-3),
            MouseEventKind::Down(MouseButton::Left) => {
                if self.show_help {
                    self.show_help = false;
                    return;
                }
                let at = Position::new(m.column, m.row);
                if self.frame_areas.new_chat.contains(at) {
                    self.new_session();
                    return;
                }
                if self.frame_areas.input.contains(at) {
                    self.focus = Focus::Input;
                    return;
                }
                if self.frame_areas.sidebar.contains(at) {
                    for (y0, y1, idx) in &self.frame_areas.sidebar_items {
                        if m.row >= *y0 && m.row <= *y1 {
                            self.select_session(*idx);
                            return;
                        }
                    }
                }
            }
            _ => {}
        }
    }
}

/// Split a reply into streaming tokens, preserving newlines and code
/// indentation, with human-ish delays (longer after punctuation).
pub fn tokenize(reply: &str, rng: &mut Rng) -> Vec<Token> {
    let mut out = Vec::new();
    for (i, line) in reply.split('\n').enumerate() {
        if i > 0 {
            out.push(Token {
                text: "\n".to_string(),
                delay_ms: 130,
            });
        }
        let trimmed = line.trim_start();
        let indent = line.len() - trimmed.len();
        if trimmed.is_empty() {
            continue;
        }
        if indent > 0 {
            out.push(Token {
                text: " ".repeat(indent.min(8)),
                delay_ms: 26,
            });
        }
        for word in trimmed.split_whitespace() {
            let mut delay = rng.range_u16(14, 42);
            if word.ends_with(['.', '!', '?', ',', ';', ':']) {
                delay += rng.range_u16(80, 190);
            }
            out.push(Token {
                text: format!("{word} "),
                delay_ms: delay,
            });
        }
    }
    if out.is_empty() {
        out.push(Token {
            text: "…".to_string(),
            delay_ms: 40,
        });
    }
    out
}

/// Truncate a string to `n` characters, appending an ellipsis when cut.
pub fn truncate_chars(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        s.to_string()
    } else {
        let keep = n.saturating_sub(1);
        let mut out: String = s.chars().take(keep).collect();
        out.push('…');
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenize_preserves_words_and_indents() {
        let mut rng = Rng::from_entropy();
        let toks = tokenize("hi  there\n    let x = 1;", &mut rng);
        let joined: String = toks.iter().map(|t| t.text.as_str()).collect();
        // 4-space code indent survives; double spaces collapse
        assert_eq!(joined, "hi there \n    let x = 1; ");
    }

    #[test]
    fn tokenize_never_returns_empty() {
        let mut rng = Rng::from_entropy();
        assert!(!tokenize("", &mut rng).is_empty());
    }

    #[test]
    fn truncate_marks_cut_strings() {
        assert_eq!(truncate_chars("hello", 10), "hello");
        let cut = truncate_chars("hello world", 8);
        assert!(cut.ends_with('…') && cut.chars().count() == 8);
    }

    #[test]
    fn editing_keeps_cursor_consistent() {
        let mut app = App::new();
        for c in "rust 🐋!".chars() {
            app.insert_char(c);
        }
        assert_eq!(app.cursor, 7);
        app.word_left();
        assert_eq!(app.cursor, 5); // start of the emoji word
        app.delete_word_back();
        assert_eq!(app.input, "🐋!");
        assert_eq!(app.cursor, 0);
    }
}
