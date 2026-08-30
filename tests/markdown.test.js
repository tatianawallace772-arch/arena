import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mdToLines, mdToText, wrapRuns } from '../src/ui/markdown.js';
import { highlight } from '../src/ui/highlight.js';
import { applyEdits, diffLines, diffToLines } from '../src/ui/diff.js';
import { themeByName } from '../src/ansi/theme.js';

const theme = themeByName('dark');
const render = (md, width = 60) => mdToLines(md, { width, theme });
const plain = (md, width = 60) =>
  render(md, width)
    .map((l) => l.runs.map((r) => r.text).join(''))
    .join('\n');

test('headings drop the # markers and are bold', () => {
  const lines = render('## Root cause');
  const line = lines.find((l) => l.runs.map((r) => r.text).join('').includes('Root cause'));
  assert.ok(line, 'heading text is present');
  assert.ok(line.runs.some((r) => r.style?.bold), 'heading run is bold');
  assert.ok(!plain('## Root cause').includes('##'));
});

test('inline marks become styled runs', () => {
  const line = render('use `npm test` and **bold** words')[0];
  const joined = line.runs.map((r) => r.text).join('');
  assert.equal(joined, 'use npm test and bold words', 'markers are consumed, not printed');
  assert.ok(line.runs.some((r) => r.style?.bg), 'code span keeps a background style');
  assert.ok(line.runs.some((r) => r.text === 'bold' && r.style?.bold));
});

test('bullet lists get a bullet glyph and continuation indent', () => {
  const out = render('- first item\n- second item');
  assert.match(out[0].runs.map((r) => r.text).join(''), /^• first item$/);
  assert.equal(out[0].runs[0].style, theme.style('accent'), 'bullet uses the accent colour');
});

test('fenced code keeps indentation and tags the fill for a background', () => {
  const md = '```js\nfunction f() {\n  return 1;\n}\n```';
  const lines = render(md);
  assert.ok(lines.every((l) => l.fill === 'code'));
  const texts = lines.map((l) => l.runs.map((r) => r.text).join(''));
  assert.ok(texts.some((t) => t.startsWith('  function f() {')), texts.join('|'));
  assert.ok(texts.some((t) => t.startsWith('    return 1;')), 'inner indent preserved: ' + texts.join('|'));
});

test('code lines wrap on cell boundaries and keep every space', () => {
  const long = '  const value = ' + 'z'.repeat(60);
  const lines = wrapRuns({ runs: [{ text: long, style: undefined }], lead: 2, code: true, fill: 'code' }, 30);
  assert.ok(lines.length >= 3, 'wrapped');
  assert.ok(lines.every((l) => l.runs.map((r) => r.text).join('').length <= 30));
  assert.ok(lines.every((l) => l.fill === 'code'));
  const flat = lines.map((l) => l.runs.map((r) => r.text).join('')).join('');
  assert.ok(flat.includes('  const value ='), 'leading indent survives the wrap');
  assert.equal((flat.match(/z/g) || []).length, 60, 'nothing dropped by the wrap');
  assert.ok(flat.includes('z'.repeat(20)), 'long token is split across wrapped lines');
});

test('tables align to the widest cell in each column', () => {
  const md = '| File | Risk |\n|---|---|\n| src/store.js | high |\n| src/log.js | low |';
  const rows = render(md)
    .map((l) => l.runs.map((r) => r.text).join(''))
    .filter((r) => r.startsWith('│'));
  assert.equal(new Set(rows.map((r) => r.length)).size, 1, 'all table rows share one width: ' + JSON.stringify(rows));
  assert.ok(rows[0].includes('File') && rows[1].includes('src/store.js'));
});

test('rules and quotes render', () => {
  assert.match(plain('---'), /^─{4,}$/);
  const quote = render('> careful here')[0].runs.map((r) => r.text).join('');
  assert.ok(quote.startsWith('│ '));
});

test('highlighter tags keywords, strings and comments', () => {
  const runs = highlight("const x = 'a'; // note", 'js');
  const byType = Object.fromEntries(runs.map((r) => [r.type, (byTypeGet(runs, r.type) || r.text)]));
  function byTypeGet(list, type) {
    return list.filter((r) => r.type === type).map((r) => r.text).join('');
  }
  assert.equal(byType.kw, 'const');
  assert.equal(byType.str, "'a'");
  assert.ok(byType.com.includes('note'));
});

test('unknown languages fall back to plain text', () => {
  const runs = highlight('hello world', 'cobol');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, 'hello world');
});

test('mdToText is used for clipboard and markdown export', () => {
  const out = mdToText('# Title\n\nbody **text**', 40);
  assert.match(out, /Title/);
  assert.ok(!out.includes('**'), 'marks are resolved, not echoed');
});

test('diffLines produces hunks with line numbers', () => {
  const a = ['one', 'two', 'three'].join('\n');
  const b = ['one', 'TWO', 'three'].join('\n');
  const d = diffLines(a, b);
  assert.equal(d.added, 1);
  assert.equal(d.removed, 1);
  assert.equal(d.hunks.length, 1);
  const op = d.hunks[0].lines.find((l) => l.type === '+');
  assert.equal(op.new, 2);
  assert.equal(d.identical, false);
  assert.equal(diffLines(a, a).identical, true);
});

test('diffToLines truncates long diffs with a marker', () => {
  const a = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
  const b = a.replace('line 1', 'changed');
  const { lines, hidden } = diffToLines(a, b, { maxLines: 5 });
  assert.equal(lines.length, 6);
  assert.match(lines[5].text, /more lines in diff/);
  assert.ok(hidden > 0);
});

test('applyEdits requires a unique match, like the Edit tool', () => {
  const text = 'a\nb\na\n';
  const bad = applyEdits(text, [{ oldText: 'a', newText: 'z' }]);
  assert.equal(bad.replaced, 0);
  assert.match(bad.problems[0], /matched 2 times/);
  const all = applyEdits(text, [{ oldText: 'a', newText: 'z', replaceAll: true }]);
  assert.equal(all.replaced, 1, 'one edit operation');
  assert.equal(all.occurrences, 2, 'which touched two lines');
  assert.equal(all.text, 'z\nb\nz\n');
  const missing = applyEdits(text, [{ oldText: 'q', newText: 'z' }]);
  assert.match(missing.problems[0], /not found/);
});
