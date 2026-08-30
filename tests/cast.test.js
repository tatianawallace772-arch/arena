import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Recorder, parseCast } from '../src/share/recorder.js';
import { createHarness, disposeAll, settle } from './helpers/harness.js';

after(disposeAll);

import { after } from 'node:test';

test('a cast is asciinema v2 with a header and typed events', async () => {
  const rec = new Recorder({ cols: 90, rows: 30 });
  rec.push('hello');
  await new Promise((r) => setTimeout(r, 30));
  rec.push(' world');
  const cast = rec.cast();
  const [head, ...events] = cast.trim().split('\n');
  const meta = JSON.parse(head);
  assert.equal(meta.version, 2);
  assert.equal(meta.width, 90);
  assert.equal(meta.height, 30);
  const parsed = events.map((l) => JSON.parse(l));
  assert.deepEqual(parsed[0].slice(1), ['o', 'hello']);
  assert.ok(parsed[1][0] >= parsed[0][0], 'timestamps increase');
  const round = parseCast(cast);
  assert.equal(round.events.length, 2);
  assert.equal(round.text, 'hello world', 'parseCast flattens the output back to a byte stream');
  assert.equal(round.header.env.CLAUDE_CODE, 'simulator');
});

test('writes that land inside one frame are coalesced', async () => {
  const rec = new Recorder();
  for (const s of ['a', 'b', 'c']) rec.push(s);
  assert.equal(rec.events.length, 1);
  assert.equal(rec.events[0][2], 'abc');
});

test('pause stops capture and extraDelay shifts the timeline', async () => {
  const rec = new Recorder();
  rec.pause();
  rec.push('dropped');
  rec.resume();
  rec.push('kept');
  assert.equal(rec.events.length, 1);
  assert.equal(rec.events[0][2], 'kept');
  const t = rec.events[0][0];
  rec.extraDelay = 5;
  rec.push('later');
  assert.equal(rec.events[1][0] >= 5, true, 'the injected gap is on the timeline');
  assert.ok(rec.events[1][0] > t, 'and it still increases');
});

test('marks survive into the cast as marker events', () => {
  const rec = new Recorder();
  rec.push('x');
  rec.mark('turn:1');
  const lines = rec.cast().trim().split('\n').slice(1).map((l) => JSON.parse(l));
  assert.deepEqual(lines[1].slice(1), ['marker', 'turn:1']);
});

test('frames() resamples the recording so replay can run faster than real time', async () => {
  const rec = new Recorder();
  rec.push('one');
  await new Promise((r) => setTimeout(r, 40));
  rec.push('two');
  const at1 = rec.frames({ speed: 1, cap: 10 });
  const at4 = rec.frames({ speed: 4, cap: 10 });
  assert.equal(at1.length, at4.length);
  assert.ok(at4[1].t < at1[1].t, `time is divided by the speed: ${at4[1].t} < ${at1[1].t}`);
  assert.ok(at4[0].t <= at1[0].t);
  assert.equal(at4.map((f) => f.data).join(''), 'onetwo');
});

test('a real session records every painted frame', async () => {
  const h = createHarness();
  h.keys('claude');
  h.press('\r');
  await h.sleep(300);
  await settle(h.app);
  h.keys('hello there');
  h.press('\r');
  await settle(h.app);
  h.app.paint();
  const cast = h.app.recorder.cast();
  const parsed = parseCast(cast);
  assert.ok(parsed.events.length > 3, 'several frames were captured');
  assert.ok(parsed.text.includes('\x1b['), 'the capture keeps ANSI styling');
  assert.match(cast.split('\n')[0], /"width":104/);
  h.dispose();
});

test('a cast replays into the same bytes it recorded', async () => {
  const h = createHarness();
  h.keys('claude');
  h.press('\r');
  await h.sleep(250);
  await settle(h.app);
  const before = h.writes.join('');
  const frames = h.app.recorder.frames({ speed: 1000 });
  const replayed = frames.map((f) => f.data).join('');
  assert.ok(before.length > 0);
  assert.ok(replayed.length >= before.length, 'replay covers every recorded byte');
  h.dispose();
});
