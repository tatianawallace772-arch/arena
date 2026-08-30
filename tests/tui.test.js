import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, disposeAll, settle } from './helpers/harness.js';

after(disposeAll);
import { stripAnsi } from '../src/ansi/text.js';

const rows = (frame) => frame.split('\n');

/** Every painted row must fit the terminal width, or xterm wraps and smears the boxes. */
function assertFits(frame, cols) {
  for (const [i, line] of rows(frame).entries()) {
    assert.ok(line.length <= cols, `row ${i} overflows (${line.length}): ${JSON.stringify(line)}`);
  }
}

async function started(opts = {}) {
  const h = createHarness(opts);
  h.keys('claude');
  h.press('\r');
  await h.sleep(400);
  await settle(h.app);
  h.app.paint();
  return h;
}

const chrome = (h, n = 5) => rows(h.frame()).slice(-n).join('\n');

test('the shell greets first and only launches claude on request', async () => {
  const h = createHarness();
  h.app.paint();
  assert.match(h.frame(), /pocketmix/);
  assert.doesNotMatch(h.frame(), /Claude Code v/);
  h.keys('echo $SHELL');
  h.press('\r');
  h.app.paint();
  assert.match(h.frame(), /% echo \$SHELL\n\/bin\/zsh/);
  assert.doesNotMatch(h.frame(), /╭─+╮/);
  h.app.dispose();
});

test('boot renders the header, welcome and an input box aligned to the width', async () => {
  const h = await started();
  const frame = h.frame();
  assertFits(frame, 104);
  assert.match(frame, /Claude Code v2\.0\.76/);
  assert.match(frame, /Opus 4\.1/);
  assert.match(frame, /╭─+/);
  assert.match(frame, /╰─+/);
  assert.match(frame, /for shortcuts/);
  assert.equal(rows(frame).length, 34, 'the viewport is exactly `rows` tall');
  h.app.dispose();
});

test('a prompt streams an answer and the tool lines land in the transcript', async () => {
  const h = await started();
  h.keys('fix the failing tests and run them');
  h.app.paint();
  assert.match(h.frame(), /fix the failing tests/, 'the prompt is echoed as typed');
  h.press('\r');
  await settle(h.app, { answer: '2' });
  h.app.paint();
  assertFits(h.frame(), 104);
  const all = h.app.fullTranscriptPlain();
  assert.match(all, /● Read\(src\/util\/sort\.js\)/);
  assert.match(all, /● Bash\(npm test\)/);
  assert.match(all, /⎿/);
  assert.match(all, /Green: 7 tests/);
  assert.match(h.frame(), /✻ \w+ for \d+s/, 'the turn closes with a spinner line');
  h.app.dispose();
});

test('the permission prompt paints its options in the chrome and 3 denies', async () => {
  const h = await started();
  const shots = [];
  h.keys('fix the failing tests and run them');
  h.press('\r');
  await settle(h.app, {
    onDialog: (dlg, app) => {
      if (dlg.type !== 'permission') {
        app.handleData('\r');
        return;
      }
      if (!shots.length) {
        app.paint();
        shots.push({ frame: app.screen.toText(), options: dlg.block.options.map((o) => o.label) });
      }
      app.handleData('3');
    },
  });
  h.app.paint();
  assert.ok(shots.length, 'a permission dialog was shown by the TUI');
  const [shot] = shots;
  assert.match(shot.options[0], /Yes/);
  assert.match(shot.options.at(-1), /No/);
  assert.match(shot.frame, /❯ 1\./);
  assert.match(shot.frame, /shift\+tab/);
  assertFits(shot.frame, 104);
  assert.ok(h.app.state.blocks.some((b) => b.kind === 'tool' && b.status === 'denied'));
  h.app.dispose();
});

test('shift+tab cycles manual → accept edits → plan → auto and the footer follows', async () => {
  const h = await started();
  assert.equal(h.app.state.mode, 'manual');
  h.press('\x1b[Z');
  assert.equal(h.app.state.mode, 'acceptEdits');
  h.app.paint();
  assert.match(chrome(h, 2), /accept edits on/);
  h.press('\x1b[Z');
  assert.equal(h.app.state.mode, 'plan');
  h.press('\x1b[Z');
  assert.equal(h.app.state.mode, 'auto');
  h.press('\x1b[Z');
  assert.equal(h.app.state.mode, 'manual', 'the cycle wraps');
  h.app.dispose();
});

test('/model opens a picker and selecting a row changes the model', async () => {
  const h = await started();
  h.keys('/model');
  h.app.paint();
  assert.match(h.frame(), /\/model/, 'the popup offers the command');
  h.press('\r');
  await h.sleep(30);
  assert.equal(h.app.state.dialog?.type, 'list', 'the model picker is open');
  h.app.paint();
  assert.match(h.frame(), /Opus 4\.1/);
  const before = h.app.state.model.name;
  h.press('\x1b[B');
  h.press('\r');
  await settle(h.app);
  assert.equal(h.app.state.dialog, null, 'picked and closed');
  assert.notEqual(h.app.state.model.name, before);
  h.app.paint();
  assert.ok(h.app.state.model.name.length > 3);
  h.app.dispose();
});

test('/help lists the shortcuts and Esc closes it', async () => {
  const h = await started();
  h.keys('/help');
  h.press('\r');
  await h.sleep(30);
  assert.equal(h.app.state.dialog?.type, 'help');
  h.app.paint();
  assert.match(h.frame(), /\/compact\s+summarise/);
  h.press('\x1b');
  assert.equal(h.app.state.dialog, null);
  // the shortcut sheet lives behind a bare ? at an empty prompt
  h.press('?');
  await h.sleep(20);
  h.app.paint();
  assert.match(h.frame(), /ctrl\+o/);
  assert.match(h.frame(), /shift\+tab/);
  h.press('\x1b');
  assert.equal(h.app.state.dialog, null);
  h.app.dispose();
});

test('panel commands draw bordered panels and close on Enter', async () => {
  const h = await started();
  const titles = [];
  for (const cmd of ['/context', '/cost', '/doctor']) {
    await h.app.runExternal(cmd);
    await h.sleep(30);
    assert.equal(h.app.state.dialog?.type, 'panel', `${cmd} opened a panel`);
    h.app.paint();
    const frame = h.frame();
    assertFits(frame, 104);
    const box = rows(frame).filter((l) => l.includes('│'));
    assert.ok(box.length >= 3, `${cmd} drew a bordered panel`);
    titles.push(frame);
    h.press('\r');
    await settle(h.app);
    assert.equal(h.app.state.dialog, null, `${cmd} closed on Enter`);
  }
  assert.match(titles[0], /Context usage/);
  assert.match(titles[1], /ost/);
  h.app.dispose();
});

test('autocomplete accepts with tab and Esc dismisses the popup', async () => {
  const h = await started();
  h.keys('/com');
  assert.ok(h.app.autocomplete, 'popup is live');
  h.press('\t');
  assert.match(h.app.state.input.text, /^\/compact/);
  assert.equal(h.app.autocomplete, null, 'popup cleared after accepting');
  h.keys('/co');
  h.press('\x1b');
  assert.equal(h.app.autocomplete, null, 'popup hidden on Esc');
  assert.match(h.app.state.input.text, /\/co$/, 'the typed text survives');
  h.app.dispose();
});

test('@ mentions complete to a repo file', async () => {
  const h = await started();
  h.keys('look at @src/util/so');
  assert.ok(h.app.autocomplete?.kind === 'file', 'file popup is live');
  h.press('\t');
  assert.match(h.app.state.input.text, /@src\/util\/sort\.js /);
  h.app.dispose();
});

test('history navigation keeps an unsent draft', async () => {
  const h = await started();
  await h.app.runExternal('first prompt');
  await settle(h.app, { answer: '2' });
  h.keys('draft');
  h.press('\x1b[A');
  assert.equal(h.app.state.input.text, 'first prompt', 'history came up');
  assert.equal(h.app.state.input.draft, 'draft', 'the unsent draft was kept');
  h.press('\x1b[B');
  assert.equal(h.app.state.input.text, 'draft', 'back down restores the draft');
  h.app.dispose();
});

test('ctrl+r searches the prompt history and loads a hit into the input', async () => {
  const h = await started();
  await h.app.runExternal('why are the tests failing');
  await settle(h.app, { answer: '2' });
  await h.app.runExternal('explain the store');
  await settle(h.app);
  h.press('\x12');
  await h.sleep(30);
  assert.equal(h.app.state.dialog?.type, 'list');
  assert.match(h.app.state.dialog.title, /Search prompt history/);
  h.press('exp');
  assert.deepEqual((h.app.state.dialog.filtered ?? []).map((i) => i.label), ['explain the store']);
  h.app.paint();
  assertFits(h.frame(), 104);
  h.press('\r');
  await h.sleep(30);
  assert.equal(h.app.state.input.text, 'explain the store', 'loaded, not run');
  assert.equal(h.app.state.dialog, null);
  h.app.dispose();
});

test('ctrl+o toggles verbose and ctrl+t hides the task panel', async () => {
  const h = await started();
  await h.app.runExternal('fix the failing tests and run them');
  await settle(h.app, { answer: '2' });
  const withTodos = h.app.fullTranscriptPlain();
  h.press('\x14');
  h.app.paint();
  assert.equal(h.app.state.todosHidden, true);
  assert.doesNotMatch(h.frame(), /Tasks \d\/\d/);
  h.press('\x14');
  h.app.paint();
  assert.match(h.frame(), /Tasks \d\/\d/);
  h.press('\x0f');
  assert.equal(h.app.state.verbose, true);
  h.app.paint();
  assertFits(h.frame(), 104);
  assert.ok(h.app.fullTranscriptPlain().length >= withTodos.length, 'verbose keeps everything');
  h.app.dispose();
});

test('a resize mid-turn repaints a coherent screen', async () => {
  const h = createHarness({ cols: 104, rows: 34, speed: 1 });
  h.keys('claude');
  h.press('\r');
  await h.sleep(300);
  await settle(h.app);
  h.keys('fix the failing tests and run them');
  h.press('\r');
  await h.sleep(60);
  h.app.size = () => ({ rows: 40, cols: 72 });
  h.app.resize();
  h.app.paint();
  assertFits(h.frame(), 72);
  await settle(h.app, { answer: '2' });
  h.app.paint();
  assertFits(h.frame(), 72);
  assert.equal(rows(h.frame()).length, 40);
  h.app.dispose();
});

test('dumpTranscript writes the whole session into scrollback', async () => {
  const h = await started();
  await h.app.runExternal('what does this repo do');
  await settle(h.app);
  h.writes.length = 0;
  h.app.dumpTranscript();
  const dumped = stripAnsi(h.writes.join(''));
  assert.ok(dumped.length > 500, `dumped ${dumped.length} chars`);
  assert.match(dumped, /what does this repo do/);
  assert.match(dumped, /╭|─/);
  h.app.dispose();
});

test('export produces markdown and an asciinema cast payload', async () => {
  const payloads = [];
  const h = await started({ onExport: (p) => payloads.push(p) });
  await h.app.runExternal('/export md');
  assert.match(payloads.at(-1).name, /\.md$/);
  assert.match(payloads.at(-1).text, /# Claude Code session/);
  assert.equal(payloads.at(-1).mime, 'text/markdown');
  await h.app.runExternal('/export cast');
  assert.match(payloads.at(-1).name, /\.cast$/);
  const lines = payloads.at(-1).text.trim().split('\n');
  assert.match(lines[0], /"version":2/);
  assert.ok(lines.length > 1, 'events follow the header');
  h.app.dispose();
});

test('copyTranscript returns plain and ANSI variants, and reports the clipboard', async () => {
  const h = await started();
  await h.app.runExternal('hello');
  await settle(h.app);
  const plain = h.app.copyTranscript(false);
  assert.equal(typeof plain, 'string');
  assert.ok(!plain.includes('\x1b'), 'plain copy is clean');
  const ansi = h.app.copyTranscript(true);
  assert.ok(ansi.length > plain.length, 'ansi carries escape codes');
  h.app.paint();
  assert.match(h.frame(), /clipboard|select the text/i);
  h.app.dispose();
});

test('double Esc opens the rewind picker and restoring rolls the repo back', async () => {
  const h = await started();
  await h.app.runExternal('add keyset pagination to /api/mixtapes');
  await settle(h.app, { onDialog: (dlg, app) => app.handleData('1') });
  assert.ok(h.app.vfs.dirty.size > 0, 'the scenario wrote files');
  h.press('\x1b');
  h.press('\x1b');
  await h.sleep(40);
  assert.equal(h.app.state.dialog?.type, 'list');
  assert.match(h.app.state.dialog.title, /Rewind/);
  h.press('\r');
  await h.sleep(40);
  assert.equal(h.app.vfs.dirty.size, 0, 'the working tree is back to HEAD');
  assert.match(h.app.state.blocks.at(-1).text, /Rewound/);
  h.app.paint();
  assertFits(h.frame(), 104);
  h.app.dispose();
});

test('/clear wipes the transcript but the session keeps working', async () => {
  const h = await started();
  await h.app.runExternal('hello');
  await settle(h.app);
  await h.app.runExternal('/clear');
  await h.sleep(40);
  h.app.paint();
  assert.doesNotMatch(h.frame(), /hello/);
  assert.match(h.frame(), /Context cleared/);
  await h.app.runExternal('still works');
  await settle(h.app);
  h.app.paint();
  assert.match(h.app.fullTranscriptPlain(), /still works/, 'the new turn is in the transcript');
  assert.doesNotMatch(h.app.fullTranscriptPlain(), /hello/);
  h.app.dispose();
});

test('/exit hands back to the shell and leaves the transcript behind', async () => {
  const h = await started();
  await h.app.runExternal('hello');
  await settle(h.app);
  h.writes.length = 0;
  h.keys('/exit');
  h.press('\r');
  await h.sleep(80);
  assert.equal(h.app.phase, 'shell');
  assert.ok(stripAnsi(h.writes.join('')).includes('hello'), 'the session was printed to scrollback');
  h.app.paint();
  assert.match(h.frame(), /~/);
  h.app.dispose();
});

test('vim bindings: Esc to NORMAL, hjkl moves, i back to insert', async () => {
  const h = await started();
  await h.app.runExternal('/vim');
  assert.equal(h.app.state.vim, true);
  h.keys('hello world');
  h.press('\x1b');
  assert.equal(h.app.state.vimMode, 'normal', 'Esc dropped to NORMAL');
  assert.equal(h.app.state.input.caret, 10, 'NORMAL sits on the last character');
  h.press('h');
  h.press('h');
  assert.equal(h.app.state.input.caret, 8);
  h.press('0');
  assert.equal(h.app.state.input.caret, 0);
  h.press('$');
  assert.equal(h.app.state.input.caret, 10);
  h.press('i');
  assert.equal(h.app.state.vimMode, 'insert');
  h.press('!');
  assert.equal(h.app.state.input.text, 'hello worl!d', 'insert mode types at the caret');
  h.app.dispose();
});

test('the footer keeps the model, branch and ctx meter on one line', async () => {
  const h = await started();
  h.app.setTheme('light');
  h.app.paint();
  const footer = rows(h.frame()).at(-1);
  assertFits(h.frame(), 104);
  assert.match(footer, /ctx\s+[░▓]+\s+\d+%/);
  assert.match(footer, /main/);
  assert.match(footer, /Opus 4\.1/);
  h.app.dispose();
});
