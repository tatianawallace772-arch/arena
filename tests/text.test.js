import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fit, fmtDuration, fmtMoney, fmtTokens, homePath, padCenter, strWidth, wrap, wrapCapped } from '../src/ansi/text.js';

test('strWidth counts east asian cells as two', () => {
  assert.equal(strWidth('abc'), 3);
  assert.equal(strWidth('你好'), 4);
  assert.equal(strWidth('⎿╭─❯'), 4, 'box drawing and symbols are single cell');
});

test('fit pads to the exact width and truncates with an ellipsis', () => {
  assert.equal(fit('abc', 8).length, 8);
  assert.equal(fit('hello world', 11), 'hello world');
  assert.equal(strWidth(fit('x'.repeat(20), 7)), 7);
  assert.ok(fit('x'.repeat(20), 7).endsWith('…'));
  assert.equal(fit('toolong', 3), 'to…');
});

test('padCenter keeps the total width stable', () => {
  assert.equal(strWidth(padCenter('ab', 10)), 10);
  assert.equal(padCenter('ab', 10), '    ab    ');
});

test('wrap honours width, newlines and indentation', () => {
  const lines = wrap('the quick brown fox jumps over the lazy dog and keeps running', 20);
  assert.ok(lines.every((l) => strWidth(l) <= 20), JSON.stringify(lines));
  assert.equal(lines.join(' ').replace(/\s+/g, ' '), 'the quick brown fox jumps over the lazy dog and keeps running');
});

test('wrap preserves explicit newlines and indents continuation lines', () => {
  const lines = wrap('a\nb', 40, { indent: '  ' });
  assert.deepEqual(lines, ['  a', '  b']);
});

test('wrap hard-splits tokens wider than the line', () => {
  const long = 'x'.repeat(45);
  const lines = wrap(long, 10);
  assert.ok(lines.length >= 4);
  assert.ok(lines.every((l) => l.length <= 10));
});

test('wrapCapped collapses the tail with a count', () => {
  const { lines, hidden } = wrapCapped('1 2 3 4 5 6 7 8 9 10 11 12'.split(' ').join('\n'), 10, 3);
  assert.equal(lines.length, 4);
  assert.match(lines[3], /\+9 lines/);
  assert.equal(hidden, 9);
});

test('formatters', () => {
  assert.equal(fmtDuration(4200), '4s');
  assert.equal(fmtDuration(75_000), '1m 15s');
  assert.equal(fmtTokens(999), '999');
  assert.equal(fmtTokens(12_400), '12k');
  assert.equal(fmtTokens(1_500_000), '1.5M');
  assert.equal(fmtMoney(0.42), '$0.42');
  assert.equal(fmtMoney(0.0032), '$0.0032');
  assert.equal(homePath('/home/user/code/pocketmix'), '~/code/pocketmix');
});
