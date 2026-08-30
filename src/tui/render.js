/**
 * Block → styled terminal lines. Every transcript block knows how to draw itself into a
 * list of rows, each a list of {text, style} runs. The App paints these into a Screen and
 * the Screen diffs against the previous frame, so this file stays free of ANSI.
 */
import { mdToLines } from '../ui/markdown.js';
import { diffToLines } from '../ui/diff.js';
import { fit, padCenter, strWidth, wrap } from '../ansi/text.js';

/** run */
const R = (text, style) => ({ text, style });
/** plain line of one style */
const L = (text, style) => [R(text, style)];

export const HELLO = ['Hello!', 'Hi!', 'Hey!', "Let's code.", 'Ready.', 'Go for it.', 'Good morning.'];
export { SPARKS, VERBS, SPINNER_FRAMES, spinnerFrame, pickVerb } from './spinner.js';
import { spinnerFrame, pickVerb } from './spinner.js';
void spinnerFrame;
void pickVerb;

/* ------------------------------------------------------------------ header */

export function headerLines({ width, theme, version, model, plan, cwd, hello, spark }) {
  const boxW = Math.max(46, width);
  const inner = boxW - 2;
  const art = ['▐▛███▜▌', '▝▜█████▛▘', ' ▘▘ ▝▝ '];
  const meta = [`Claude Code ${version}`, `${model} · ${plan}`, cwd];
  const artW = 9;
  const metaW = Math.max(...meta.map((m) => strWidth(m)));
  const blockW = Math.min(inner - 2, artW + 2 + metaW);
  const left = Math.max(1, Math.floor((inner - blockW) / 2));
  const accent = { fg: theme.colors.accent, bold: true };
  const border = theme.style('border');
  const out = [L(''), [R('╭' + '─'.repeat(inner) + '╮', border)]];
  for (let i = 0; i < 3; i++) {
    const metaText = meta[i].slice(0, Math.max(4, blockW - artW - 2));
    const used = left + artW + 2 + strWidth(metaText);
    out.push([
      R('│', border),
      R(' '.repeat(left), undefined),
      R(padCenter(art[i], artW), accent),
      R('  ', undefined),
      R(metaText, i === 0 ? theme.style('text', { bold: true }) : theme.style('dim')),
      R(' '.repeat(Math.max(0, inner - used)), undefined),
      R('│', border),
    ]);
  }
  out.push([R('╰' + '─'.repeat(inner) + '╯', border)]);
  const greeting = `${spark} ${hello}`;
  out.push([R(' '.repeat(Math.max(0, width - strWidth(greeting))), undefined), R(greeting, accent)]);
  out.push(L('─'.repeat(width), theme.style('faint')));
  return out;
}
export function welcomeLines({ width, theme, tips, extra }) {
  const out = [];
  out.push(L(''));
  out.push([R(" Let's get started.", theme.style('text', { bold: true }))]);
  for (const [i, tip] of (tips ?? []).entries()) {
    const body = wrap(String(tip), Math.max(20, width - 7), { indent: '       ' });
    body.forEach((line, k) => {
      out.push(k === 0
        ? [R('   ', undefined), R(`${i + 1}. `, theme.style('dim')), R(line.replace(/^\s+/, ''), theme.style('dim'))]
        : [R(line, theme.style('dim'))]);
    });
  }
  if (extra?.length) {
    out.push(L(''));
    for (const line of extra) {
      for (const l of wrap(line, Math.max(20, width - 3), { indent: '   ' })) out.push(L(l, theme.style('faint')));
    }
  }
  out.push(L(''));
  return out;
}

/* ------------------------------------------------------------------ blocks */

export function userLines(block, { width, theme }) {
  const body = wrap(block.text, width - 2, { firstIndent: '> ', indent: '  ' });
  const out = [];
  body.forEach((line, i) => {
    out.push([R(i === 0 ? '> ' : '  ', theme.style('accent')), R(line.trimStart() === '' ? '' : line.slice(i === 0 ? 2 : 2), theme.style('text'))]);
  });
  out.push(L(''));
  return out;
}

export function assistantLines(block, { width, theme }) {
  const rendered = mdToLines(block.md, { width, theme });
  const out = rendered.map((l) => l.runs.slice());
  if (block.streaming) {
    const lastIdx = out.length - 1;
    if (lastIdx >= 0) out[lastIdx] = [...out[lastIdx], R('▋', theme.style('accent'))];
    else out.push([R('▋', theme.style('accent'))]);
  } else {
    out.push(L(''));
  }
  return out.map((runs) => [R('', undefined), ...runs]);
}

export function thinkingLines(block, { theme, width, verbose }) {
  if (block.md !== undefined) block.text = block.md;
  const shown = verbose || block.expanded;
  const head = [
    R('∴ ', theme.style('dim')),
    R('Thinking', theme.style('dim')),
    R(block.streaming ? '…' : '', theme.style('dim')),
    R(shown ? '' : ` · ${estimateLines(block.text)} lines · ctrl+o to expand`, theme.style('faint')),
  ];
  if (!shown) return [head];
  const out = [head];
  for (const line of wrap(block.text, width - 4, { indent: '  ', firstIndent: '  ' })) {
    out.push([R('  ⎿ ', theme.style('faint')), R(line.slice(2) || '', theme.style('dim', { italic: true }))]);
  }
  return out;
}

const estimateLines = (t) => Math.max(1, Math.ceil(String(t).split('\n').join(' ').length / 78));

export function toolLines(block, { theme, width, verbose }) {
  const c = theme.colors;
  const args = block.args || {};
  const glyph = block.status === 'error' || block.status === 'denied' ? '✗' : block.status === 'running' ? spinnerFrame(block.tick ?? 0) : '●';
  const gStyle = block.status === 'error' ? theme.style('red') : block.status === 'denied' ? theme.style('red') : theme.style('text');
  const label = toolLabel(block.name, args);
  const out = [[R(glyph + ' ', gStyle), R(label, theme.style('text', { bold: false }))]];
  const sub = (runs) => out.push([R('  ⎿ ', theme.style('faint')), ...runs]);

  if (block.status === 'running') {
    sub([R(block.progressLabel ?? 'Running…', theme.style('yellow'))]);
    if (block.progress) sub([R('     ', undefined), R(block.progress, theme.style('dim'))]);
    return out;
  }
  if (block.status === 'denied') {
    sub([R('Rejected by user — tool was not run.', theme.style('red'))]);
    return out;
  }
  if (block.status === 'error') {
    sub([R(block.summary ?? 'Error', theme.style('red'))]);
    for (const line of wrap(block.error ?? '', Math.max(20, width - 6), { indent: '     ', firstIndent: '     ' }).slice(0, verbose ? 40 : 4)) {
      out.push(L(line, theme.style('dim')));
    }
    return out;
  }

  sub([R(block.summary ?? 'Done', theme.style('dim'))]);

  if (block.diff && (verbose || block.showDiff)) {
    const d = diffToLines(block.diff.prev, block.diff.next, { context: 2, maxLines: verbose ? 60 : 12 });
    for (const line of d.lines) {
      if (line.kind === 'hunk') {
        out.push([R('      ', undefined), R(line.text, theme.style('faint'))]);
        continue;
      }
      const mark = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' ';
      const sty = { fg: line.kind === 'add' ? c.diffAdd : line.kind === 'del' ? c.diffDel : c.dim };
      if (line.kind !== 'ctx' && c.diffAddBg) sty.bg = line.kind === 'add' ? c.diffAddBg : c.diffDelBg;
      out.push([
        R('      ', undefined),
        R(String(line.old ?? '').padStart(4, ' '), theme.style('faint')),
        R(String(line.new ?? '').padStart(4, ' '), theme.style('faint')),
        R(' ' + mark + ' ', sty),
        R(fit(line.text ?? '', Math.max(10, width - 16)), sty),
      ]);
    }
  }
  if (block.preview?.length && verbose) {
    for (const line of block.preview.slice(0, 24)) out.push(L('      ' + line, theme.style('dim')));
  }
  if (block.output?.length) {
    const shown = verbose ? block.output : block.output.slice(0, 6);
    for (const [i, line] of shown.entries()) {
      const style = line.kind === 'fail' ? theme.style('red') : line.kind === 'pass' ? theme.style('green') : line.kind === 'detail' ? theme.style('dim') : line.kind === 'file' ? theme.style('dim') : theme.style('text');
      out.push([R('      ', undefined), R(i === shown.length - 1 && !verbose && block.output.length > shown.length ? `… +${block.output.length - shown.length} lines` : fit(line.text ?? String(line), Math.max(10, width - 6)), style)]);
    }
  }
  return out;
}

export function toolLabel(name, args = {}) {
  switch (name) {
    case 'Bash':
      return `Bash(${trim(args.command ?? '', 58)})`;
    case 'Read':
      return `Read(${args.file_path ?? ''})`;
    case 'Edit':
      return `Update(${args.file_path ?? ''})`;
    case 'MultiEdit':
      return `Update(${args.file_path ?? ''})`;
    case 'Write':
      return `Write(${args.file_path ?? ''})`;
    case 'Glob':
      return `Glob("${args.pattern ?? ''}")`;
    case 'Grep':
      return `Search("${trim(args.pattern ?? '', 40)}")`;
    case 'Task':
      return `Task(${trim(args.description ?? 'subagent', 48)})`;
    case 'WebFetch':
      return `Fetch(${trim(args.url ?? '', 48)})`;
    default:
      return `${name}(${trim(args.file_path ?? args.command ?? args.pattern ?? '', 48)})`;
  }
}

const trim = (s, n) => {
  const one = String(s ?? '').replace(/\s+/g, ' ');
  return one.length > n ? one.slice(0, n - 1) + '…' : one;
};

/** The quiet line the CLI leaves after a finished turn: "✻ Simmered for 6s". */
export function finishLines(block, { theme }) {
  return [L(''), L(' ' + (block.text ?? ''), theme.style('dim', { italic: true }))];
}

export function systemLines(block, { theme }) {
  const tone = block.tone ?? 'dim';
  const style = tone === 'warn' ? theme.style('yellow') : tone === 'error' ? theme.style('red') : tone === 'ok' ? theme.style('green') : theme.style('dim', { italic: true });
  return [L(' ' + block.text, style)];
}

export function errorLines(block, { theme, width }) {
  const out = [[R('✻ Error: ', theme.style('red', { bold: true })), R(String(block.text).split('\n')[0], theme.style('red'))]];
  for (const line of wrap(String(block.text).split('\n').slice(1).join('\n'), width - 2, { indent: '  ' })) out.push(L(line, theme.style('dim')));
  out.push(L(''));
  return out;
}

export function todoLines(block, { theme, width }) {
  const items = block.items ?? [];
  const done = items.filter((i) => i.status === 'completed').length;
  const out = [[R(' Tasks ', theme.style('text', { bold: true })), R(`${done}/${items.length}`, theme.style('dim')), R('', theme.style('faint'))]];
  const maxW = Math.max(10, width - 4);
  for (const item of items) {
    const glyph = item.status === 'completed' ? '✔' : item.status === 'in_progress' ? '◐' : '←';
    const sty =
      item.status === 'completed'
        ? theme.style('green')
        : item.status === 'in_progress'
          ? theme.style('accent')
          : theme.style('dim');
    const label = item.content ?? item.text ?? '';
    const text = item.status === 'completed' ? label + ' (done)' : item.status === 'rejected' ? label + ' (rejected)' : label;
    out.push([R('  ', undefined), R(glyph + ' ', sty), R(fit(text, maxW - 4), item.status === 'completed' ? theme.style('dim', { strike: true }) : theme.style('text'))]);
  }
  return out;
}

/* ------------------------------------------------------------------ permission */

export function permissionLines(block, { theme, width, sel, diffView = true, avail = 0 }) {
  const c = theme.colors;
  const tool = block.tool;
  const isEdit = ['Edit', 'Write', 'MultiEdit'].includes(tool.name);
  const head = [];
  head.push(L('─'.repeat(width), theme.style('faint')));
  head.push([R(' ' + (isEdit ? 'Claude Code wants to edit a file' : 'Claude Code wants to run a command'), theme.style('text', { bold: true }))]);
  head.push(L(''));
  if (!isEdit) {
    for (const line of wrap(tool.args.command ?? '', width - 4, { indent: '    ' })) head.push(L(line, theme.style('code')));
    if (tool.args.description) head.push([R('    ' + tool.args.description, theme.style('dim'))]);
    head.push(L(''));
  }
  const q = isEdit
    ? `Do you want to make this edit to ${tool.args.file_path ?? 'this file'}?`
    : tool.name === 'Bash'
      ? 'Do you want to allow this command to run?'
      : `Do you want to allow ${tool.name}?`;
  const tail = [];
  tail.push([R(' ' + q, theme.style('text', { bold: true }))]);
  tail.push(L(''));
  block.options.forEach((opt, i) => {
    const active = i === sel;
    tail.push([
      R(active ? ' ❯ ' : '   ', active ? theme.style('accent', { bold: true }) : theme.style('faint')),
      R(`${i + 1}. `, theme.style('dim')),
      R(opt.label, active ? theme.style('text', { bold: true }) : theme.style('dim')),
      R(opt.hint ? `  ${opt.hint}` : '', theme.style('faint')),
    ]);
  });
  tail.push(L(''));
  tail.push([
    R(' Esc to cancel', theme.style('faint')),
    R(' · Tab to ' + (isEdit ? 'amend' : 'switch modes'), theme.style('faint')),
    R(' · ↑↓ to select', theme.style('faint')),
    R(block.scope ? ` · ${block.scope}` : '', theme.style('faint')),
  ]);
  tail.push(L('─'.repeat(width), theme.style('faint')));

  // The diff is the part that gives way: it is shrunk to fit, and only dropped when
  // there is genuinely no room for it.
  const buildDiff = (maxLines) => {
    const d = diffToLines(tool.diff.prev, tool.diff.next, { context: 3, maxLines });
    const rows = [];
    rows.push([R(' ' + (tool.args.file_path ?? ''), theme.style('dim'))]);
    rows.push(L('╌'.repeat(Math.min(width, 72)), theme.style('faint')));
    for (const line of d.lines) {
      if (line.kind === 'hunk') {
        rows.push(L('  ' + line.text, theme.style('faint')));
        continue;
      }
      const mark = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : '│';
      const fg = line.kind === 'add' ? c.diffAdd : line.kind === 'del' ? c.diffDel : c.dim;
      const bg = line.kind === 'add' ? c.diffAddBg : line.kind === 'del' ? c.diffDelBg : undefined;
      rows.push([
        R('  ' + String(line.old ?? '').padStart(4, ' ') + String(line.new ?? '').padStart(4, ' ') + ' ', theme.style('faint')),
        R(mark + ' ', bg ? { fg, bg } : { fg }),
        R(fit(line.text ?? '', Math.max(8, width - 14)), bg ? { fg, bg } : { fg }),
      ]);
    }
    rows.push(L('╌'.repeat(Math.min(width, 72)), theme.style('faint')));
    rows.push(L(''));
    return rows;
  };
  if (!isEdit || !diffView) return [...head, ...tail];
  const full = buildDiff(60);
  if (!avail || head.length + full.length + tail.length <= avail) return [...head, ...full, ...tail];
  const room = avail - head.length - tail.length - 4;
  if (room < 3) return [...head, ...tail];
  return [...head, ...buildDiff(room), ...tail];
}
/* ------------------------------------------------------------------ input */

/**
 * The rounded prompt box. `rows` is the wrapped view of the current input, `cursor` is
 * an absolute {row,col} in the *unwrapped* text so the caret can be echoed correctly.
 */
export function inputLines({ theme, width, rows = [''], cursor = { row: 0, col: 0 }, mode = 'manual', error = false, focused = true, placeholder, history = false }) {
  const c = theme.colors;
  const border = error ? { fg: c.red } : focused ? theme.style('borderFocus') : theme.style('border');
  const label = { acceptEdits: 'accept edits on', plan: 'plan mode', auto: 'auto mode' }[mode] ?? null;
  const out = [];
  const innerW = Math.max(6, width - 5);
  const top = [R('╭', border)];
  if (label) {
    const text = ' ' + label + ' ';
    top.push(R(text, mode === 'plan' ? { fg: c.accent } : theme.style('dim')));
    top.push(R('─'.repeat(Math.max(0, width - 2 - strWidth(text))), border));
  } else {
    top.push(R('─'.repeat(Math.max(0, width - 2)), border));
  }
  top.push(R('╮', border));
  out.push(top);

  const maxRows = 10;
  const view = rows.slice(0, maxRows);
  const empty = !view.some((r) => r.length);
  view.forEach((line, i) => {
    if (empty && i === 0) {
      const ph = placeholder ?? 'Try "fix the failing test"';
      const shown = ph.slice(0, innerW);
      out.push([
        R('│', border),
        R(' ❯ ', theme.style('faint')),
        R(shown, theme.style('faint', { italic: true })),
        R(' '.repeat(Math.max(0, innerW - strWidth(shown))), undefined),
        R('│', border),
      ]);
      return;
    }
    const clipped = line.slice(0, innerW);
    let body;
    if (cursor.row === i) {
      const col = Math.min(cursor.col, clipped.length);
      const at = col < clipped.length ? clipped[col] : ' ';
      body = [
        R(clipped.slice(0, col), theme.style('text')),
        R(at, theme.style('text', { inverse: true })),
        R(clipped.slice(col + 1), theme.style('text')),
      ];
    } else {
      body = [R(clipped, theme.style('text'))];
    }
    const used = Math.min(innerW, strWidth(clipped) + (cursor.row === i && cursor.col >= clipped.length ? 1 : 0));
    out.push([R('│', border), R(i === 0 ? ' ❯ ' : '   ', i === 0 ? theme.style('accent') : theme.style('faint')), ...body, R(' '.repeat(Math.max(0, innerW - used)), undefined), R('│', border)]);
  });
  if (rows.length > maxRows) {
    const note = `   … +${rows.length - maxRows} more lines`;
    out.push([R('│', border), R(note, theme.style('faint')), R(' '.repeat(Math.max(0, innerW - strWidth(note) + 3)), undefined), R('│', border)]);
  }
  out.push([R('╰', border), R('─'.repeat(Math.max(0, width - 2)), border), R('╯', border)]);
  return out;
}

export function footerLines({ theme, width, mode, busy, ctx, model, cost, branch, vim, queued }) {
  const c = theme.colors;
  const modeLabel =
    { manual: '⏵⏵ manual approve', acceptEdits: '⏵⏵ accept edits on', plan: '⏸ plan mode on', auto: '⚡ auto mode on' }[mode] ?? mode;
  const modeStyle = mode === 'manual' ? theme.style('faint') : theme.style('yellow');
  const barW = Math.max(5, Math.min(10, Math.floor(width / 12)));
  const used = Math.max(0, Math.min(barW, Math.round(ctx.pct * barW)));
  const bar = '▓'.repeat(used) + '░'.repeat(barW - used);
  const ctxBar = [
    R(' ctx ', theme.style('faint')),
    R(bar, ctx.pct > 0.9 ? theme.style('red') : ctx.pct > 0.7 ? theme.style('yellow') : theme.style('dim')),
    R(` ${Math.round(ctx.pct * 100)}%`, theme.style('faint')),
  ];
  const extras = [
    ...(vim ? [R(' -- NORMAL --', theme.style('blue', { bold: true }))] : []),
    ...(queued ? [R(` ${queued} queued`, theme.style('accent'))] : []),
  ];
  const leftTiers = [
    [R(' ? for shortcuts', theme.style('faint')), R(' · ', theme.style('faint')), R(modeLabel, modeStyle), R(' · shift+tab to toggle', theme.style('faint')), ...extras],
    [R(' ? for shortcuts', theme.style('faint')), R(' · ', theme.style('faint')), R(modeLabel, modeStyle), ...extras],
    [modeLabel, ...extras],
  ];
  const rightTiers = [[...ctxBar, R(` · ${branch}`, theme.style('dim')), R(` · ${model}`, theme.style('dim'))], ctxBar, []];
  let chosen = null;
  for (const left of leftTiers) {
    for (const right of rightTiers) {
      if (widthOf(left) + widthOf(right) + 2 <= width) {
        chosen = { left, right };
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) chosen = { left: leftTiers[leftTiers.length - 1], right: [] };
  const gap = Math.max(1, width - widthOf(chosen.left) - widthOf(chosen.right));
  const out = [...chosen.left, R(' '.repeat(gap), undefined), ...chosen.right];
  if (cost > 0 && widthOf(out) + 9 <= width) {
    out.push(R(' · ', theme.style('faint')), R(`$${cost.toFixed(2)}`, theme.style('faint')));
  }
  return [out];
}

export function statusLine({ theme, label, elapsed, tokens, hint }) {
  const spark = spinnerFrame(Math.floor(Date.now() / 120));
  return [
    R(' ' + spark + ' ', theme.style('accent')),
    R(label + '…', theme.style('text')),
    R(` (esc to interrupt${hint ? ' · ' + hint : ''} · ${elapsed}${tokens ? ` · ${tokens}` : ''})`, theme.style('faint')),
  ];
}

/** Live permission / plan prompt, painted into the bottom chrome above the input. */
export function dialogLines(dlg, { theme, width, sel, diffView, avail = 0 }) {
  if (dlg.type === 'plan') {
    const out = [];
    out.push(L('─'.repeat(width), theme.style('faint')));
    out.push([R(' ∴ ', theme.style('accent')), R('Plan ready. ', theme.style('text', { bold: true })), R(String(dlg.tool?.args?.plan ?? ''), theme.style('dim'))]);
    out.push(L(''));
    out.push([R(' Do you want to proceed?', theme.style('text', { bold: true }))]);
    out.push(L(''));
    (dlg.options ?? []).forEach((opt, i) => {
      out.push([
        R(i === sel ? ' ❯ ' : '   ', i === sel ? theme.style('accent', { bold: true }) : theme.style('faint')),
        R(`${i + 1}. `, theme.style('dim')),
        R(opt.label, i === sel ? theme.style('text', { bold: true }) : theme.style('dim')),
      ]);
    });
    out.push(L(''));
    out.push(L(' Esc to cancel · ↑↓ to select · plan mode stays read-only until you approve', theme.style('faint')));
    out.push(L('─'.repeat(width), theme.style('faint')));
    return out;
  }
  return permissionLines(dlg.block, { theme, width, sel, diffView, avail });
}

export const widthOf = (runs) => runs.reduce((n, r) => n + strWidth(r.text), 0);

/* ------------------------------------------------------------------ dialogs */

export function listDialogLines({ theme, width, title, items, sel, hint, note, avail = 0 }) {
  const boxW = Math.min(width, 78);
  const inner = Math.max(10, boxW - 2);
  const metaW = items.reduce((n, i) => Math.max(n, strWidth(i.meta ?? '')), 0);
  const prefixW = 3;
  const labelW = Math.max(10, inner - prefixW - (metaW ? metaW + 1 : 0));
  const border = theme.style('border');
  const chromeRows = 3 + (note ? 1 : 0) + (hint ? 1 : 0);
  const maxRows = Math.max(3, Math.min(items.length, avail > 0 ? avail - chromeRows : 12));
  let from = 0;
  if (items.length > maxRows) {
    from = Math.max(0, Math.min(items.length - maxRows, (sel ?? 0) - Math.floor(maxRows / 2)));
  }
  const shown = items.slice(from, from + maxRows);
  const above = from;
  const below = items.length - from - shown.length;
  const out = [];
  out.push(L('╭' + '─'.repeat(inner) + '╮', border));
  const headTitle = ' ' + (title ?? '') + (items.length > maxRows ? `  (${(sel ?? 0) + 1}/${items.length})` : '');
  out.push([R('│', border), R(fit(headTitle, inner), theme.style('text', { bold: true })), R('│', border)]);
  out.push(L('│' + '─'.repeat(inner) + '│', border));
  if (above) out.push([R('│', border), R(` ⋯ ${above} above`, theme.style('faint')), R(' '.repeat(Math.max(0, inner - strWidth(` ⋯ ${above} above`))), undefined), R('│', border)]);
  shown.forEach((item, k) => {
    const idx = item.index ?? from + k;
    const active = idx === sel;
    const runs = [
      R('│', border),
      R(active ? ' ❯ ' : '   ', active ? theme.style('accent') : theme.style('faint')),
      R(fit(item.label ?? '', labelW), active ? theme.style('text', { bold: true }) : theme.style('text')),
    ];
    if (metaW) {
      const meta = String(item.meta ?? '');
      runs.push(R(' ' + ' '.repeat(Math.max(0, metaW - strWidth(meta))) + meta, theme.style('faint')));
    }
    const used = prefixW + labelW + (metaW ? metaW + 1 : 0);
    runs.push(R(' '.repeat(Math.max(0, inner - used)), undefined), R('│', border));
    out.push(runs);
  });
  if (below) out.push([R('│', border), R(` ⋯ ${below} more`, theme.style('faint')), R(' '.repeat(Math.max(0, inner - strWidth(` ⋯ ${below} more`))), undefined), R('│', border)]);
  out.push(L('╰' + '─'.repeat(inner) + '╯', border));
  if (note) out.push(L(' ' + note, theme.style('dim')));
  if (hint) out.push(L(' ' + hint, theme.style('faint')));
  return out;
}
/** Titled info panel used by /status, /cost, /context, /doctor, /help. */
export function panelLines({ theme, width, title, body, foot, avail = 0 }) {
  const boxW = Math.min(width, 78);
  const inner = Math.max(10, boxW - 2);
  const border = theme.style('border');
  const rows = body ?? [];
  const overhead = 2 + (title ? 1 : 0) + (foot ? 1 : 0);
  const maxBody = avail > 0 ? Math.max(2, avail - overhead) : rows.length;
  const shown = rows.slice(0, maxBody);
  const out = [];
  out.push(L('╭' + '─'.repeat(inner) + '╮', border));
  if (title) out.push([R('│', border), R(fit(' ' + title, inner), theme.style('accent', { bold: true })), R('│', border)]);
  for (const line of shown) {
    const runs = typeof line === 'string' ? [R(line, theme.style('dim'))] : line;
    const used = widthOf(runs);
    out.push([R('│', border), R(' ', undefined), ...runs, R(' '.repeat(Math.max(0, inner - 1 - used)), undefined), R('│', border)]);
  }
  if (rows.length > shown.length) {
    const more = rows.length - shown.length;
    const note = `… ${more} more line${more === 1 ? '' : 's'} · a taller window shows all`;
    out.push([R('│', border), R(' ' + fit(note, inner - 1), theme.style('faint')), R(' '.repeat(Math.max(0, inner - 1 - strWidth(note))), undefined), R('│', border)]);
  }
  out.push(L('╰' + '─'.repeat(inner) + '╯', border));
  if (foot) out.push(L(' ' + foot, theme.style('faint')));
  return out;
}
export { R, L, fit, wrap };
