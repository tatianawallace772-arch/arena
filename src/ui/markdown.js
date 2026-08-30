/**
 * Markdown → styled run lines, for the terminal. Deliberately small: it handles the
 * subset Claude Code transcripts actually use (prose, fences, lists, tables, inline
 * marks) rather than being a CommonMark implementation.
 *
 * Output line = { runs: [{text, style}], fill?: 'code' } so callers can pad code blocks
 * to the full width for a background panel, and so the same output can be flattened to
 * plain text for clipboard / Markdown export.
 */
import { highlight } from './highlight.js';
import { strWidth } from '../ansi/text.js';

const FENCE = /^\s*(?:```|~~~)\s*([\w+#.-]*)\s*$/;

const widthOf = (runs) => runs.reduce((n, r) => n + strWidth(r.text), 0);

/** Inline marks: `code`, **bold**, *italic*, [text](url), @file refs. */
export function inline(text, theme) {
  const runs = [];
  const push = (t, style) => {
    if (!t) return;
    const last = runs[runs.length - 1];
    if (last && last.style === style) last.text += t;
    else runs.push({ text: t, style });
  };
  const codeStyle = theme ? theme.style('code') : { bg: 'code' };
  const strong = (extra) => (theme ? theme.style(undefined, extra) : extra);
  const boldStyle = strong({ bold: true });
  const emStyle = strong({ italic: true });
  const linkStyle = theme ? theme.style('link', { underline: true }) : { underline: true };
  const refStyle = theme ? theme.style('accent') : {};
  const re =
    /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\n]+)\*|__([^_]+)__|_([^_\n]+)_|\[([^\]]+)\]\(([^)\s]+)\)|(@[\w./-]+\.[\w]+)/g;
  const src = String(text);
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) push(src.slice(last, m.index), undefined);
    if (m[1] !== undefined) push(m[1], codeStyle);
    else if (m[2] !== undefined) push(m[2], boldStyle);
    else if (m[3] !== undefined) push(m[3], emStyle);
    else if (m[4] !== undefined) push(m[4], boldStyle);
    else if (m[5] !== undefined) push(m[5], emStyle);
    else if (m[6] !== undefined) push(m[6], linkStyle);
    else if (m[8] !== undefined) push(m[8], refStyle);
    last = re.lastIndex;
  }
  if (last < src.length) push(src.slice(last), undefined);
  return runs.length ? runs : [];
}

function ruleRow(left, mid, right, widths) {
  return left + widths.map((n) => '─'.repeat(n + 2)).join(mid) + right;
}

/**
 * @param {string} md
 * @param {{width:number, theme:object}} opts
 * @returns {{runs:object[], fill:string|null}[]}
 */
export function mdToLines(md, { width, theme }) {
  const raw = [];
  const src = String(md ?? '').replace(/\r\n/g, '\n').split('\n');
  const faint = theme.style('faint');
  const accent = theme.style('accent');
  const dim = theme.style('dim');

  let i = 0;
  while (i < src.length) {
    const line = src[i];

    const fence = line.match(FENCE);
    if (fence) {
      const lang = fence[1] || 'text';
      const body = [];
      i++;
      while (i < src.length && !FENCE.test(src[i])) body.push(src[i++]);
      i++;
      const runs = [];
      for (const [idx, codeLine] of body.entries()) {
        if (idx) runs.push({ text: '\n', style: undefined });
        for (const part of highlight(codeLine, lang)) {
          runs.push({ text: part.text, style: part.type === 'text' ? undefined : theme.style(part.type) });
        }
      }
      if (body.length) raw.push({ runs, fill: 'code', lead: 2, code: true });
      continue;
    }

    // pipe table with |---| separator
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < src.length && /^\s*\|[\s:|-]+\|\s*$/.test(src[i + 1])) {
      const rows = [];
      while (i < src.length && /^\s*\|.*\|\s*$/.test(src[i])) {
        const cellText = src[i].trim().replace(/^\|/, '').replace(/\|$/, '');
        if (!/^[\s:|-]+$/.test(cellText)) rows.push(cellText.split('|').map((c) => c.trim()));
        i++;
      }
      const cols = Math.max(...rows.map((r) => r.length));
      const parsed = rows.map((r) => Array.from({ length: cols }, (_, c) => inline(r[c] ?? '', theme)));
      const widths = Array.from({ length: cols }, (_, c) => Math.max(1, ...parsed.map((r) => widthOf(r[c] || []))));
      raw.push({ runs: [{ text: ruleRow('╭', '┬', '╮', widths), style: faint }], lead: 0, nowrap: true });
      parsed.forEach((row, ridx) => {
        const runs = [];
        row.forEach((cell, c) => {
          const styled = ridx === 0 ? cell.map((rr) => ({ ...rr, style: { ...(rr.style || {}), bold: true } })) : cell;
          runs.push({ text: ' ', style: undefined }, ...styled, { text: ' '.repeat(Math.max(0, widths[c] - widthOf(styled))) + ' │', style: faint });
          if (c !== cols - 1) runs.push({ text: '', style: faint });
        });
        raw.push({ runs: [{ text: '│', style: faint }, ...runs], lead: 0, nowrap: true, code: false, table: true });
        if (ridx === 0) raw.push({ runs: [{ text: ruleRow('├', '┼', '┤', widths), style: faint }], lead: 0, nowrap: true });
      });
      raw.push({ runs: [{ text: ruleRow('╰', '┴', '╯', widths), style: faint }], lead: 0, nowrap: true });
      raw.push({ runs: [], lead: 0 });
      continue;
    }

    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      raw.push({ runs: [{ text: '─'.repeat(Math.max(4, width)), style: faint }], lead: 0, nowrap: true });
      i++;
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const styled = inline(h[2], theme).map((r) => ({ ...r, style: { ...(r.style || {}), bold: true } }));
      if (level <= 2) raw.push({ runs: [], lead: 0 });
      raw.push({
        runs: [...(level === 1 ? [{ text: '▌', style: accent }] : []), ...styled],
        lead: 0,
        rule: level === 1 ? widthOf(styled) : 0,
      });
      if (level === 1) raw.push({ runs: [{ text: '─'.repeat(Math.max(4, Math.min(width, widthOf(styled) + 1))), style: faint }], lead: 0 });
      i++;
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      raw.push({
        runs: [
          { text: '│ ', style: accent },
          ...inline(quote[1], theme).map((r) => ({ ...r, style: { ...(r.style || {}), italic: true, fg: theme.colors.dim } })),
        ],
        lead: 2,
      });
      i++;
      continue;
    }

    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const numeric = /\d/.test(li[2]);
      const marker = numeric ? `${li[2].replace(/[.)]/, '')}. ` : '• ';
      raw.push({
        runs: [
          { text: li[1], style: undefined },
          { text: marker, style: numeric ? dim : accent },
          ...inline(li[3], theme),
        ],
        lead: li[1].length + marker.length,
      });
      i++;
      continue;
    }

    if (!line.trim()) {
      raw.push({ runs: [], lead: 0 });
      i++;
      continue;
    }

    raw.push({ runs: inline(line.trim(), theme), lead: 0 });
    i++;
  }

  return raw.flatMap((line) => wrapRuns(line, Math.max(12, width)));
}

/**
 * Wrap a styled line to `width`.
 * - `nowrap` lines (tables, rules) are emitted untouched
 * - `code` lines wrap on cell boundaries so indentation and alignment survive
 * - prose wraps on whitespace and re-indents continuations by the source lead
 */
export function wrapRuns(line, width) {
  const { runs = [], lead = 0, fill = null, code = false, nowrap = false } = line;
  if (code) return wrapCells(runs, Math.max(8, width), lead);
  if (nowrap) return [{ runs, fill: fill ? 'code' : null }];

  const lines = [];
  let cur = [];
  let curW = 0;
  let first = true;
  const openLine = () => {
    cur = first || !lead ? [] : [{ text: ' '.repeat(lead), style: undefined }];
    curW = first || !lead ? 0 : lead;
    first = false;
  };
  const flush = () => {
    if (cur.some((r) => r.text.trim())) lines.push(cur);
    openLine();
  };
  openLine();
  for (const run of runs) {
    for (const token of String(run.text).split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        if (token.includes('\n')) flush();
        else if (curW > 0 && curW + 1 <= width) {
          cur.push({ text: ' ', style: undefined });
          curW += 1;
        }
        continue;
      }
      const tw = strWidth(token);
      if (curW + tw > width && curW > 0) flush();
      if (tw > width) {
        let slice = '';
        let sliceW = 0;
        for (const ch of token) {
          if (sliceW + 1 > width - (curW === 0 ? 0 : curW) - (curW ? 0 : lead)) {
            if (slice) {
              cur.push({ text: slice, style: run.style });
              curW += sliceW;
            }
            flush();
            slice = '';
            sliceW = 0;
          }
          slice += ch;
          sliceW += strWidth(ch);
        }
        if (slice) {
          cur.push({ text: slice, style: run.style });
          curW += sliceW;
        }
        continue;
      }
      cur.push({ text: token, style: run.style });
      curW += tw;
    }
  }
  if (cur.some((r) => r.text.trim())) lines.push(cur);
  if (!lines.length) return [{ runs: [], fill: null }];
  return lines.map((r) => ({ runs: r, fill: fill ? 'code' : null }));
}

/**
 * Cell-accurate wrap for code blocks: keeps every space, splits on exact display width,
 * and reserves room for the indent on every line.
 */
function wrapCells(runs, width, lead) {
  const flat = [];
  for (const run of runs) {
    for (const ch of run.text) flat.push({ ch, style: run.style });
  }
  const logical = [];
  let row = [];
  for (const cell of flat) {
    if (cell.ch === '\n') {
      logical.push(row);
      row = [];
    } else if (cell.ch !== '\r') row.push(cell);
  }
  logical.push(row);
  const CONT = 4;
  const out = [];
  for (const cells of logical) {
    if (!cells.length) {
      out.push({ runs: [{ text: ' '.repeat(lead), style: undefined }], fill: 'code' });
      continue;
    }
    let first = true;
    for (let i = 0; i < cells.length; ) {
      const prefix = first ? ' '.repeat(lead) : ' '.repeat(lead + CONT);
      const avail = Math.max(4, width - prefix.length);
      const chunk = cells.slice(i, i + avail);
      const merged = [];
      for (const c of chunk) {
        const last = merged[merged.length - 1];
        if (last && last.style === c.style) last.text += c.ch;
        else merged.push({ text: c.ch, style: c.style });
      }
      out.push({ runs: [{ text: prefix, style: undefined }, ...merged], fill: 'code' });
      i += chunk.length;
      first = false;
      if (!chunk.length) break;
    }
  }
  return out;
}

/** Flatten markdown to plain text at a given width. */
export function mdToText(md, width = 80) {
  return mdToLines(md, { width, theme: passthrough })
    .map((l) => l.runs.map((r) => r.text).join(''))
    .join('\n');
}

const passthrough = {
  colors: {},
  style: (_t, extra) => extra || undefined,
};
