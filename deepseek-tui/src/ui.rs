//! Rendering: DeepSeek-chat-style layout inside a terminal frame.
//!
//! Layout:
//! ┌ header ───────────────────────────────────────────────────┐
//! │ sidebar (chats)  │  message bubbles (assistant left,      │
//! │                  │  user right-aligned) + input box       │
//! └ status bar ───────────────────────────────────────────────┘

use ratatui::layout::{Alignment, Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, BorderType, Borders, Clear, List, ListItem, Paragraph, Wrap};
use ratatui::Frame;

use crate::app::{truncate_chars, App, Focus, Message, Role};

// ---------------------------------------------------------------- theme ---

const BG: Color = Color::Rgb(16, 18, 24);
const SIDEBAR_BG: Color = Color::Rgb(13, 15, 19);
const STATUS_BG: Color = Color::Rgb(24, 27, 35);
const HEADER_BG: Color = Color::Rgb(77, 107, 254); // DeepSeek blue #4D6BFE

const BLUE: Color = Color::Rgb(77, 107, 254);
const BLUE_BRIGHT: Color = Color::Rgb(122, 146, 255);
const SEL_BG: Color = Color::Rgb(41, 54, 120);

const BUBBLE_BG: Color = Color::Rgb(22, 25, 33);
const BUBBLE_BORDER: Color = Color::Rgb(61, 86, 201);

const USER_BG: Color = Color::Rgb(30, 41, 89);
const USER_BORDER: Color = Color::Rgb(70, 90, 180);
const USER_FG: Color = Color::Rgb(190, 205, 255);

const FG: Color = Color::Rgb(220, 223, 233);
const DIM: Color = Color::Rgb(130, 136, 153);
const INPUT_BORDER: Color = Color::Rgb(58, 62, 76);

const SPINNER: [&str; 10] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const WHALE: &str = r#"         .
          ":"
        ___:____     |"\/"|
      ,'        `.    \  /
      |  O        \___/  |
 ~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~"#;

// ----------------------------------------------------------------- draw ---

pub fn draw(frame: &mut Frame, app: &mut App) {
    let area = frame.area();
    frame.render_widget(Block::new().style(Style::new().bg(BG)), area);

    if area.width < 24 || area.height < 8 {
        frame.render_widget(
            Paragraph::new("terminal too small — resize to at least 24×8")
                .style(Style::new().fg(DIM))
                .alignment(Alignment::Center),
            area,
        );
        return;
    }

    let rows = Layout::vertical([
        Constraint::Length(1),
        Constraint::Min(0),
        Constraint::Length(1),
    ])
    .split(area);
    let (header, body, status) = (rows[0], rows[1], rows[2]);

    let side_w = if area.width >= 100 {
        28
    } else if area.width >= 46 {
        24
    } else {
        0
    };
    let cols =
        Layout::horizontal([Constraint::Length(side_w), Constraint::Min(10)]).split(body);
    let (sidebar_area, chat_area) = (cols[0], cols[1]);

    draw_header(frame, header, area.width);
    draw_status(frame, status, area.width, app);

    if side_w > 0 {
        draw_sidebar(frame, sidebar_area, side_w, app);
    } else {
        app.frame_areas.sidebar = Rect::default();
        app.frame_areas.new_chat = Rect::default();
        app.frame_areas.sidebar_items.clear();
    }

    let chat_rows =
        Layout::vertical([Constraint::Min(1), Constraint::Length(3)]).split(chat_area);
    let (msgs_raw, input_area) = (chat_rows[0], chat_rows[1]);

    let inner = Rect {
        x: msgs_raw.x + 2,
        y: msgs_raw.y + 1,
        width: msgs_raw.width.saturating_sub(4),
        height: msgs_raw.height.saturating_sub(1),
    };

    if app.sessions[app.current].messages.is_empty() {
        draw_empty_state(frame, inner);
    } else if inner.width >= 12 {
        draw_bubbles(frame, inner, app);
    }

    draw_input(frame, input_area, app);

    if app.show_help {
        draw_help(frame, area);
    }
}

fn draw_header(frame: &mut Frame, header: Rect, width: u16) {
    let left = vec![
        Span::styled(
            "🐋 DeepSeek",
            Style::new()
                .fg(Color::White)
                .bg(HEADER_BG)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            "  ·  terminal simulator",
            Style::new().fg(Color::Rgb(205, 214, 255)).bg(HEADER_BG),
        ),
    ];
    let right = vec![Span::styled(
        "deepseek-chat · simulated ",
        Style::new().fg(Color::Rgb(225, 230, 255)).bg(HEADER_BG),
    )];
    let line = two_ends(left, right, width);
    frame.render_widget(
        Paragraph::new(line).style(Style::new().bg(HEADER_BG)),
        header,
    );
}

fn draw_status(frame: &mut Frame, status: Rect, width: u16, app: &App) {
    let left = vec![Span::styled(
        " Tab panels · ↑↓ recall/chats · PgUp/PgDn scroll · Enter send · Ctrl+N new · F1 help · Esc quit ",
        Style::new().fg(DIM),
    )];
    let mut right = vec![Span::styled(
        format!("◆ deepseek-chat · ≈{} tok", app.tokens_estimate),
        Style::new().fg(BLUE_BRIGHT),
    )];
    if app.streaming.is_some() {
        right.push(Span::styled(
            format!(" · {} streaming", SPINNER[app.spinner]),
            Style::new().fg(Color::White),
        ));
    } else {
        right.push(Span::styled(" · idle", Style::new().fg(DIM)));
    }
    let line = two_ends(left, right, width);
    frame.render_widget(
        Paragraph::new(line).style(Style::new().bg(STATUS_BG)),
        status,
    );
}

fn draw_sidebar(frame: &mut Frame, side: Rect, side_w: u16, app: &mut App) {
    let btn = Rect {
        x: side.x,
        y: side.y,
        width: side_w,
        height: 1,
    };
    let btn_para = Paragraph::new(Line::from(Span::styled(
        "+ New chat",
        Style::new()
            .fg(Color::White)
            .add_modifier(Modifier::BOLD),
    )))
    .alignment(Alignment::Center)
    .style(Style::new().bg(BLUE));
    frame.render_widget(btn_para, btn);
    app.frame_areas.new_chat = btn;

    let list_area = Rect {
        x: side.x,
        y: side.y + 2,
        width: side_w,
        height: side.height.saturating_sub(2),
    };
    app.frame_areas.sidebar = list_area;

    let title_w = side_w.saturating_sub(8) as usize;
    let items: Vec<ListItem> = app
        .sessions
        .iter()
        .enumerate()
        .map(|(i, s)| {
            let selected = i == app.current;
            let icon = if selected { "●" } else { "○" };
            let icon_style = Style::new().fg(if selected {
                BLUE_BRIGHT
            } else {
                DIM
            });
            let title_style = if selected {
                Style::new().fg(Color::White)
            } else {
                Style::new().fg(FG)
            };
            let title = truncate_chars(&s.title, title_w.max(6));
            let meta = format!(
                "   {} msgs · {}",
                s.messages.len(),
                fmt_elapsed(s.last_active.elapsed())
            );
            ListItem::new(Text::from(vec![
                Line::from(vec![
                    Span::styled(format!(" {icon} "), icon_style),
                    Span::styled(title, title_style),
                ]),
                Line::from(Span::styled(meta, Style::new().fg(DIM))),
            ]))
        })
        .collect();

    // hit rows for mouse clicks (items are 2 rows tall)
    app.frame_areas.sidebar_items = (0..app.sessions.len())
        .map(|i| {
            let y0 = list_area.y + (i as u16) * 2;
            (
                y0,
                y0.saturating_add(1).min(list_area.bottom().saturating_sub(1)),
                i,
            )
        })
        .collect();

    app.list_state.select(Some(app.current));
    let list = List::new(items)
        .style(Style::new().bg(SIDEBAR_BG))
        .highlight_style(Style::new().bg(SEL_BG).fg(Color::White))
        .highlight_symbol("▌ ");
    frame.render_stateful_widget(list, list_area, &mut app.list_state);
}

fn draw_empty_state(frame: &mut Frame, inner: Rect) {
    let mut lines: Vec<Line> = WHALE
        .lines()
        .map(|l| Line::from(Span::styled(l.to_string(), Style::new().fg(Color::Rgb(52, 66, 120)))))
        .collect();
    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        "How can I help you today?",
        Style::new()
            .fg(BLUE_BRIGHT)
            .add_modifier(Modifier::BOLD),
    )));
    lines.push(Line::from(Span::styled(
        "fully simulated · ask about rust, code, jokes, deepseek — or type help",
        Style::new().fg(DIM),
    )));

    let offset = (inner.height as usize).saturating_sub(lines.len()) / 2;
    let rect = Rect {
        x: inner.x,
        y: inner.y + offset as u16,
        width: inner.width,
        height: inner.height - (offset as u16).min(inner.height),
    };
    frame.render_widget(
        Paragraph::new(Text::from(lines)).alignment(Alignment::Center),
        rect,
    );
}

fn draw_bubbles(frame: &mut Frame, inner: Rect, app: &mut App) {
    let streaming_at: Option<(usize, usize)> = app
        .streaming
        .as_ref()
        .map(|st| (st.session, st.msg_index));

    // measure bubbles
    let mut row: u32 = 0;
    let mut bubbles: Vec<(u16, u32, u16, u16, usize)> = Vec::new();
    for (i, m) in app.sessions[app.current].messages.iter().enumerate() {
        let (w, h) = bubble_size(m, inner.width);
        let x = if m.role == Role::User {
            inner.x + inner.width.saturating_sub(w)
        } else {
            inner.x
        };
        bubbles.push((x, row, w, h, i));
        row += h as u32 + 1;
    }
    let content_rows = row;
    let max_scroll = content_rows.saturating_sub(inner.height as u32) as u16;
    let scroll_up = app.sessions[app.current].scroll_up.min(max_scroll);
    app.sessions[app.current].scroll_up = scroll_up;
    let window_top = (content_rows as i64 - inner.height as i64 - scroll_up as i64).max(0) as i64;

    let bottom = inner.y as i64 + inner.height as i64;
    for &(x, y0, w, h, i) in &bubbles {
        let screen_y = inner.y as i64 + y0 as i64 - window_top;
        if screen_y >= bottom {
            continue;
        }
        let hidden = (inner.y as i64 - screen_y).max(0) as u16;
        let top = screen_y.max(inner.y as i64) as u16;
        let h_vis = h
            .saturating_sub(hidden.min(h))
            .min((inner.y + inner.height).saturating_sub(top));
        if h_vis == 0 {
            continue;
        }
        let rect = Rect {
            x,
            y: top,
            width: w,
            height: h_vis,
        };
        let streaming_here = streaming_at == Some((app.current, i));
        render_bubble(
            frame,
            rect,
            hidden,
            &app.sessions[app.current].messages[i],
            streaming_here,
            SPINNER[app.spinner % SPINNER.len()],
        );
    }
}

fn render_bubble(
    frame: &mut Frame,
    rect: Rect,
    hidden: u16,
    msg: &Message,
    streaming_here: bool,
    spinner: &str,
) {
    // when the top of the bubble has scrolled out of view, drop the top
    // border and scroll the text so the clip looks seamless
    let borders = if hidden > 0 {
        Borders::LEFT | Borders::RIGHT | Borders::BOTTOM
    } else {
        Borders::ALL
    };
    let scroll = if hidden > 0 {
        Some((hidden.saturating_sub(1), 0))
    } else {
        None
    };

    match msg.role {
        Role::Assistant => {
            let title = if streaming_here {
                if msg.content.is_empty() {
                    Line::from(vec![
                        Span::styled(
                            format!(" {spinner} "),
                            Style::new().fg(BLUE_BRIGHT).add_modifier(Modifier::BOLD),
                        ),
                        Span::styled(
                            "DeepSeek ",
                            Style::new()
                                .fg(Color::White)
                                .add_modifier(Modifier::BOLD),
                        ),
                        Span::styled(
                            "is thinking…",
                            Style::new().fg(DIM).add_modifier(Modifier::ITALIC),
                        ),
                    ])
                } else {
                    Line::from(vec![
                        Span::styled(
                            format!(" {spinner} "),
                            Style::new().fg(BLUE_BRIGHT).add_modifier(Modifier::BOLD),
                        ),
                        Span::styled(
                            "DeepSeek",
                            Style::new()
                                .fg(Color::White)
                                .add_modifier(Modifier::BOLD),
                        ),
                    ])
                }
            } else {
                Line::from(Span::styled(
                    " 🐋 DeepSeek",
                    Style::new()
                        .fg(BLUE_BRIGHT)
                        .add_modifier(Modifier::BOLD),
                ))
            };
            let block = Block::bordered()
                .border_type(BorderType::Rounded)
                .borders(borders)
                .border_style(Style::new().fg(if streaming_here {
                    BLUE
                } else {
                    BUBBLE_BORDER
                }))
                .title(title)
                .style(Style::new().bg(BUBBLE_BG));
            let body = if msg.content.is_empty() {
                Paragraph::new(Line::from(Span::styled("…", Style::new().fg(DIM))))
            } else {
                Paragraph::new(msg.content.as_str())
                    .style(Style::new().fg(FG))
                    .wrap(Wrap { trim: false })
            };
            let body = match scroll {
                Some(s) => body.scroll(s),
                None => body,
            };
            frame.render_widget(body.block(block), rect);
        }
        Role::User => {
            let title = Line::from(Span::styled(
                " You",
                Style::new().fg(USER_FG).add_modifier(Modifier::BOLD),
            ));
            let block = Block::bordered()
                .border_type(BorderType::Rounded)
                .borders(borders)
                .border_style(Style::new().fg(USER_BORDER))
                .title(title)
                .style(Style::new().bg(USER_BG));
            let body = Paragraph::new(msg.content.as_str())
                .style(Style::new().fg(USER_FG))
                .wrap(Wrap { trim: false });
            let body = match scroll {
                Some(s) => body.scroll(s),
                None => body,
            };
            frame.render_widget(body.block(block), rect);
        }
    }
}

fn draw_input(frame: &mut Frame, input_area: Rect, app: &mut App) {
    let focused = app.focus == Focus::Input;
    let border = if focused { BLUE } else { INPUT_BORDER };

    let mut parts: Vec<String> = Vec::new();
    let queued = app.queue.len();
    if queued > 0 {
        parts.push(format!("{queued} queued"));
    }
    parts.push(format!("{} chars", app.input.chars().count()));
    let right_label = format!(" {} ", parts.join(" · "));

    let block = Block::bordered()
        .border_type(BorderType::Rounded)
        .border_style(Style::new().fg(border))
        .title(Line::from(Span::styled(
            " Message DeepSeek ",
            Style::new()
                .fg(if focused { BLUE_BRIGHT } else { DIM })
                .add_modifier(if focused {
                    Modifier::BOLD
                } else {
                    Modifier::empty()
                }),
        )))
        .title(
            Line::from(Span::styled(right_label, Style::new().fg(DIM)))
                .alignment(Alignment::Right),
        );

    let inner = Rect {
        x: input_area.x + 1,
        y: input_area.y + 1,
        width: input_area.width.saturating_sub(2),
        height: 1,
    };

    let cursor_col: u16 = app
        .input
        .chars()
        .take(app.cursor)
        .map(disp_char_w)
        .sum();
    let hscroll = (cursor_col + 1).saturating_sub(inner.width.max(1));

    let para = if app.input.is_empty() {
        Paragraph::new(Line::from(Span::styled(
            "Message DeepSeek… (Enter to send)",
            Style::new().fg(DIM).add_modifier(Modifier::ITALIC),
        )))
    } else {
        Paragraph::new(app.input.as_str())
            .style(Style::new().fg(FG))
            .scroll((0, hscroll))
    };

    frame.render_widget(para.block(block), input_area);

    if focused && !app.show_help {
        let cx = inner.x + cursor_col - hscroll;
        frame.set_cursor_position((cx, inner.y));
    }
}

fn draw_help(frame: &mut Frame, area: Rect) {
    let lines = help_lines();
    let w = 62u16.min(area.width.saturating_sub(2)).max(20);
    let h = (lines.len() as u16 + 2)
        .min(area.height.saturating_sub(2))
        .max(6);
    let rect = Rect {
        x: area.x + area.width.saturating_sub(w) / 2,
        y: area.y + area.height.saturating_sub(h) / 2,
        width: w,
        height: h,
    };

    frame.render_widget(Clear, rect);
    let block = Block::bordered()
        .border_type(BorderType::Rounded)
        .border_style(Style::new().fg(BLUE))
        .style(Style::new().bg(Color::Rgb(24, 27, 35)))
        .title(Line::from(Span::styled(
            " Help ",
            Style::new()
                .fg(BLUE_BRIGHT)
                .add_modifier(Modifier::BOLD),
        )));
    let para = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: false });
    frame.render_widget(para, rect);
}

fn help_lines() -> Vec<Line<'static>> {
    let mut v: Vec<Line> = Vec::new();
    let section = |v: &mut Vec<Line>, name: &str| {
        v.push(Line::from(""));
        v.push(Line::from(Span::styled(
            name.to_string(),
            Style::new().fg(BLUE_BRIGHT).add_modifier(Modifier::BOLD),
        )));
    };
    let row = |v: &mut Vec<Line>, key: &str, desc: &str| {
        v.push(Line::from(vec![
            Span::styled(format!("  {key:<16}"), Style::new().fg(BLUE_BRIGHT)),
            Span::styled(desc.to_string(), Style::new().fg(FG)),
        ]));
    };

    v.push(Line::from(Span::styled(
        "  deepseek-tui · keybindings".to_string(),
        Style::new().fg(FG),
    )));
    section(&mut v, "Chat");
    row(&mut v, "Enter", "send message");
    row(&mut v, "Ctrl+N", "start a new chat");
    row(&mut v, "Tab", "switch focus: input / chats");
    row(&mut v, "d (chats)", "delete the selected chat");
    section(&mut v, "Navigation");
    row(&mut v, "↑ / ↓", "recall sent · select chat");
    row(&mut v, "PgUp / PgDn", "scroll conversation");
    row(&mut v, "Mouse wheel", "scroll conversation");
    section(&mut v, "Editing");
    row(&mut v, "Ctrl+W", "delete word");
    row(&mut v, "Ctrl+U", "clear input line");
    row(&mut v, "Home / End", "jump to start / end");
    section(&mut v, "App");
    row(&mut v, "F1", "toggle this help");
    row(&mut v, "Esc", "quit");
    row(&mut v, "Ctrl+C", "quit");
    v.push(Line::from(""));
    v.push(Line::from(Span::styled(
        "  F1 / Esc — close this panel".to_string(),
        Style::new().fg(DIM),
    )));
    v
}

// -------------------------------------------------------------- helpers ---

fn bubble_size(msg: &Message, avail: u16) -> (u16, u16) {
    let inner_w = avail.saturating_sub(2);
    let w = match msg.role {
        Role::Assistant => avail,
        Role::User => {
            let natural = msg
                .content
                .lines()
                .map(disp_len)
                .max()
                .unwrap_or(8)
                .saturating_add(4);
            let cap = inner_w.min((avail / 5 * 3).max(16));
            natural.min(cap).max(12.min(cap))
        }
    };
    let h = wrap_count(&msg.content, w.saturating_sub(2)) + 2;
    (w, h)
}

/// Estimate wrapped line count for `text` at `width` columns.
pub fn wrap_count(text: &str, width: u16) -> u16 {
    let width = width.max(4) as usize;
    let mut total: u32 = 0;
    for para in text.split('\n') {
        if para.is_empty() {
            total += 1;
            continue;
        }
        // `lines` = rows used; `col` > 0 means the last row is counted and
        // has `col` columns filled.
        let mut lines: u32 = 0;
        let mut col: usize = 0;
        for word in para.split(' ') {
            if word.is_empty() {
                continue;
            }
            let wl = word.chars().count();
            if wl > width {
                // the partial row (if any) is already counted
                col = 0;
                let (full, rem) = (wl / width, wl % width);
                if rem > 0 {
                    lines += full as u32 + 1;
                    col = rem;
                } else {
                    lines += full as u32;
                    col = width; // row is exactly full → next word must wrap
                }
            } else if col == 0 {
                lines += 1;
                col = wl;
            } else if col + 1 + wl <= width {
                col += 1 + wl;
            } else {
                lines += 1;
                col = wl;
            }
        }
        total += lines;
    }
    total.max(1) as u16
}

/// One line with `left` spans at the start and `right` spans pushed to the
/// far edge of `width` columns (padding in between).
fn two_ends(left: Vec<Span<'static>>, right: Vec<Span<'static>>, width: u16) -> Line<'static> {
    let l: u16 = left.iter().map(|s| disp_len(&s.content)).sum();
    let r: u16 = right.iter().map(|s| disp_len(&s.content)).sum();
    let fill = (width as usize).saturating_sub((l + r) as usize);
    let mut spans = left;
    spans.push(Span::raw(" ".repeat(fill)));
    spans.extend(right);
    Line::from(spans)
}

/// Naive display width: emoji (U+1F000+) count as 2 columns, everything
/// else as 1. Good enough for this UI's own strings.
fn disp_char_w(c: char) -> u16 {
    if (c as u32) >= 0x1_F000 {
        2
    } else {
        1
    }
}

fn disp_len(s: &str) -> u16 {
    s.chars().map(disp_char_w).sum()
}

fn fmt_elapsed(d: std::time::Duration) -> String {
    let s = d.as_secs();
    if s < 60 {
        "now".to_string()
    } else if s < 3600 {
        format!("{}m", s / 60)
    } else if s < 86_400 {
        format!("{}h", s / 3600)
    } else {
        format!("{}d", s / 86_400)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wrap_count_basics() {
        assert_eq!(wrap_count("hello", 10), 1);
        assert_eq!(wrap_count("hello world", 5), 2);
        assert_eq!(wrap_count("a\n\nb", 10), 3);
        assert_eq!(wrap_count("", 10), 1);
        assert_eq!(wrap_count("supercalifragilistic", 5), 4 + 1); // 21/5 → 5 lines
    }
}
