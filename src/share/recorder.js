/**
 * Session recorder: captures every ANSI payload the App writes, with timestamps, so a
 * session can be exported as an asciinema v2 .cast (viewable at asciinema.org/player,
 * or replayable in this page) and re-typed at variable speed.
 */
export class Recorder {
  constructor({ cols = 80, rows = 24, title = 'Claude Code (simulator)' } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.title = title;
    this.events = [];
    this.startedAt = performance.now();
    this.recording = true;
    this.paused = false;
    this.extraDelay = 0;
  }

  push(data) {
    if (!this.recording || this.paused || !data) return;
    const t = (performance.now() - this.startedAt) / 1000 + this.extraDelay;
    const last = this.events[this.events.length - 1];
    if (last && t - last[0] < 0.02) {
      last[2] += data;
      return;
    }
    this.events.push([Number(t.toFixed(3)), 'o', data]);
  }

  mark(label) {
    this.events.push([Number(((performance.now() - this.startedAt) / 1000).toFixed(3)), 'marker', label]);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  /** asciinema v2 cast: header line + one JSON array per event. */
  cast() {
    const header = {
      version: 2,
      width: this.cols,
      height: this.rows,
      timestamp: Math.floor(Date.now() / 1000),
      idle_time_limit: 2.5,
      title: this.title,
      env: { SHELL: '/bin/zsh', TERM: 'xterm-256color', CLAUDE_CODE: 'simulator' },
    };
    return [JSON.stringify(header), ...this.events.map((e) => JSON.stringify(e))].join('\n');
  }

  frames({ speed = 1, cap = 0.25 } = {}) {
    return this.events
      .filter((e) => e[1] === 'o')
      .map(([t, , data]) => ({ t: Math.min(cap, t) / speed, data }));
  }

  size() {
    return this.events.reduce((n, e) => n + (e[2]?.length ?? 0), 0);
  }
}

/** Parse a .cast back into frames (used by the in-page player). */
export function parseCast(text) {
  const lines = text.trim().split('\n');
  const header = JSON.parse(lines[0]);
  const events = lines.slice(1).map((l) => JSON.parse(l));
  return { header, events, text: events.filter((e) => e[1] === 'o').map((e) => e[2]).join('') };
}
