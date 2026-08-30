/**
 * Screen: a character grid + a diffing writer that emits the minimum ANSI needed to
 * transition from the previous frame. This is the same trick Ink uses, and it is what
 * makes spinners/streaming look native instead of like `clear`-and-print.
 *
 * Pure JS (no DOM) so it is unit-testable in node.
 */
import { strWidth } from './text.js';

const RESET = '\x1b[0m';

/** Registry that interns style objects into small integer ids -> cached SGR strings. */
export class StyleRegistry {
  constructor() {
    this.ids = new Map();
    this.sgr = [''];
    this.codes = [{ raw: '' }];
  }

  /** @param {{fg?:string,bg?:string,bold?:number,dim?:number,italic?:number,underline?:number,inverse?:number,strike?:number}} style */
  id(style = {}) {
    const key = `${style.fg ?? ''}|${style.bg ?? ''}|${style.bold ? 1 : 0}${style.dim ? 1 : 0}${
      style.italic ? 1 : 0
    }${style.underline ? 1 : 0}${style.inverse ? 1 : 0}${style.strike ? 1 : 0}`;
    let hit = this.ids.get(key);
    if (hit !== undefined) return hit;
    const parts = [];
    if (style.bold) parts.push('1');
    if (style.dim) parts.push('2');
    if (style.italic) parts.push('3');
    if (style.underline) parts.push('4');
    if (style.inverse) parts.push('7');
    if (style.strike) parts.push('9');
    if (style.fg) parts.push(colorParam(style.fg, 38));
    if (style.bg) parts.push(colorParam(style.bg, 48));
    const sgr = parts.length ? `\x1b[${parts.join(';')}m` : '';
    hit = this.sgr.length;
    this.sgr.push(sgr);
    this.codes.push({ ...style, raw: sgr });
    this.ids.set(key, hit);
    return hit;
  }

  sgrFor(id) {
    return this.sgr[id] ?? '';
  }

  styleFor(id) {
    return this.codes[id] ?? {};
  }
}

function colorParam(color, base) {
  if (typeof color === 'number') return `${base};5;${color}`;
  if (color.startsWith('#')) return `${base};2;${hexTriplet(color)}`;
  return color; // raw SGR params, e.g. "38;5;208"
}

function hexTriplet(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  const n = parseInt(full.slice(0, 6), 16) || 0;
  return `${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}`;
}

const BLANK = { ch: ' ', style: 0, cont: false };
const BLANK_KEY = ' \u00000';
const CLEAR = '\x1b[2J\x1b[H';

/** Escape that a caller should prepend when it has no diff baseline. */
export const CLEAR_SCREEN = CLEAR;

export class Screen {
  /**
   * @param {number} rows
   * @param {number} cols
   * @param {StyleRegistry} [registry]
   */
  constructor(rows, cols, registry = new StyleRegistry()) {
    this.rows = Math.max(1, rows | 0);
    this.cols = Math.max(1, cols | 0);
    this.styles = registry;
    this.cells = [];
    for (let r = 0; r < this.rows; r++) this.cells.push(new Array(this.cols));
    this.clear();
  }

  resize(rows, cols) {
    rows = Math.max(1, rows | 0);
    cols = Math.max(1, cols | 0);
    if (rows === this.rows && cols === this.cols) return false;
    const next = [];
    for (let r = 0; r < rows; r++) {
      const row = new Array(cols);
      const prev = this.cells[r];
      for (let c = 0; c < cols; c++) row[c] = prev && prev[c] ? { ...prev[c] } : { ...BLANK };
      next.push(row);
    }
    this.rows = rows;
    this.cols = cols;
    this.cells = next;
    return true;
  }

  clear() {
    for (let r = 0; r < this.rows; r++) {
      const row = this.cells[r];
      for (let c = 0; c < this.cols; c++) row[c] = { ...BLANK };
    }
  }

  /** Fill every cell with `ch` and a background (used for full-bleed panels). */
  fill(ch = ' ', style = {}) {
    const s = typeof style === 'number' ? style : this.styles.id(style);
    for (let r = 0; r < this.rows; r++) {
      const row = this.cells[r];
      for (let c = 0; c < this.cols; c++) row[c] = { ch, style: s, cont: false };
    }
  }

  /** Write one styled string. Returns the column after the last written cell. */
  text(x, y, str, style = {}) {
    if (y < 0 || y >= this.rows) return x;
    const s = typeof style === 'number' ? style : this.styles.id(style);
    const row = this.cells[y];
    let cx = x | 0;
    for (const ch of String(str)) {
      if (cx >= this.cols) break;
      if (cx >= 0) {
        const w = strWidth(ch);
        row[cx] = { ch, style: s, cont: false };
        if (w === 2 && cx + 1 < this.cols) {
          row[cx + 1] = { ch: '', style: s, cont: true };
          cx++;
        }
        cx++;
      } else cx = 0;
    }
    return cx;
  }

  /** Write styled runs `[{text, style}]` starting at x. Style may be an object or interned id. */
  runs(x, y, runs, style = {}) {
    const base = typeof style === 'number' ? style : this.styles.id(style);
    let cx = x;
    for (const run of runs) {
      if (cx >= this.cols) break;
      const s =
        run.style === undefined || run.style === null
          ? base
          : typeof run.style === 'number'
            ? run.style
            : this.styles.id(run.style);
      cx = this.text(cx, y, run.text, s);
    }
    return cx;
  }

  /** Fill a rectangle with a character (default: spaces) and a style. */
  box(x, y, w, h, style = {}, ch = ' ') {
    const s = typeof style === 'number' ? style : this.styles.id(style);
    for (let r = 0; r < h; r++) {
      const row = y + r;
      if (row < 0 || row >= this.rows) continue;
      const cells = this.cells[row];
      for (let c = 0; c < w; c++) {
        const cx = x + c;
        if (cx < 0 || cx >= this.cols) continue;
        cells[cx] = { ch, style: s, cont: false };
      }
    }
  }

  /**
   * Rounded border, Ink `<Box borderStyle="round">` style.
   * @param {{style?:object,title?:string,titleStyle?:object,right?:string}} [opts]
   */
  border(x, y, w, h, opts = {}) {
    const style = opts.style ?? {};
    const s = typeof style === 'number' ? style : this.styles.id(style);
    if (w < 2 || h < 2) return;
    this.text(x, y, '╭' + '─'.repeat(w - 2) + '╮', s);
    this.text(x, y + h - 1, '╰' + '─'.repeat(w - 2) + '╯', s);
    for (let r = 1; r < h - 1; r++) {
      this.text(x, y + r, '│', s);
      this.text(x + w - 1, y + r, '│', s);
    }
    if (opts.title) {
      const t = ' ' + opts.title + ' ';
      this.text(x + 2, y, t.slice(0, Math.max(0, w - 4)), opts.titleStyle ?? style);
    }
    if (opts.right) {
      const t = ' ' + opts.right + ' ';
      const clipped = t.length > w - 4 ? t.slice(t.length - (w - 4)) : t;
      this.text(x + w - 2 - clipped.length, y, clipped, opts.rightStyle ?? opts.titleStyle ?? style);
    }
  }

  /** Horizontal rule. */
  rule(y, x, w, ch = '─', style = {}) {
    this.text(x, y, ch.repeat(w), style);
  }

  /** Blank the tail of a row from `x`. */
  eraseRow(y, x = 0) {
    if (y < 0 || y >= this.rows) return;
    const row = this.cells[y];
    for (let c = x; c < this.cols; c++) row[c] = { ...BLANK };
  }

  eraseFrom(y) {
    for (let r = y; r < this.rows; r++) this.eraseRow(r, 0);
  }

  /** Render an array of lines (strings or run-arrays) at the given row. */
  lines(lines, { x = 0, y = 0, style = {}, clip = true } = {}) {
    let r = y;
    for (const line of lines) {
      if (r >= this.rows) break;
      if (typeof line === 'string') {
        const text = clip ? line.slice(0, this.cols - x) : line;
        if (text) this.text(x, r, text, style);
      } else {
        this.runs(x, r, line, style);
      }
      r++;
    }
    return r - y;
  }

  // --- output -------------------------------------------------------------

  /** Full repaint as ANSI (used after resize/reset). */
  toAnsi() {
    let out = '\x1b[H';
    for (let r = 0; r < this.rows; r++) {
      let cur = -1;
      out += '\x1b[1G';
      let line = '';
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (cell.cont) continue;
        if (cell.style !== cur) {
          line += RESET + this.styles.sgrFor(cell.style);
          cur = cell.style;
        }
        line += cell.ch;
      }
      out += line + (cur !== 0 ? RESET : '');
      if (r !== this.rows - 1) out += '\r\n';
    }
    return out;
  }

  /** Plain text, one entry per row (transcript export, clipboard). */
  toText() {
    const rows = [];
    for (let r = 0; r < this.rows; r++) {
      let line = '';
      for (let c = 0; c < this.cols; c++) line += this.cells[r][c].ch;
      rows.push(line.replace(/\s+$/, ''));
    }
    while (rows.length && rows[rows.length - 1] === '') rows.pop();
    return rows.join('\n');
  }

  /**
   * Minimal diff against a previous frame buffer. Returns the ANSI needed to
   * turn `prev` into `this`, plus the new snapshot to keep.
   * @param {string[]|null} prev previous snapshot rows (see snapshot())
   */
  diff(prev) {
    const now = this.cells.map((row) => row.map((cell) => cell.ch + '\u0000' + cell.style));
    const chunks = [];
    let lastStyle = -1;
    for (let r = 0; r < this.rows; r++) {
      const nowRow = now[r];
      const prevRow = prev && prev[r];
      let c = 0;
      while (c < this.cols) {
        // With no baseline the caller is expected to have cleared the screen, so blank
        // cells count as unchanged and the first paint stays small.
        if ((prevRow ? prevRow[c] : BLANK_KEY) === nowRow[c]) {
          c++;
          continue;
        }
        let end = c;
        while (end < this.cols && (!prevRow || prevRow[end] !== nowRow[end])) end++;
        const cellStyle = this.cells[r][c].style;
        if (cellStyle !== lastStyle) {
          chunks.push(RESET + this.styles.sgrFor(cellStyle));
          lastStyle = cellStyle;
        }
        let text = '';
        for (let k = c; k < end; k++) {
          if (this.cells[r][k].cont) continue;
          text += this.cells[r][k].ch;
        }
        chunks.push(`\x1b[${r + 1};${c + 1}H${text}`);
        c = end;
      }
    }
    if (chunks.length) chunks.push(RESET);
    return { ansi: chunks.join(''), snapshot: now, changed: chunks.length > 0 };
  }
}
