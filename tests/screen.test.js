import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Screen, StyleRegistry } from '../src/ansi/screen.js';

test('screen paints text and reports full width rows', () => {
  const s = new Screen(3, 10);
  s.text(0, 1, 'hello', {});
  const rows = s.toText().split('\n');
  assert.equal(rows[1].trimEnd(), 'hello');
});

test('text beyond the right edge is clipped, not wrapped', () => {
  const s = new Screen(2, 6);
  s.text(0, 0, 'abcdefghij', {});
  assert.equal(s.toText().split('\n')[0].trimEnd(), 'abcdef');
});

test('diff only emits the cells that changed', () => {
  const s = new Screen(2, 12);
  s.text(0, 0, 'frame one', {});
  const first = s.diff(null);
  assert.ok(first.ansi.includes('frame one'), 'first paint writes everything');
  s.text(6, 0, 'ONE', {});
  const second = s.diff(first.snapshot);
  assert.ok(second.changed);
  assert.ok(!second.ansi.includes('frame'), 'untouched prefix is not rewritten');
  assert.ok(second.ansi.includes('ONE'));
  const third = s.diff(second.snapshot);
  assert.equal(third.changed, false, 'identical frame is a no-op');
  assert.equal(third.ansi, '');
});

test('cursor addressing uses 1-based rows and columns', () => {
  const s = new Screen(4, 20);
  s.text(3, 2, 'x', {});
  const { ansi } = s.diff(null);
  // blank cells are skipped against a cleared screen, so only the glyph run is emitted
  assert.ok(ansi.includes('\x1b[3;4Hx'), ansi);
  assert.ok(!ansi.includes('\x1b[1;1H'), 'no runs for untouched blank rows');
});

test('border draws a rounded box with an optional title', () => {
  const s = new Screen(4, 12);
  s.border(0, 0, 10, 4, { title: 'hi' });
  const rows = s.toText().split('\n');
  assert.equal(rows[0], '╭─ hi ───╮');
  assert.ok(rows[1].startsWith('│') && rows[1].endsWith('│'));
  assert.ok(rows[3].startsWith('╰') && rows[3].endsWith('╯'));
});

test('resize keeps overlap and clears the diff baseline', () => {
  const s = new Screen(2, 4);
  s.text(0, 0, 'abcd', {});
  assert.ok(s.resize(4, 6));
  assert.equal(s.toText().split('\n')[0].trimEnd(), 'abcd');
  assert.equal(s.resize(4, 6), false, 'no-op resize returns false');
});

test('style registry interns styles and emits truecolour + indexed sgr', () => {
  const reg = new StyleRegistry();
  const a = reg.id({ fg: '#ff0000', bold: true });
  const b = reg.id({ bold: true, fg: '#ff0000' });
  assert.equal(a, b, 'same style resolves to the same id');
  assert.equal(reg.sgrFor(a), '\x1b[1;38;2;255;0;0m');
  assert.equal(reg.sgrFor(reg.id({ fg: 9 })), '\x1b[38;5;9m');
  assert.equal(reg.sgrFor(reg.id({})), '');
});

test('runs write mixed styles in order', () => {
  const s = new Screen(1, 12);
  s.runs(0, 0, [{ text: 'red', style: { fg: '#ff0000' } }, { text: '-', style: undefined }, { text: 'green', style: { fg: '#00ff00' } }]);
  assert.equal(s.toText().trimEnd(), 'red-green');
});
