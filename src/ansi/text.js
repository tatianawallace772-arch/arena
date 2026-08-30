/**
 * Text helpers. Everything here operates on *plain* strings (no ANSI); styling is
 * applied separately as "runs" so the same content can be rendered to the terminal,
 * copied as ANSI, or exported as Markdown without re-parsing.
 */

/** East Asian Wide/Fullwidth + emoji presentation are 2 cells in xterm. */
const WIDE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;

/** Display width of a single code point. */
export function charWidth(ch) {
  return WIDE.test(ch) ? 2 : 1;
}

/** Display width of a string. */
export function strWidth(str) {
  let w = 0;
  for (const ch of str) w += charWidth(ch);
  return w;
}

/** Strip terminal escapes (used when exporting ANSI as plain text). */
export function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '');
}

/** Pad/truncate to an exact display width. */
export function fit(str, width, { ellipsis = '…', pad = ' ' } = {}) {
  const w = strWidth(str);
  if (w <= width) return str + pad.repeat(Math.max(0, width - w));
  let out = '';
  let used = 0;
  for (const ch of str) {
    const cw = charWidth(ch);
    if (used + cw > width - strWidth(ellipsis)) break;
    out += ch;
    used += cw;
  }
  return (out + ellipsis).padEnd(width, ' ');
}

export function padCenter(str, width, pad = ' ') {
  const w = strWidth(str);
  if (w >= width) return str.slice(0, width);
  const left = Math.floor((width - w) / 2);
  return pad.repeat(left) + str + pad.repeat(width - w - left);
}

/** Repeat a single char, guarded against negative counts. */
export function repeat(ch, n) {
  return n > 0 ? ch.repeat(n) : '';
}

/**
 * Word-wrap a string to `width`, honouring existing newlines, leading indentation and
 * long unbreakable tokens (urls, paths). Returns an array of lines (never wider than
 * `width`, except for single tokens wider than the width).
 */
export function wrap(text, width, { indent = '', firstIndent = null, minWidth = 8 } = {}) {
  const w = Math.max(minWidth, width);
  const fi = firstIndent === null ? indent : firstIndent;
  const out = [];
  for (const para of String(text).split('\n')) {
    if (!para.trim()) {
      out.push('');
      continue;
    }
    const lead = para.match(/^\s*/)[0];
    const prefix = lead + (para.trim() === para ? '' : '');
    const body = para.slice(lead.length);
    let line = (out.length === 0 ? fi : indent) + lead;
    let first = true;
    const push = () => {
      out.push(line.replace(/\s+$/, ''));
      first = false;
      line = indent;
    };
    for (const token of body.split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        if (line.trim() && !/[ \t]$/.test(line)) line += ' ';
        continue;
      }
      const candidate = line + token;
      if (strWidth(candidate) > w && strWidth(line.replace(indent, '')) > 0) {
        push();
        line = indent + token;
      } else if (strWidth(candidate) > w) {
        // Token alone is too wide: hard split it.
        let chunk = '';
        for (const ch of token) {
          if (strWidth(chunk + ch) > w - strWidth(indent)) {
            out.push(chunk);
            chunk = indent + ch;
          } else chunk += ch;
        }
        line = chunk;
      } else {
        line = candidate;
      }
      void first;
    }
    out.push(line.replace(/\s+$/, ''));
  }
  // trim a single trailing blank line (blocks add their own spacing)
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out;
}

/** Split a wrapped string, capped to `max` lines with a "+N lines" tail. */
export function wrapCapped(text, width, max, label = 'lines') {
  const lines = wrap(text, width);
  if (lines.length <= max) return { lines, hidden: 0 };
  const head = lines.slice(0, max);
  head.push(`… +${lines.length - max} ${label}`);
  return { lines: head, hidden: lines.length - max };
}

/** Format seconds as `4s` / `1m 12s`. */
export function fmtDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/** 1234 -> "1.2k" */
export function fmtTokens(n) {
  if (n < 1000) return String(n);
  if (n < 1000000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
  return `${(n / 1000000).toFixed(1)}M`;
}

/** Sub-cent amounts still matter after one small turn, so keep four decimals there. */
export function fmtMoney(n) {
  return `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;
}

/** Home-shorten a path: /home/user/x -> ~/x */
export function homePath(p, home = '/home/user') {
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}
