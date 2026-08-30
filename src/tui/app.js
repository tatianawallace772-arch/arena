/**
 * App: the interactive layer. Owns key routing, the prompt input, slash commands,
 * dialogs, scrollback, vim mode, and paints state into a Screen that is diffed to ANSI.
 *
 * Layout (bottom-anchored chrome, transcript scrolls above it):
 *
 *   ┌ transcript (blocks, tail-scrolled) ┐
 *   │  permission dialog / live tail      │
 *   ├ todo panel (when tasks exist)        │
 *   ├ autocomplete popup (when triggered)  │
 *   ├ status line (when working)           │
 *   ├ ╭ prompt box ╮                       │
 *   └ footer (modes · ctx · model · cost)  ─┘
 */
import { Screen, CLEAR_SCREEN } from '../ansi/screen.js';
import { fit, fmtDuration, fmtTokens, strWidth, wrap } from '../ansi/text.js';
import { themeByName, THEME_ORDER, THEMES } from '../ansi/theme.js';
import * as R from './render.js';
import { Agent, MODEL_CATALOG, MODES, defaultState } from '../app/agent.js';
import { createVfs, listFiles } from '../app/vfs.js';
import { isReadOnlyCommand, approvalKey } from '../app/agent.js';
import { runShell } from '../app/tools.js';
import { Recorder } from '../share/recorder.js';
import { CLAUDE_MD } from '../app/init-template.js';

const SPARKLE_WORDS = R.HELLO;
const PLACEHOLDER = 'Try "why are the tests failing?"';
const VERSION = 'v2.0.76';

export class App {
  /**
   * @param {{write:(s:string)=>void, size:()=>({rows:number,cols:number}), state?:object,
   *          vfs?:object, recorder?:object, themeName?:string, speed?:number,
   *          sessions?:{list:Function,save:Function}}} opts
   */
  constructor(opts = {}) {
    this.write = opts.write ?? (() => {});
    this.size = opts.size ?? (() => ({ rows: 24, cols: 80 }));
    // A recorder is always live, so /export cast and replay work without a host.
    this.recorder = opts.recorder ?? new Recorder({ ...snapshotSize(this.size), title: 'Claude Code (simulator)' });
    this.sessions = opts.sessions ?? null;
    this.speed = opts.speed && opts.speed > 0 ? opts.speed : 1;
    this.vfs = opts.vfs ?? createVfs();
    this.state = opts.state ?? defaultState(opts.themeName ?? 'dark');
    if (opts.themeName) this.state.themeName = opts.themeName;
    this.theme = themeByName(this.state.themeName);
    this.screen = new Screen(24, 80);
    this.prevSnapshot = null;
    this.cache = new Map();
    this.dirty = false;
    this.tick = 0;
    this.timer = null;
    this.phase = 'shell';
    this.shell = { text: '', caret: 0, lines: [], history: [], histIdx: -1 };
    this.autocomplete = null;
    this.checkpoints = [];
    this.api = opts.api ?? null;
    this.onTheme = opts.onTheme;
    this.onExport = opts.onExport;
    this.onModeChange = opts.onModeChange ?? (() => {});
    this.onModelChange = opts.onModelChange ?? (() => {});
    this.onSessionEnd = opts.onSessionEnd ?? (() => {});
    this.agent = new Agent({
      vfs: this.vfs,
      state: this.state,
      sleep: (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms) / this.speed)),
      onUpdate: () => this.invalidate(),
      requestPermission: (tool) => this.askPermission(tool),
    });
    this.agent.streamSpeed = this.speed;
    this.agent.app = this;
  }

  // ------------------------------------------------------------------ plumbing

  invalidate() {
    this.dirty = true;
  }

  start() {
    this.resize();
    this.invalidate();
    this.raf();
    if (this.state.booted) {
      this.phase = 'idle';
      return;
    }
    this.renderShell();
  }

  raf() {
    const loop = () => {
      this.tick++;
      if (this.dirty) {
        this.dirty = false;
        this.paint();
      } else if (this.state.phase === 'working' || this.state.dialog || this.autocomplete) {
        this.paint();
      }
      this.timer = setTimeout(loop, this.state.phase === 'working' ? 33 : 80);
    };
    loop();
  }

  dispose() {
    clearTimeout(this.timer);
  }

  resize() {
    const { rows, cols } = this.size();
    const changed = this.screen.resize(rows, Math.max(20, cols));
    if (changed) {
      this.prevSnapshot = null;
      this.cache.clear();
      this.invalidate();
    }
  }

  setTheme(name) {
    this.state.themeName = name;
    this.theme = themeByName(name);
    this.cache.clear();
    this.prevSnapshot = null;
    this.invalidate();
    return this.theme.xtermTheme();
  }

  // ------------------------------------------------------------------ shell boot

  get shellPrompt() {
    return 'user@ringbook ~/code/pocketmix %';
  }

  renderShell() {
    const { rows, cols } = this.size();
    if (this.screen.resize(rows, Math.max(20, cols))) {
      this.prevSnapshot = null;
    }
    const W = this.screen.cols;
    const theme = this.theme;
    const s = this.shell;
    this.screen.clear();
    let y = 0;
    const line = (txt, style) => {
      if (y < this.screen.rows) this.screen.text(0, y, R.fit(txt, W), style);
      y++;
    };
    line('Linux arena 6.8.0 · zsh 5.9 · node v22.16.0 · term: xterm-256color', theme.style('faint'));
    line('this is a browser *simulation* of Claude Code — nothing you type leaves this tab', theme.style('faint'));
    line('', theme.style('faint'));
    for (const echo of (s.lines ?? []).slice(-Math.max(0, this.screen.rows - 8))) {
      line(echo.text, echo.tone === 'red' ? theme.style('red') : echo.tone === 'plain' ? {} : theme.style('dim'));
    }
    if (s.lines?.length) line('', theme.style('faint'));
    const promptPrefix = this.shellPrompt;
    line(promptPrefix + s.text, {});
    this._shellCursorRow = y - 1;
    this._shellCursorCol = promptPrefix.length + s.caret;
    if (y + 1 < this.screen.rows) {
      line('', theme.style('faint'));
      line('claude                 start a session here', theme.style('dim'));
      line('claude "why are the tests failing?"  start and go', theme.style('dim'));
      line('demo                   run a scripted session end to end', theme.style('dim'));
      line('ls · git status · cat src/routes.js   the real (virtual) files', theme.style('dim'));
    }
    const fresh = this.prevSnapshot === null;
    const { ansi, snapshot } = this.screen.diff(this.prevSnapshot);
    this.prevSnapshot = snapshot;
    const cursor = this._shellCursorRow >= 0 ? `\x1b[${this._shellCursorRow + 1};${Math.min(W, this._shellCursorCol + 1)}H` : '';
    const payload = `\x1b[?25h${fresh ? CLEAR_SCREEN : ''}${ansi}${cursor}`;
    this.write(payload);
    this.recorder?.push(payload);
  }

  handleShellKey(data) {
    const s = this.shell;
    if (data === '\r') {
      const cmd = s.text.trim();
      s.history.unshift(cmd);
      s.histIdx = -1;
      // the command stays on screen the way a real prompt keeps it
      s.lines = (s.lines ?? []).concat({ text: this.shellPrompt + ' ' + s.text, tone: 'plain' });
      s.text = '';
      s.caret = 0;
      if (!cmd) return this.invalidate();
      if (/^(claude|cc|claude\s+.*)$/.test(cmd)) {
        if (cmd.startsWith('claude ')) this.launch(cmd.slice(7).trim());
        else this.launch('');
        return;
      }
      if (cmd === 'demo' || cmd === './demo') return this.launch('why are the tests failing? fix it', { autoplay: true });
      const out = runShell(this.vfs, cmd);
      this.shellEcho(out.error ?? (out.stdout || '(no output)'), out.error ? 'red' : 'dim');
      return this.invalidate();
    }
    if (data === '\x7f' || data === '\b') {
      if (s.caret > 0) {
        s.text = s.text.slice(0, s.caret - 1) + s.text.slice(s.caret);
        s.caret--;
      }
      return this.invalidate();
    }
    if (data === '\x1b[A') {
      s.histIdx = Math.min(s.history.length - 1, s.histIdx + 1);
      s.text = s.history[s.histIdx] ?? '';
      s.caret = s.text.length;
      return this.invalidate();
    }
    if (data === '\x1b[B') {
      s.histIdx = Math.max(-1, s.histIdx - 1);
      s.text = s.histIdx < 0 ? '' : s.history[s.histIdx];
      s.caret = s.text.length;
      return this.invalidate();
    }
    if (data === '\x03') {
      s.text = '';
      s.caret = 0;
      return this.invalidate();
    }
    if (data === '\x15') {
      s.text = s.text.slice(0, s.caret).replace(/\s*\S*\s*$/, '');
      s.caret = s.text.length;
      return this.invalidate();
    }
    if (data === '\x0c') return this.invalidate();
    if (data === '\t' && 'claude'.startsWith(s.text) && s.text) {
      s.text = 'claude';
      s.caret = 6;
      return this.invalidate();
    }
    if (data === '\x1b[C') {
      s.caret = Math.min(s.text.length, s.caret + 1);
      return this.invalidate();
    }
    if (data === '\x1b[D') {
      s.caret = Math.max(0, s.caret - 1);
      return this.invalidate();
    }
    if (data >= ' ') {
      const clean = data.replace(/\x1b\[\?2004[h]?/g, '').replace(/\r/g, '');
      for (const ch of clean) {
        if (ch === '\n') continue;
        s.text = s.text.slice(0, s.caret) + ch + s.text.slice(s.caret);
        s.caret++;
      }
      this.invalidate();
    }
  }

  shellEcho(text, tone) {
    this.shell.lines = (this.shell.lines ?? []).concat(
      String(text)
        .split('\n')
        .slice(0, 200)
        .map((t) => ({ text: t, tone })),
    );
  }

  async launch(prefill) {
    this.phase = 'boot';
    this.state.booted = true;
    this.invalidate();
    await new Promise((r) => setTimeout(r, 240));
    this.state.blocks.push({
      id: this.state.nextBlockId++,
      kind: 'header',
      ts: Date.now(),
    });
    this.state.blocks.push({
      id: this.state.nextBlockId++,
      kind: 'welcome',
      ts: Date.now(),
      tips: [
        'Ask Claude to explain or change your code — it reads, edits and tests this repo',
        'Type / for every command · ? for the shortcut sheet',
        'Shift+Tab cycles permission modes: manual → accept edits → plan → auto',
        'Ctrl+O expands tool output and thinking · Esc Esc rewinds to a checkpoint',
      ],
      extra: [
        `Claude Code ${VERSION} · model ${this.state.model.name} · ${this.state.subscription}`,
        'simulator: the working tree, git state and test runner are all real-but-virtual',
      ],
    });
    this.state.hint = { text: '✻ ' + SPARKLE_WORDS[Math.floor(Math.random() * SPARKLE_WORDS.length)], at: Date.now() };
    this.phase = 'idle';
    this.invalidate();
    if (prefill) {
      await new Promise((r) => setTimeout(r, 320));
      await this.typeIn(prefill);
      this.submit();
    }
  }

  /** Simulate keystrokes so a demo visibly types itself. */
  async typeIn(text) {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      this.state.input.text = this.state.input.text.slice(0, this.state.input.caret) + ch + this.state.input.text.slice(this.state.input.caret);
      this.state.input.caret++;
      this.invalidate();
      await new Promise((r) => setTimeout(r, 18 + Math.random() * 26));
    }
  }

  // ------------------------------------------------------------------ input

  handleData(data) {
    if (this.phase === 'shell') return this.handleShellKey(data);
    const st = this.state;
    if (st.dialog) return this.handleDialogKey(data);
    if (this.autocomplete && this.handleAutocompleteKey(data)) return;

    // global keys
    switch (data) {
      case '\x1b':
        if (st.phase === 'working') {
          this.agent.interrupt();
          return;
        }
        if (st.vim && st.vimMode === 'insert') {
          st.vimMode = 'normal';
          st.input.caret = Math.max(0, st.input.caret - 1);
          return this.invalidate();
        }
        if (this.doubleEsc(Date.now())) return this.openRewind();
        return;
      case '\x03': // ctrl+c
        if (st.phase === 'working') {
          this.agent.interrupt();
          return;
        }
        if (st.input.text) {
          st.input.text = '';
          st.input.caret = 0;
          return this.invalidate();
        }
        if (this.doubleCtrlC(Date.now())) return this.exit();
        this.pushSystem('Ctrl+C again to exit · esc to dismiss');
        return;
      case '\x04': // ctrl+d
        return this.exit();
      case '\x0c': // ctrl+l
        this.prevSnapshot = null;
        return this.invalidate();
      case '\x0f': // ctrl+o
        st.verbose = !st.verbose;
        this.cache.clear();
        return this.pushSystem(st.verbose ? 'Verbose transcript on · ctrl+o to collapse' : 'Verbose transcript off');
      case '\x12': // ctrl+r
        return this.openHistorySearch();
      case '\x14': // ctrl+t
        if (st.todos.length) {
          st.todosHidden = !st.todosHidden;
          return this.invalidate();
        }
        return this.pushSystem('No tasks for this session');
      case '\x1a': // ctrl+z
        return this.pushSystem('⚠ No process to suspend — this is a browser simulation');
      case '\x16': // ctrl+v → paste image in real CC
        return this.pushSystem('⚠ Clipboard does not contain an image');
      case '\x1b[Z': // shift+tab
        return this.cycleMode();
      case '\x1b[200~':
        return;
      case '\x1b[5~': // pageup
        return this.scrollBy(-10);
      case '\x1b[6~': // pagedown
        return this.scrollBy(10);
      case '\x1b[H':
        return this.scrollTo(0);
      case '\x1b[F':
        return this.scrollTo(1e9);
      case '\r':
        return this.onEnter();
      case '\n':
        return this.insertText('\n');
      case '\x7f':
      case '\b':
        return this.backspace();
      case '\x1b[A':
        return this.historyPrev();
      case '\x1b[B':
        return this.historyNext();
      case '\x1b[D':
      case '\x02': // ctrl+b
        return this.moveCaret(-1);
      case '\x1b[C':
      case '\x06': // ctrl+f
        return this.moveCaret(1);
      case '\x01': // ctrl+a
        return this.caretToLineStart();
      case '\x05': // ctrl+e
        return this.caretToLineEnd();
      case '\x0b': // ctrl+k
        return this.killLine();
      case '\x15': // ctrl+u
        return this.killToStart();
      case '\x17': // ctrl+w
        return this.killWord();
      case '\x08': // ctrl+h
        return this.backspace();
      case '\x1b[3~': // delete
        return this.deleteForward();
    }
    // alt / word motions
    if (data.startsWith('\x1bb')) return this.wordLeft();
    if (data.startsWith('\x1bf')) return this.wordRight();
    if (data.startsWith('\x1b[1;5C')) return this.wordRight();
    if (data.startsWith('\x1b[1;5D')) return this.wordLeft();

    if (data === '?' && !st.input.text) return this.openHelp();
    if (data === '\t' && st.input.text.startsWith('/')) return this.completeSlash();

    if (st.vim && st.vimMode === 'normal') return this.vimKey(data);
    if (data >= ' ' || data === ' ') this.insertText(data);
  }

  doubleEsc(now) {
    const hit = this._lastEsc && now - this._lastEsc < 400;
    this._lastEsc = now;
    return hit;
  }

  doubleCtrlC(now) {
    const hit = this._lastCtrlC && now - this._lastCtrlC < 800;
    this._lastCtrlC = now;
    return hit;
  }

  insertText(data) {
    const st = this.state;
    const clean = data.replace(/\x1b\[\?2004[hl]/g, '');
    if (!clean) return;
    const { text, caret } = st.input;
    st.input.text = text.slice(0, caret) + clean + text.slice(caret);
    st.input.caret += clean.length;
    this.updateAutocomplete();
    this.invalidate();
  }

  backspace() {
    const { input } = this.state;
    if (input.caret === 0) return;
    input.text = input.text.slice(0, input.caret - 1) + input.text.slice(input.caret);
    input.caret--;
    this.updateAutocomplete();
    this.invalidate();
  }

  deleteForward() {
    const { input } = this.state;
    if (input.caret >= input.text.length) return;
    input.text = input.text.slice(0, input.caret) + input.text.slice(input.caret + 1);
    this.invalidate();
  }

  moveCaret(delta) {
    const { input } = this.state;
    input.caret = Math.max(0, Math.min(input.text.length, input.caret + delta));
    this.invalidate();
  }

  caretToLineStart() {
    const { input } = this.state;
    const nl = input.text.lastIndexOf('\n', input.caret - 1);
    input.caret = nl + 1;
    this.invalidate();
  }

  caretToLineEnd() {
    const { input } = this.state;
    const nl = input.text.indexOf('\n', input.caret);
    input.caret = nl === -1 ? input.text.length : nl;
    this.invalidate();
  }

  killLine() {
    const { input } = this.state;
    const nl = input.text.indexOf('\n', input.caret);
    this._kill = input.text.slice(input.caret, nl === -1 ? undefined : nl);
    input.text = input.text.slice(0, input.caret) + (nl === -1 ? '' : input.text.slice(nl));
    this.invalidate();
  }

  killToStart() {
    const { input } = this.state;
    this._kill = input.text.slice(0, input.caret);
    input.text = input.text.slice(input.caret);
    input.caret = 0;
    this.invalidate();
  }

  killWord() {
    const { input } = this.state;
    const before = input.text.slice(0, input.caret).replace(/\s*\S*\s*$/, '');
    this._kill = input.text.slice(before.length, input.caret);
    input.text = before + input.text.slice(input.caret);
    input.caret = before.length;
    this.invalidate();
  }

  wordLeft() {
    const { input } = this.state;
    let i = input.caret;
    while (i > 0 && /\s/.test(input.text[i - 1])) i--;
    while (i > 0 && /[\w$.]/.test(input.text[i - 1])) i--;
    input.caret = i;
    this.invalidate();
  }

  wordRight() {
    const { input } = this.state;
    let i = input.caret;
    while (i < input.text.length && /\s/.test(input.text[i])) i++;
    while (i < input.text.length && /[\w$.]/.test(input.text[i])) i++;
    input.caret = i;
    this.invalidate();
  }

  historyPrev() {
    const { input } = this.state;
    if (!input.history.length) return;
    if (input.histIdx === -1) {
      input.histIdx = 0;
      input.draft = input.text;
    } else input.histIdx = Math.min(input.history.length - 1, input.histIdx + 1);
    input.text = input.history[input.histIdx];
    input.caret = input.text.length;
    this.invalidate();
  }

  historyNext() {
    const { input } = this.state;
    if (input.histIdx <= 0) {
      input.histIdx = -1;
      input.text = input.draft ?? '';
      input.caret = input.text.length;
      return this.invalidate();
    }
    input.histIdx -= 1;
    input.text = input.history[input.histIdx];
    input.caret = input.text.length;
    this.invalidate();
  }

  onEnter() {
    const input = this.state.input;
    if (/\\\s*$/.test(input.text.slice(0, input.caret))) {
      const cut = input.text.slice(0, input.caret).replace(/\\\s*$/, '');
      input.text = cut + '\n' + input.text.slice(input.caret);
      input.caret = cut.length + 1;
      return this.invalidate();
    }
    const text = input.text.trim();
    if (!text) {
      this.pushSystem('Nothing to do — describe a change, or /help for commands');
      return;
    }
    if (text.startsWith('/')) return this.runCommand(text);
    if (text.startsWith('#')) return this.remember(text.slice(1).trim());
    if (this.state.mode === 'plan' && !/^(add|fix|write|update)/i.test(text)) {
      // plan mode still answers questions; mutate-ish asks get the plan flow
    }
    this.submit();
  }

  submit() {
    const { input } = this.state;
    const text = input.text.trim();
    if (!text) return;
    input.history.unshift(text);
    input.histIdx = -1;
    input.draft = '';
    input.text = '';
    input.caret = 0;
    this.autocomplete = null;
    this.checkpoint();
    this.state.scroll.follow = true;
    this.state.scroll.offset = 0;
    this.agent.submit(text);
    this.invalidate();
  }

  cycleMode() {
    const st = this.state;
    const idx = MODES.indexOf(st.mode);
    st.mode = MODES[(idx + 1) % MODES.length];
    this.onModeChange(st.mode);
    this.pushSystem(
      {
        manual: '⏵⏵ manual approve — every edit and non-read-only command asks first',
        acceptEdits: '⏵⏵ accept edits on — file edits auto-approved, commands still ask',
        plan: '⏸ plan mode on — read-only; changes are queued for approval',
        auto: '⚡ auto mode on — reads and workspace edits are approved silently',
      }[st.mode],
    );
    this.cache.clear();
  }

  /** Verb shown next to the spinner; changes per step like the real CLI. */
  setStatus(verb, { keep = false } = {}) {
    const st = this.state;
    if (keep && st.status) return;
    st.status = { verb, startedAt: st.status?.startedAt ?? Date.now() };
    this.invalidate();
  }

  pushSystem(text, tone = 'dim') {
    this.state.blocks.push({ id: this.state.nextBlockId++, kind: 'system', text, tone, ts: Date.now() });
    this.invalidate();
  }

  checkpoint() {
    this.checkpoints.push({
      label: this.state.input.history[0] ?? 'turn',
      blocks: this.state.blocks.length,
      files: JSON.parse(JSON.stringify(this.vfs.files)),
      originals: JSON.parse(JSON.stringify(this.vfs.originals)),
      dirty: new Set(this.vfs.dirty),
      customTests: new Map(this.vfs.customTests ?? []),
      usage: { ...this.state.usage },
      todos: this.state.todos.map((t) => ({ ...t })),
    });
    if (this.checkpoints.length > 25) this.checkpoints.shift();
  }

  rewindTo(idx) {
    const cp = this.checkpoints[idx];
    if (!cp) return;
    this.vfs.files = JSON.parse(JSON.stringify(cp.files));
    this.vfs.originals = JSON.parse(JSON.stringify(cp.originals));
    this.vfs.dirty = cp.dirty;
    this.vfs.customTests = cp.customTests;
    const dropped = this.state.blocks.length - cp.blocks;
    this.state.blocks.length = cp.blocks;
    this.state.usage = { ...cp.usage };
    this.state.todos = cp.todos;
    this.checkpoints.length = idx;
    this.cache.clear();
    this.prevSnapshot = null;
    this.pushSystem(`⎦ Rewound · ${dropped} block${dropped === 1 ? '' : 's'} dropped, working tree restored`);
  }

  // ------------------------------------------------------------------ autocomplete

  updateAutocomplete() {
    const { input } = this.state;
    const text = input.text;
    const before = text.slice(0, input.caret);
    if (text.startsWith('/')) {
      const frag = before.split(/\s/)[0].toLowerCase();
      const items = SLASH_COMMANDS.filter((c) => c.name.startsWith(frag.slice(1)) && (c.name !== frag.slice(1) || text.length !== before.length)).map((c) => ({
        label: '/' + c.name,
        meta: c.desc,
      }));
      this.autocomplete = items.length && items.length < 28 && before.includes(' ') === false ? { kind: 'slash', items, sel: 0 } : null;
      return;
    }
    const at = before.match(/(^|\s)@([\w./-]*)$/);
    if (at) {
      const frag = at[2];
      const files = listFiles(this.vfs).filter((f) => f.includes(frag)).slice(0, 8);
      this.autocomplete = files.length ? { kind: 'file', prefix: at[1], frag, items: files.map((f) => ({ label: '@' + f, meta: '' })), sel: 0 } : null;
      return;
    }
    this.autocomplete = null;
  }

  handleAutocompleteKey(data) {
    const ac = this.autocomplete;
    if (!ac) return false;
    if (data === '\x1b[A') {
      ac.sel = (ac.sel - 1 + ac.items.length) % ac.items.length;
      return true;
    }
    if (data === '\x1b[B') {
      ac.sel = (ac.sel + 1) % ac.items.length;
      return true;
    }
    if (data === '\x1b[Z') {
      ac.sel = (ac.sel - 1 + ac.items.length) % ac.items.length;
      return true;
    }
    // Tab accepts the selection, like the real CLI; Enter still submits what is typed.
    if (data === '\t' || data === '\x1b[9~' || data === '\x1b[C') {
      this.acceptAutocomplete();
      return true;
    }
    if (data === '\x1b') {
      this.autocomplete = null;
      return true;
    }
    return false;
  }

  acceptAutocomplete() {
    const ac = this.autocomplete;
    if (!ac) return;
    const chosen = ac.items[ac.sel]?.label ?? '';
    const { input } = this.state;
    if (ac.kind === 'slash') {
      input.text = chosen + ' ';
      input.caret = input.text.length;
    } else {
      const before = input.text.slice(0, input.caret).replace(/(^|\s)@[\w./-]*$/, `${ac.prefix}${chosen} `);
      input.text = before + input.text.slice(input.caret);
      input.caret = before.length;
    }
    this.autocomplete = null;
    this.invalidate();
  }

  completeSlash() {
    if (this.autocomplete) return this.acceptAutocomplete();
    const { input } = this.state;
    const frag = input.text.trim();
    const hit = SLASH_COMMANDS.find((c) => ('/' + c.name).startsWith(frag));
    if (hit) {
      input.text = '/' + hit.name + ' ';
      input.caret = input.text.length;
    }
    this.invalidate();
  }

  // ------------------------------------------------------------------ dialogs

  askPermission(tool) {
    const st = this.state;
    if (tool.planApproval) {
      return new Promise((resolve) => {
        st.dialog = {
          type: 'plan',
          tool,
          sel: 0,
          options: [
            { label: 'Yes, and manually approve edits', value: 'allow' },
            { label: 'Yes, auto-accept edits', value: 'allow-session' },
            { label: 'No, keep planning', value: 'cancel' },
          ],
          resolve,
        };
        st.phase = 'awaiting';
        this.invalidate();
      });
    }
    const isEdit = ['Edit', 'Write', 'MultiEdit'].includes(tool.name);
    const block = {
      id: st.nextBlockId++,
      kind: 'permission',
      tool,
      sel: 0,
      diffView: isEdit,
      ts: Date.now(),
      scope: 'this session only',
      options: isEdit
        ? [
            { label: 'Yes', value: 'allow' },
            { label: 'Yes, and allow all edits in this directory for this session', value: 'allow-session', hint: 'shift+tab' },
            { label: 'No', value: 'cancel' },
          ]
        : [
            { label: 'Yes, allow this execution', value: 'allow' },
            { label: `Yes, and don't ask again for ${approvalKey(tool.name, tool.args).replace(/^[^(]+\(|\)$/g, '')} commands in this project`, value: 'allow-session' },
            { label: 'No', value: 'cancel' },
          ],
    };
    // snapshot the diff the tool *would* produce, so the prompt can show it
    if (isEdit) {
      const path = tool.args.file_path;
      const prev = path in this.vfs.files ? this.vfs.files[path] : '';
      const next = tool.name === 'Write' ? tool.args.content : applyPreview(this.vfs, tool.args);
      block.tool = { ...tool, diff: { prev, next } };
    }
    return new Promise((resolve) => {
      st.dialog = { type: 'permission', block, resolve, tool };
      st.blocks.push(block);
      st.phase = 'awaiting';
      this.invalidate();
    });
  }

  handleDialogKey(data) {
    const st = this.state;
    const dlg = st.dialog;
    if (!dlg) return;
    if (data === '\x1b' || data === '\x03') {
      if (dlg.type === 'permission' || dlg.type === 'plan') return this.resolveDialog({ action: 'cancel', via: 'esc' });
      return this.closeDialog();
    }
    if (dlg.type === 'panel' || dlg.type === 'help') {
      if (dlg.onKey) return dlg.onKey(data, this);
      return this.closeDialog();
    }
    if (dlg.type === 'list') {
      const items = dlg.filtered ?? dlg.items;
      if (data === '\x1b[A' || data === '\x10') dlg.sel = Math.max(0, dlg.sel - 1);
      else if (data === '\x1b[B' || data === '\x0e') dlg.sel = Math.min(items.length - 1, dlg.sel + 1);
      else if (data === '\x7f' || data === '\b') {
        dlg.query = (dlg.query ?? '').slice(0, -1);
        this.filterDialog(dlg);
      } else if (data === '\r') {
        const item = items[dlg.sel];
        if (dlg.onPick) {
          this.closeDialog();
          return dlg.onPick(item, dlg);
        }
        if (dlg.pick) return dlg.pick(dlg.sel);
      } else if (data >= ' ') {
        dlg.query = (dlg.query ?? '') + data;
        this.filterDialog(dlg);
      }
      return this.invalidate();
    }
    const block = dlg.block;
    // plan approvals keep their options on the dialog, permission prompts on the block
    const opts = dlg.options ?? block?.options ?? [];
    if (!opts.length) return this.closeDialog();
    const selOf = () => (dlg.type === 'permission' ? block.sel : dlg.sel);
    const setSel = (v) => {
      if (dlg.type === 'permission') block.sel = v;
      else dlg.sel = v;
      this.invalidate();
    };
    if (data === '\x1b[A' || data === '\x10') setSel((selOf() - 1 + opts.length) % opts.length);
    else if (data === '\x1b[B' || data === '\x0e' || data === '\t' && dlg.type === 'plan') setSel((selOf() + 1) % opts.length);
    else if (data === '\t' || data === '\x1b[C') {
      if (dlg.type === 'permission') {
        block.diffView = !block.diffView;
        return this.invalidate();
      }
      setSel((selOf() + 1) % opts.length);
    } else if (data === '\r') this.resolveDialog({ action: opts[selOf()].value, via: 'enter' });
    else if (/^[1-9]$/.test(data)) {
      const idx = Number(data) - 1;
      if (opts[idx]) this.resolveDialog({ action: opts[idx].value, via: 'number' });
    }
  }

  filterDialog(dlg) {
    const all = dlg.allItems ?? dlg.items ?? [];
    dlg.filtered = all.filter((i) => !dlg.query || String(i.label).toLowerCase().includes(dlg.query.toLowerCase()));
    dlg.sel = 0;
    this.invalidate();
  }

  resolveDialog(decision) {
    const st = this.state;
    const dlg = st.dialog;
    if (!dlg) return;
    st.dialog = null;
    st.phase = this.agent.running ? 'working' : 'idle';
    if (dlg.type === 'permission') {
      // An approval needs no echo — the tool line right below it is the record.
      // A denial does, because the tool never runs and would otherwise look skipped.
      if (decision.action === 'cancel') {
        st.blocks.push({
          id: st.nextBlockId++,
          kind: 'system',
          tone: 'error',
          text: `✗ Denied · ${R.toolLabel(dlg.tool.name, dlg.tool.args)}`,
          ts: Date.now(),
        });
      }
      dlg.block.resolved = decision.action;
    }
    this.cache.clear();
    this.invalidate();
    dlg.resolve(decision);
  }

  openDialog(dlg) {
    const st = this.state;
    this.autocomplete = null;
    st.dialog = dlg;
    st.phase = 'awaiting';
    this.invalidate();
  }

  closeDialog() {
    const st = this.state;
    if (st.dialog) {
      const d = st.dialog;
      st.dialog = null;
      st.phase = 'idle';
      if (d.resolve) d.resolve({ action: 'cancel' });
      this.invalidate();
    }
  }

  openHelp() {
    this.openDialog({
      type: 'help',
      title: 'Keyboard shortcuts',
      rows: SHORTCUTS,
      foot: '? to close · any key to dismiss',
      onKey: (_d, app) => app.closeDialog(),
    });
  }

  /** Ctrl+R: readline-style reverse search over the prompts typed this session. */
  openHistorySearch() {
    const st = this.state;
    const hist = st.input.history ?? [];
    if (!hist.length) return this.pushSystem('Nothing in history yet');
    const items = hist.map((text, i) => ({ label: text, meta: i === 0 ? 'most recent' : `${hist.length - i} back` }));
    this.openPicker('Search prompt history', items, (item) => {
      const text = String(item?.label ?? '');
      st.input.text = text;
      st.input.caret = text.length;
      this.pushSystem('Loaded from history · Enter to run it again', 'ok');
      this.invalidate();
    }, 'type to filter · Enter to load · Esc to cancel');
  }


  openRewind() {
    if (!this.checkpoints.length) return this.pushSystem('Nothing to rewind to yet');
    const items = this.checkpoints
      .map((cp, i) => ({
        label: `${i + 1}. ${R.fit(String(cp.label ?? 'turn').replace(/\n/g, ' '), 44)}`,
        meta: `${cp.blocks} blocks · ${cp.dirty.size} dirty`,
        index: i,
      }))
      .reverse();
    this.openPicker('Rewind to checkpoint · restores transcript + working tree', items, (item) => item && this.rewindTo(item.index), 'Enter to rewind · Esc to cancel');
  }

  openPicker(title, items, onPick, meta) {
    this.openDialog({
      type: 'list',
      list: true,
      title,
      allItems: items,
      items,
      filtered: items,
      query: '',
      sel: Math.max(0, items.findIndex((i) => i.current)),
      onPick: (item) => item && onPick?.(item),
      foot: meta ?? '↑↓ to navigate · type to filter · Enter to select · Esc to cancel',
    });
  }

  // ------------------------------------------------------------------ commands

  async runCommand(raw) {
    const st = this.state;
    this.autocomplete = null;
    const [name, ...rest] = raw.slice(1).split(/\s+/);
    const arg = rest.join(' ');
    const cmd = SLASH_COMMANDS.find((c) => c.name === name);
    st.input.text = '';
    st.input.caret = 0;
    st.input.history.unshift(raw);
    // slash commands run silently: the real CLI does not echo them into the transcript
    void st;
    this.invalidate();
    if (!cmd) {
      const near = SLASH_COMMANDS.filter((c) => c.name.startsWith(name.slice(0, 2))).slice(0, 4);
      return this.pushSystem(`Unknown command /${name}${near.length ? ` · did you mean ${near.map((c) => '/' + c.name).join(', ')}?` : ''}`, 'warn');
    }
    const fn = this[cmd.run];
    if (typeof fn !== 'function') return this.pushSystem(`/${cmd.name} is listed but not wired in this build`, 'warn');
    return fn.call(this, arg, cmd);
  }

  async remember(text) {
    if (!text) return this.pushSystem('Usage: #<note> to save a memory to CLAUDE.md', 'warn');
    this.state.input.text = '';
    this.state.input.caret = 0;
    this.pushSystem(`Adding to memory: “${text}”`);
    await this.agent.submit(`Save this to CLAUDE.md: ${text}`);
  }

  cmd_help() {
    this.openDialog({
      type: 'help',
      title: `Claude Code ${VERSION} (simulator) — commands`,
      rows: SLASH_COMMANDS.map((c) => [`/${c.name}`, c.desc]),
      foot: 'any key to close',
      onKey: (_d, app) => app.closeDialog(),
    });
  }

  cmd_clear() {
    this.state.blocks = [];
    this.cache.clear();
    this.prevSnapshot = null;
    this.state.usage.input = 0;
    this.state.usage.output = 0;
    this.pushSystem('✻ Context cleared · a fresh session starts here', 'ok');
  }

  cmd_compact(arg) {
    const res = this.agent.compact();
    this.pushSystem(`∴ Compacted ${fmtTokens(res.before)} → ${fmtTokens(res.after)} tokens${arg ? ` (focus: ${arg})` : ''}`, 'ok');
  }

  cmd_context() {
    const st = this.state;
    const used = st.usage.input + st.usage.output;
    const total = st.model.context;
    const free = Math.max(0, total - used);
    const cats = [
      ['System prompt', 9200, '▓'],
      ['Tools', 16400, '▓'],
      ['MCP tools', 0, '░'],
      ['Custom commands', 120, '░'],
      ['Messages', st.usage.input, '▓'],
      ['Assistant output', st.usage.output, '▓'],
    ];
    const body = cats.map(([label, n, b]) => [
      R.R(label.padEnd(18), this.theme.style('dim')),
      R.R(`${(n / 1000).toFixed(1)}k `),
      R.R(b.repeat(Math.max(0, Math.min(30, Math.round((n / total) * 400)))), this.theme.style('faint')),
    ]);
    body.push([R.R('─'.repeat(46), this.theme.style('faint'))]);
    body.push([R.R('Context usage'.padEnd(18), this.theme.style('dim')), R.R(`${((used / total) * 100).toFixed(1)}% of ${fmtTokens(total)}`, this.theme.style('text'))]);
    body.push([R.R('Free'.padEnd(18), this.theme.style('dim')), R.R(fmtTokens(free), this.theme.style('green'))]);
    body.push([R.R('Autocompact at'.padEnd(18), this.theme.style('dim')), R.R(`${fmtTokens(Math.round(total * 0.92))} · ◐ ${Math.min(100, Math.round((used / (total * 0.92)) * 100))}% there`, this.theme.style('yellow'))]);
    this.pushPanel('Context usage', body, `model ${st.model.name} · ${fmtTokens(total)} window · /compact to free space now`);
  }

  cmd_cost() {
    const u = this.state.usage;
    const dur = fmtDuration(Date.now() - u.startedAt);
    const body = [
      [R.R('Total cost', this.theme.style('dim')), R.R(' '.repeat(10)), R.R(`$${u.cost.toFixed(4)}`, this.theme.style('text', { bold: true }))],
      [R.R('Total duration', this.theme.style('dim')), R.R(' '.repeat(6)), R.R(dur, this.theme.style('text'))],
      [R.R('Total code changes', this.theme.style('dim')), R.R(' '.repeat(3)), R.R(`+${u.linesAdded} / -${u.linesRemoved} lines`, this.theme.style('text'))],
      [R.R('Model', this.theme.style('dim')), R.R(' '.repeat(14)), R.R(`${this.state.model.name} · $${this.state.model.price.in}/$${this.state.model.price.out} per MTok`, this.theme.style('text'))],
      [R.R('Usage', this.theme.style('dim')), R.R(' '.repeat(15)), R.R(`${fmtTokens(u.input)} in · ${fmtTokens(u.output)} out · ${u.turns} turns · ${u.tools} tools`, this.theme.style('text'))],
      [R.R('Plan', this.theme.style('dim')), R.R(' '.repeat(17)), R.R(this.state.subscription, this.theme.style('green'))],
    ];
    this.pushPanel('Cost usage', body, 'rates approximate the real model pricing · costs are simulated');
  }

  cmd_model(arg) {
    if (arg) {
      const hit = MODEL_CATALOG.find((m) => m.id === arg || m.name.toLowerCase().includes(arg.toLowerCase()));
      if (hit) return this.setModel(hit);
      return this.pushSystem(`Unknown model "${arg}" · /model to pick from the list`, 'warn');
    }
    const items = MODEL_CATALOG.map((m) => ({
      label: m.name,
      meta: `${fmtTokens(m.context)} · ${m.speed}${m.id === this.state.model.id ? ' · current' : ''}`,
      model: m,
      current: m.id === this.state.model.id,
    }));
    this.openPicker('Select model', items, (item) => item.model && this.setModel(item.model), '↑↓ to choose · Enter to confirm · Esc to cancel');
  }

  setModel(model) {
    this.state.model = model;
    this.pushSystem(`Model set to ${model.name} · ${fmtTokens(model.context)} context`, 'ok');
  }

  cmd_theme(arg) {
    if (arg && THEMES[arg]) {
      const payload = this.setTheme(arg);
      this.onTheme?.(payload, arg);
      return this.pushSystem(`Theme set to ${arg}`, 'ok');
    }
    const items = THEME_ORDER.map((name) => ({ label: THEMES[name].label, meta: name === this.state.themeName ? 'current' : '', name, current: name === this.state.themeName }));
    this.openPicker('Theme', items, (item) => {
      if (!item) return;
      const payload = this.setTheme(item.name);
      this.onTheme?.(payload, item.name);
      this.pushSystem(`Theme set to ${item.name} · /theme to change`, 'ok');
    });
  }

  cmd_vim(arg) {
    if (arg === 'off') this.state.vim = false;
    else {
      this.state.vim = !this.state.vim;
      this.state.vimMode = 'insert';
    }
    this.pushSystem(this.state.vim ? 'Vim mode on · Esc for NORMAL, i to insert' : 'Vim mode off');
  }

  cmd_status() {
    const st = this.state;
    const body = [
      [R.R('Version', this.theme.style('dim')), R.R(' '.repeat(12)), R.R(`2.0.76 · simulator build 0.1.0`, this.theme.style('text'))],
      [R.R('Session', this.theme.style('dim')), R.R(' '.repeat(13)), R.R(st.session.id, this.theme.style('text'))],
      [R.R('Model', this.theme.style('dim')), R.R(' '.repeat(15)), R.R(st.model.name, this.theme.style('text'))],
      [R.R('Account', this.theme.style('dim')), R.R(' '.repeat(13)), R.R('user@ringbook · API Usage Billing', this.theme.style('text'))],
      [R.R('Directory', this.theme.style('dim')), R.R(' '.repeat(12)), R.R('~/code/pocketmix · main', this.theme.style('text'))],
      [R.R('Permission mode', this.theme.style('dim')), R.R(' '.repeat(4)), R.R(st.mode, st.mode === 'manual' ? this.theme.style('yellow') : this.theme.style('green'))],
      [R.R('Sandbox', this.theme.style('dim')), R.R(' '.repeat(13)), R.R('virtual fs · no network · no real exec', this.theme.style('text'))],
      [R.R('MCP servers', this.theme.style('dim')), R.R(' '.repeat(10)), R.R('github · connected · 27 tools', this.theme.style('text'))],
      [R.R('Memory', this.theme.style('dim')), R.R(' '.repeat(16)), R.R(`CLAUDE.md ${'CLAUDE.md' in this.vfs.files ? 'loaded' : 'not created'}`, this.theme.style('text'))],
    ];
    this.pushPanel('Status', body, 'esc or any key to close', (d, app) => app.closeDialog());
  }

  cmd_doctor() {
    const checks = [
      ['installation', 'local bin v2.0.76', 'ok'],
      ['updates', 'auto-update is on; latest is 2.0.76', 'ok'],
      ['config', '~/.claude/settings.json parses', 'ok'],
      ['project config', '.claude/settings.json not found (optional)', 'warn'],
      ['anthropic api key', 'not used — this build has no live backend', 'ok'],
      ['mcp · github', 'connected, 27 tools', 'ok'],
      ['sandbox', 'virtual fs, network egress blocked', 'ok'],
      ['ripgrep', 'bundled 14.1.1', 'ok'],
      ['node', 'v22.16.0 (>=20 required)', 'ok'],
      ['clipboard image paste', 'not available in this browser context', 'warn'],
    ];
    const body = checks.map(([name, detail, level]) => [
      R.R(level === 'ok' ? '✔ ' : '⚠ ', this.theme.style(level === 'ok' ? 'green' : 'yellow')),
      R.R(name.padEnd(22), this.theme.style('text')),
      R.R(detail, this.theme.style('dim')),
    ]);
    this.pushPanel('Doctor', body, 'all checks pass for the simulated environment');
  }

  async cmd_init() {
    this.pushSystem('Scanning the repo to write CLAUDE.md…');
    await new Promise((r) => setTimeout(r, 260));
    const res = await this.agent.runTool({
      name: 'Write',
      approval: 'ask',
      args: { file_path: 'CLAUDE.md', content: CLAUDE_MD },
    });
    if (res === 'ok') this.pushSystem('CLAUDE.md is now loaded into every session · edit it to steer me', 'ok');
  }

  cmd_config() {
    const st = this.state;
    const body = [
      [R.R('theme', this.theme.style('dim')), R.R(' '.repeat(12)), R.R(st.themeName, this.theme.style('text'))],
      [R.R('verbose', this.theme.style('dim')), R.R(' '.repeat(10)), R.R(String(st.verbose), this.theme.style('text'))],
      [R.R('vimMode', this.theme.style('dim')), R.R(' '.repeat(10)), R.R(String(!!st.vim), this.theme.style('text'))],
      [R.R('permissionMode', this.theme.style('dim')), R.R(' '.repeat(5)), R.R(st.mode, this.theme.style('text'))],
      [R.R('model', this.theme.style('dim')), R.R(' '.repeat(14)), R.R(st.model.id, this.theme.style('text'))],
      [R.R('autoUpdates', this.theme.style('dim')), R.R(' '.repeat(7)), R.R('true', this.theme.style('text'))],
    ];
    this.pushPanel('Config (settings.json)', body, '/theme, /vim and /model change these live');
  }

  cmd_permissions() {
    const st = this.state;
    const allowed = [...(st.sessionAllowed ?? [])];
    const body = [
      [R.R('Mode: ', this.theme.style('dim')), R.R(st.mode, this.theme.style('yellow')), R.R('   shift+tab to cycle', this.theme.style('faint'))],
      [R.R('', undefined)],
      [R.R('Allow (session)', this.theme.style('text', { bold: true }))],
      ...(allowed.length ? allowed.map((k) => [R.R('  ✔ ' + k, this.theme.style('green'))]) : [[R.R('  (none yet)', this.theme.style('faint'))]]),
      [R.R('Ask', this.theme.style('text', { bold: true }))],
      [R.R('  • Bash(git push*)  • Write(~/.ssh/**)  • Edit(**/package.json)', this.theme.style('dim'))],
      [R.R('Deny', this.theme.style('text', { bold: true }))],
      [R.R('  ✗ Read(~/.aws/**)  ✗ Read(.env*)  ✗ Bash(rm -rf *)', this.theme.style('red'))],
    ];
    this.pushPanel('Permissions', body, 'approve a prompt and pick "don\'t ask again" to grow the allow list');
  }

  cmd_mcp() {
    const body = [
      [R.R('✔ github', this.theme.style('green')), R.R(' '.repeat(6)), R.R('27 tools · connected', this.theme.style('dim'))],
      [R.R('✔ sqlite', this.theme.style('green')), R.R(' '.repeat(6)), R.R('1 tool · connected', this.theme.style('dim'))],
      [R.R('✗ sentry', this.theme.style('red')), R.R(' '.repeat(8)), R.R('needs auth · /mcp to authenticate', this.theme.style('yellow'))],
      [R.R('', undefined)],
      [R.R('Add: claude mcp add <name> -- <command>', this.theme.style('faint'))],
    ];
    this.pushPanel('MCP servers', body, 'servers are simulated here; nothing is spawned');
  }

  cmd_transcript() {
    this.dumpTranscript();
  }

  cmd_export(arg) {
    this.exportSession(arg || 'cast');
  }

  cmd_copy() {
    this.copyTranscript(true);
  }

  cmd_play() {
    this.launch('why are the tests failing? fix it');
  }

  cmd_demo() {
    const seq = ['explain this codebase', 'so why are the tests failing? fix it', 'now commit that'];
    (async () => {
      for (const p of seq) {
        await this.typeIn(p);
        this.submit();
        while (this.state.phase !== 'idle') await new Promise((r) => setTimeout(r, 200));
        await new Promise((r) => setTimeout(r, 700));
      }
    })();
  }

  cmd_exit() {
    this.exit();
  }

  cmd_login(arg) {
    if (this.api?.login) return this.api.login(arg);
    this.pushSystem('No live backend wired into this build · simulation stays fully local', 'warn');
  }

  cmd_logout() {
    this.api?.logout?.();
    this.pushSystem('Signed out · simulation mode');
  }

  cmd_bug(text) {
    this.pushSystem(text ? `Feedback captured locally: “${text}” (nothing was sent)` : 'Feedback captured locally (nothing was sent)');
  }

  cmd_hooks() {
    this.pushPanel('Hooks', [[R.R('No hooks configured. Add them to .claude/settings.json', this.theme.style('dim'))]], 'e.g. PreToolUse, PostToolUse, Notification');
  }

  cmd_agents() {
    this.pushPanel(
      'Agents',
      [
        [R.R('general-purpose', this.theme.style('text')), R.R(' '.repeat(6)), R.R('default subagent · reads, searches, runs', this.theme.style('dim'))],
        [R.R('code-reviewer', this.theme.style('text')), R.R(' '.repeat(11)), R.R('looks for defects and risk', this.theme.style('dim'))],
        [R.R('explore', this.theme.style('text')), R.R(' '.repeat(15)), R.R('read-only orientation pass', this.theme.style('dim'))],
      ],
      'subagents are simulated; they do not spawn processes',
    );
  }

  cmd_resume() {
    const sessions = this.listSessions?.() ?? [];
    if (!sessions.length) return this.pushSystem('No other sessions found in this browser profile');
    const items = sessions.map((s, i) => ({ label: `${s.title}`, meta: `${s.when} · ${s.turns} turns`, index: i, session: s }));
    this.openPicker('Resume session', items, (item) => item && this.loadSession?.(item.session));
  }

  cmd_statusline() {
    this.pushSystem('statusline: prompt · mode · ctx · model · cost (fixed in this build)', 'dim');
  }

  cmd_terminal_setup() {
    this.pushSystem('Nothing to configure here — the browser terminal already sends the right keys (that is the real /terminal-setup)');
  }

  cmd_review() {
    this.pushSystem('No PR checked out. Try: /review 1 (simulated)');
    this.agent.submit('review the diff before I open a PR');
  }

  cmd_pr_comments() {
    this.pushSystem('GitHub is not connected in the simulation · 0 unresolved comments (simulated)', 'ok');
  }

  cmd_install_github_app() {
    this.pushPanel('Install GitHub App', [[R.R('This walk-through needs a browser and a real repo.', this.theme.style('dim'))]], 'open github.com/apps/claude in a real tab to install it there');
  }

  cmd_stats() {
    const u = this.state.usage;
    this.pushSystem(`stats: ${u.turns} turns · ${u.tools} tool calls · +${u.linesAdded}/-${u.linesRemoved} lines · ${fmtDuration(Date.now() - u.startedAt)}`);
  }

  pushPanel(title, body, foot, onKey) {
    this.openDialog({ type: 'panel', title, body, foot, onKey: onKey ?? ((d, app) => app.closeDialog()) });
  }

  /** Drive the app from the page chrome (toolbar, chips, deep links). */
  async runExternal(text, { force = false } = {}) {
    if (!text) return;
    if (this.phase === 'shell') return this.launch(text.startsWith('/') ? '' : text);
    if (this.state.phase === 'working') {
      this.pushSystem('⚠ Still working — esc to interrupt first', 'warn');
      return;
    }
    if (text.startsWith('/')) {
      this.state.input.text = text;
      this.state.input.caret = text.length;
      return this.onEnter();
    }
    if (force) this.state.input.text = '';
    await this.typeIn(text);
    return this.submit();
  }

  exit() {
    this.onSessionEnd();
    this.phase = 'shell';
    this.shell.text = '';
    this.shell.caret = 0;
    this.state.phase = 'idle';
    this.state.dialog = null;
    this.dumpTranscript();
    this.pushSystem('Session ended · transcript printed to scrollback');
    this.prevSnapshot = null;
    this.cache.clear();
    this.write(this.fullTranscriptAnsi());
    this.write('\x1b[0m\x1b[?25h');
    this.invalidate();
  }

  // ------------------------------------------------------------------ vim

  vimKey(data) {
    const st = this.state;
    const t = st.input.text;
    let c = st.input.caret;
    const lineStart = t.lastIndexOf('\n', c - 1) + 1;
    const lineEnd = t.indexOf('\n', c) === -1 ? t.length : t.indexOf('\n', c);
    const wordEnd = (from) => {
      let i = from;
      while (i < t.length && /\s/.test(t[i])) i++;
      while (i < t.length && /[\w$]/.test(t[i])) i++;
      return i;
    };
    const wordStart = (from) => {
      let i = from;
      while (i > 0 && /\s/.test(t[i - 1])) i--;
      while (i > 0 && /[\w$]/.test(t[i - 1])) i--;
      return i;
    };
    switch (data) {
      case 'h':
        c = Math.max(lineStart, c - 1);
        break;
      case 'l':
      case ' ':
        c = Math.min(Math.max(lineStart, c), lineEnd === lineStart ? lineEnd : lineEnd - 1);
        break;
      case '0':
        c = lineStart;
        break;
      case '$':
        c = Math.max(lineStart, lineEnd - (lineEnd > lineStart ? 1 : 0));
        break;
      case 'w':
        c = Math.min(t.length, wordEnd(c));
        break;
      case 'b':
        c = wordStart(c);
        break;
      case 'e':
        c = Math.max(0, wordEnd(c) - 1);
        break;
      case 'i':
        st.vimMode = 'insert';
        return this.invalidate();
      case 'a':
        st.vimMode = 'insert';
        c = Math.min(t.length, c + 1);
        break;
      case 'A':
        st.vimMode = 'insert';
        c = lineEnd;
        break;
      case 'I':
        st.vimMode = 'insert';
        c = lineStart;
        break;
      case 'x': {
        st.input.text = t.slice(0, c) + t.slice(c + 1);
        st.input.caret = Math.min(c, st.input.text.length);
        st.vimMode = 'insert';
        return this.invalidate();
      }
      case 'd':
        this._vimPending = 'd';
        return;
      case 'c':
        this._vimPending = 'c';
        return;
      case 'g':
        this._vimPending = 'g';
        return;
      case 'G':
        c = t.length;
        break;
      default:
        if (this._vimPending === 'd' && data === 'd') {
          st.input.text = lineStart === 0 ? t.slice(lineEnd + 1) : t.slice(0, lineStart) + t.slice(lineEnd + 1);
          st.input.caret = Math.min(lineStart, st.input.text.length);
          this._vimPending = null;
          return this.invalidate();
        }
        if (this._vimPending === 'c' && data === 'w') {
          const end = wordEnd(c);
          st.input.text = t.slice(0, c) + t.slice(end);
          st.input.caret = c;
          st.vimMode = 'insert';
          this._vimPending = null;
          return this.invalidate();
        }
        if (this._vimPending === 'g' && data === 'g') {
          this._vimPending = null;
          c = lineStart;
          break;
        }
        this._vimPending = null;
        return;
    }
    this._vimPending = null;
    st.input.caret = c;
    this.invalidate();
  }

  // ------------------------------------------------------------------ scroll

  scrollBy(delta) {
    const st = this.state;
    st.scroll.follow = false;
    st.scroll.offset = Math.max(0, st.scroll.offset - delta);
    const max = Math.max(0, (this._lastTranscriptRows ?? 0) - this.viewportRows() + 4);
    st.scroll.offset = Math.min(st.scroll.offset, max);
    this.invalidate();
  }

  scrollTo(target) {
    const st = this.state;
    if (target === 0) {
      st.scroll.follow = false;
      st.scroll.offset = 0;
    } else {
      st.scroll.follow = true;
      st.scroll.offset = 0;
    }
    this.invalidate();
  }

  viewportRows() {
    return this.screen.rows;
  }

  // ------------------------------------------------------------------ layout

  layout() {
    const st = this.state;
    const W = this.screen.cols;
    const theme = this.theme;
    const lines = [];
    for (const block of st.blocks) lines.push(...this.blockLines(block, W, theme));
    this._lastTranscriptRows = lines.length;
    this._inputChromeIndex = null;

    // Chrome is assembled bottom-up, so each piece can be measured before the dialog is
    // asked to fit whatever vertical space is left.
    const pre = [];
    if (st.todos.length && !st.todosHidden) {
      pre.push(...R.todoLines({ items: st.todos }, { theme, width: W }));
    }
    if (this.autocomplete) {
      const items = this.autocomplete.items.slice(0, 6);
      const boxW = Math.min(W, Math.max(52, ...items.map((i) => strWidth(i.label) + strWidth(i.meta ?? '') + 12)));
      pre.push([R.R('╭' + '─'.repeat(boxW - 2) + '╮', theme.style('border'))]);
      items.forEach((item, i) => {
        const active = i === this.autocomplete.sel;
        const metaPad = Math.max(0, boxW - 4 - strWidth(item.label) - strWidth(item.meta ?? ''));
        pre.push([
          R.R('│', theme.style('border')),
          R.R(active ? '❯ ' : '  ', active ? theme.style('accent') : theme.style('faint')),
          R.R(fit(item.label, Math.max(4, boxW - 6 - strWidth(item.meta ?? ''))), active ? theme.style('text', { bold: true }) : theme.style('text')),
          R.R(' '.repeat(metaPad) + (item.meta ?? ''), theme.style('faint')),
          R.R('│', theme.style('border')),
        ]);
      });
      pre.push([R.R('╰' + '─'.repeat(boxW - 2) + '╯', theme.style('border'))]);
    }
    if (st.phase === 'working' && st.status) {
      pre.push(
        R.statusLine({
          theme,
          label: st.status.verb ?? R.pickVerb(st.status.verb + st.usage.turns),
          elapsed: fmtDuration(Date.now() - st.status.startedAt),
          tokens: st.usage.output > 400 ? `${fmtTokens(st.usage.output)} tok` : '',
          hint: st.queued.length ? '↑ to edit queued message' : '',
        }),
      );
    } else if (st.phase === 'working') {
      pre.push([R.R(' ✻ working… ', theme.style('accent')), R.R(`(esc to interrupt · ${fmtDuration(Date.now() - (st.turnStartedAt ?? Date.now()))})`, theme.style('faint'))]);
    }
    const footer = R.footerLines({
      theme,
      width: W,
      mode: st.mode,
      busy: st.phase === 'working',
      ctx: { pct: this.agent.contextPct() },
      model: st.model.name.replace(' (1M context)', '-1m'),
      cost: st.usage.cost,
      branch: this.vfs.git.branch,
      vim: st.vim && st.vimMode === 'normal',
      queued: st.queued.length,
    });
    const budget = Math.max(6, this.screen.rows - pre.length - footer.length - 1);
    const mid = [];
    if (st.dialog?.type === 'permission' || st.dialog?.type === 'plan') {
      mid.push(
        ...R.dialogLines(st.dialog, {
          theme,
          width: W,
          sel: st.dialog.block?.sel ?? st.dialog.sel ?? 0,
          diffView: st.dialog.block?.diffView ?? true,
          avail: budget,
        }),
      );
    } else if (st.dialog?.type === 'list') {
      const items = (st.dialog.filtered ?? st.dialog.items ?? []).map((it, i) => ({ ...it, index: i }));
      mid.push(
        ...R.listDialogLines({
          theme,
          width: W,
          title: st.dialog.title + (st.dialog.query ? ` · ${st.dialog.query}` : ''),
          items,
          sel: st.dialog.sel ?? 0,
          hint: st.dialog.foot ?? '↑↓ to select · Enter to confirm · Esc to cancel',
          avail: budget,
        }),
      );
    } else if (st.dialog?.type === 'panel' || st.dialog?.type === 'help') {
      const body =
        st.dialog.type === 'help'
          ? (st.dialog.rows ?? []).map(([k, v]) => [R.R(fit(String(k), 24), theme.style('accent')), R.R(fit(String(v), 46), theme.style('dim'))])
          : st.dialog.body ?? [];
      mid.push(...R.panelLines({ theme, width: W, title: st.dialog.title, body, foot: st.dialog.foot, avail: budget }));
    } else {
      const inputView = this.inputView(W);
      this._inputChromeIndex = pre.length;
      mid.push(...R.inputLines({ theme, width: W, ...inputView, mode: st.mode, focused: true, placeholder: PLACEHOLDER }));
    }
    const chrome = [...pre, ...mid, ...footer];

    const avail = Math.max(1, this.screen.rows - chrome.length);
    let top;
    if (st.scroll.follow) top = Math.max(0, lines.length - avail);
    else top = Math.max(0, Math.min(lines.length - 1, st.scroll.offset));
    const visible = lines.slice(top, top + avail);
    while (visible.length < Math.min(avail, lines.length)) visible.push([]);
    const tail = [];
    if (lines.length - top > avail) {
      const hidden = lines.length - top - avail;
      tail.push([R.R(` ↕ ${hidden} more line${hidden === 1 ? '' : 's'} above · PageUp to scroll`, theme.style('faint'))]);
    }
    const body = [...visible, ...tail];
    const out = [...body];
    while (out.length + chrome.length < this.screen.rows) out.push([]);
    const chromeTop = Math.max(0, this.screen.rows - chrome.length);
    this._cursorAt =
      this._inputChromeIndex === null
        ? null
        : { row: Math.min(this.screen.rows - 1, chromeTop + this._inputChromeIndex), col: Math.min(W - 1, 4 + this.inputView(W).cursor.col) };
    return { transcript: out, chrome };
  }

  inputView(W) {
    const st = this.state;
    const innerW = Math.max(4, W - 5);
    const logical = (st.input.text || '').split('\n');
    const rows = [];
    let cursor = { row: 0, col: 0 };
    let consumed = 0;
    for (let li = 0; li < logical.length; li++) {
      const line = logical[li];
      const chunks = Math.max(1, Math.ceil(line.length / innerW));
      for (let ch = 0; ch < chunks; ch++) {
        const seg = line.slice(ch * innerW, (ch + 1) * innerW);
        const start = consumed + ch * innerW;
        if (st.input.caret >= start && st.input.caret <= start + seg.length) {
          cursor = { row: rows.length, col: st.input.caret - start };
        }
        rows.push(seg);
      }
      consumed += line.length + 1;
    }
    return { rows: rows.length ? rows : [''], cursor };
  }

  blockLines(block, W, theme) {
    if (block.kind === 'header') {
      return R.headerLines({
        width: W,
        theme,
        version: VERSION,
        model: this.state.model.name,
        plan: 'API Usage Billing',
        cwd: this.vfs.root,
        hello: this.greeting(),
        spark: R.SPARKS[this.tick % R.SPARKS.length],
      });
    }
    if (block.kind === 'welcome') {
      return R.welcomeLines({ width: W, theme, tips: block.tips, extra: block.extra });
    }
    if (block.kind === 'user') return R.userLines(block, { width: W, theme });
    if (block.kind === 'assistant') return R.assistantLines(block, { width: W, theme });
    if (block.kind === 'thinking') return R.thinkingLines(block, { theme, width: W, verbose: this.state.verbose });
    if (block.kind === 'tool') {
      const sig = `${block.status}:${block.tick}:${this.state.verbose}:${block.summary ?? ''}`;
      const hit = this.cache.get(block.id);
      if (hit && hit.sig === sig) return hit.lines;
      const lines = R.toolLines(block, { theme, width: W, verbose: this.state.verbose });
      this.cache.set(block.id, { sig, lines });
      return lines;
    }
    if (block.kind === 'system') return R.systemLines(block, { theme });
    if (block.kind === 'finish') return R.finishLines(block, { theme });
    if (block.kind === 'error') return R.errorLines(block, { theme, width: W });
    if (block.kind === 'todos') return []; // the live list is pinned in the chrome below
    if (block.kind === 'permission') {
      // the live prompt is painted into the chrome so it can never scroll out of view
      return [];
    }
    return [];
  }

  greeting() {
    if (!this._greeting) this._greeting = SPARKLE_WORDS[Math.floor(Math.random() * SPARKLE_WORDS.length)];
    return this._greeting;
  }

  // ------------------------------------------------------------------ paint

  paint() {
    if (this.phase === 'shell') return this.renderShell();
    const { rows, cols } = this.size();
    this.screen.resize(rows, Math.max(20, cols));
    const W = this.screen.cols;
    const st = this.state;
    if (st.phase === 'working') st.turnStartedAt = st.turnStartedAt ?? Date.now();
    if (st.phase !== 'working') st.turnStartedAt = null;
    const { transcript, chrome } = this.layout();
    this.screen.clear();
    let y = 0;
    for (const line of transcript) {
      if (y >= this.screen.rows) break;
      this.screen.runs(0, y, line, {});
      y++;
    }
    let cy = this.screen.rows - chrome.length;
    if (cy < 0) cy = 0;
    for (const line of chrome) {
      if (cy >= this.screen.rows) break;
      this.screen.runs(0, cy, line, {});
      cy++;
    }
    const fresh = this.prevSnapshot === null;
    const { ansi, snapshot, changed } = this.screen.diff(this.prevSnapshot);
    this.prevSnapshot = snapshot;
    const showCursor = !st.dialog && (st.phase === 'idle' || st.phase === 'working');
    const at = this._cursorAt;
    const tail = showCursor && at ? `\x1b[${at.row + 1};${Math.min(W, at.col + 1)}H` : '';
    if (!changed && !fresh && this._lastCursorMark === tail) return;
    this._lastCursorMark = tail;
    const payload = `\x1b[?25${showCursor ? 'h' : 'l'}${fresh ? CLEAR_SCREEN : ''}${ansi}${tail}`;
    this.write(payload);
    this.recorder?.push(payload);
  }

  // ------------------------------------------------------------------ export

  fullTranscriptPlain() {
    const W = 100;
    const out = [];
    if (this.state.todos?.length) {
      out.push(...R.todoLines({ items: this.state.todos }, { theme: this.theme, width: W }).map((l) => l.map((r) => r.text).join('')));
      out.push('');
    }
    for (const block of this.state.blocks) {
      for (const line of this.blockLines(block, W, this.theme)) out.push(line.map((r) => r.text).join('').replace(/\s+$/, ''));
    }
    return out.join('\n');
  }

  fullTranscriptAnsi() {
    const W = 100;
    const theme = this.theme;
    const rows = [];
    for (const block of this.state.blocks) {
      for (const line of this.blockLines(block, W, theme)) {
        let s = '';
        let cur = null;
        for (const run of line) {
          const st = run.style ?? {};
          const key = JSON.stringify(st);
          if (key !== cur) {
            s += '\x1b[0m' + sgr(st);
            cur = key;
          }
          s += run.text;
        }
        rows.push(s + '\x1b[0m');
      }
    }
    return rows.join('\r\n') + '\r\n';
  }

  dumpTranscript() {
    // write the whole session into the terminal's native scrollback so it can be selected
    this.write(this.fullTranscriptAnsi() + '\x1b[0m');
    this.prevSnapshot = null;
    this.invalidate();
  }

  copyTranscript(ansi = false) {
    const text = ansi ? this.fullTranscriptAnsi() : this.fullTranscriptPlain();
    // always hand the text back so the host can fall back to a select-to-copy UI
    const done = (ok) => this.pushSystem(ok ? '✓ Transcript copied to clipboard (ANSI)' : 'Copy blocked — select the text instead', ok ? 'ok' : 'warn');
    if (navigator.clipboard?.write) {
      if (ansi && navigator.clipboard.write?.length) {
        try {
          navigator.clipboard
            .write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) })])
            .then(() => done(true))
            .catch(() => fallback());
          return;
        } catch {
          /* fall through */
        }
      }
      navigator.clipboard
        .writeText(stripAnsiLocal(text))
        .then(() => done(true))
        .catch(() => fallback());
      return;
    }
    fallback();
    function fallback() {
      done(false);
    }
    return text;
  }

  exportSession(kind = 'cast') {
    const payload =
      kind === 'md'
        ? { name: `claude-code-session-${this.state.session.id}.md`, text: this.transcriptMarkdown(), mime: 'text/markdown' }
        : kind === 'ansi'
          ? { name: `claude-code-session-${this.state.session.id}.ansi`, text: this.fullTranscriptAnsi(), mime: 'text/plain' }
          : kind === 'txt'
            ? { name: `claude-code-session-${this.state.session.id}.txt`, text: this.fullTranscriptPlain(), mime: 'text/plain' }
            : { name: `claude-code-session-${this.state.session.id}.cast`, text: this.recorder?.cast() ?? '[]', mime: 'application/x-asciinemacast' };
    this.onExport?.(payload);
    this.pushSystem(`Exported ${payload.name} (${(payload.text.length / 1024).toFixed(1)} kB)`, 'ok');
  }

  transcriptMarkdown() {
    const st = this.state;
    const out = [`# Claude Code session ${st.session.id}`, '', `- model: ${st.model.name}`, `- mode: ${st.mode}`, `- exported: ${new Date().toISOString()}`, '', '```', this.fullTranscriptPlain(), '```', ''].join('\n');
    return out;
  }
}

function sgr(style) {
  const parts = [];
  if (style.bold) parts.push('1');
  if (style.dim) parts.push('2');
  if (style.italic) parts.push('3');
  if (style.underline) parts.push('4');
  if (style.inverse) parts.push('7');
  if (style.strike) parts.push('9');
  if (style.fg) parts.push(colorParam(style.fg, 38));
  if (style.bg) parts.push(colorParam(style.bg, 48));
  return parts.length ? `\x1b[${parts.join(';')}m` : '';
}

function colorParam(color, base) {
  if (typeof color === 'number') return `${base};5;${color}`;
  if (typeof color === 'string' && color.startsWith('#')) {
    const h = color.slice(1);
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    return `${base};2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}`;
  }
  return String(color);
}

function stripAnsiLocal(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

function applyPreview(vfs, args) {
  const cur = vfs.files[args.file_path] ?? '';
  if (!args.old_string) return cur;
  return cur.replace(args.old_string, args.new_string ?? '');
}

export const SHORTCUTS = [
  ['Enter', 'send prompt'],
  ['\\ + Enter / Alt+Enter', 'newline in the prompt'],
  ['esc', 'interrupt the current turn'],
  ['esc esc', 'rewind to a checkpoint (restores the working tree)'],
  ['ctrl+c', 'clear prompt · twice to exit'],
  ['ctrl+d', 'exit'],
  ['ctrl+l', 'redraw (clear)] → see note'],
  ['ctrl+o', 'toggle verbose: full diffs, tool output, thinking'],
  ['ctrl+t', 'hide/show the todo panel'],
  ['shift+tab', 'cycle permission modes'],
  ['↑ ↓', 'prompt history · navigate dialogs'],
  ['tab', 'accept completion · toggle diff in a prompt'],
  ['1 2 3', 'answer a permission prompt'],
  ['PageUp PageDown', 'scroll the transcript'],
  ['?', 'this sheet (empty prompt)'],
  ['/', 'all slash commands'],
  ['@', 'mention a file from the repo'],
  ['#', 'add a note to CLAUDE.md memory'],
];

export const SLASH_COMMANDS = [
  { name: 'help', desc: 'list available commands', run: 'cmd_help' },
  { name: 'demo', desc: 'type and run a scripted session', run: 'cmd_demo' },
  { name: 'play', desc: 'launch a fresh session with the demo prompt', run: 'cmd_play' },
  { name: 'clear', desc: 'clear the conversation history', run: 'cmd_clear' },
  { name: 'compact', desc: 'summarise the conversation to free context', run: 'cmd_compact' },
  { name: 'context', desc: 'show current context usage', run: 'cmd_context' },
  { name: 'cost', desc: 'show total cost and duration', run: 'cmd_cost' },
  { name: 'model', desc: 'switch model (Opus / Sonnet / Haiku)', run: 'cmd_model' },
  { name: 'theme', desc: 'switch dark / light / ansi', run: 'cmd_theme' },
  { name: 'status', desc: 'show session and account status', run: 'cmd_status' },
  { name: 'config', desc: 'show effective settings', run: 'cmd_config' },
  { name: 'doctor', desc: 'check the installation', run: 'cmd_doctor' },
  { name: 'permissions', desc: 'show allow/ask/deny rules', run: 'cmd_permissions' },
  { name: 'vim', desc: 'toggle vim mode for the prompt', run: 'cmd_vim' },
  { name: 'init', desc: 'create a CLAUDE.md for this repo', run: 'cmd_init' },
  { name: 'mcp', desc: 'manage MCP servers', run: 'cmd_mcp' },
  { name: 'agents', desc: 'list subagents', run: 'cmd_agents' },
  { name: 'hooks', desc: 'manage lifecycle hooks', run: 'cmd_hooks' },
  { name: 'export', desc: 'download the session (cast|ansi|md|txt)', run: 'cmd_export' },
  { name: 'copy', desc: 'copy the transcript to the clipboard', run: 'cmd_copy' },
  { name: 'transcript', desc: 'print the whole session into scrollback', run: 'cmd_transcript' },
  { name: 'resume', desc: 'resume a saved session', run: 'cmd_resume' },
  { name: 'stats', desc: 'turn, tool and line counts', run: 'cmd_stats' },
  { name: 'statusline', desc: 'configure the status line', run: 'cmd_statusline' },
  { name: 'terminal-setup', desc: 'configure terminal keybindings', run: 'cmd_terminal_setup' },
  { name: 'review', desc: 'review a pull request', run: 'cmd_review' },
  { name: 'pr-comments', desc: 'fetch PR comments', run: 'cmd_pr_comments' },
  { name: 'login', desc: 'log in with an API key', run: 'cmd_login' },
  { name: 'logout', desc: 'log out', run: 'cmd_logout' },
  { name: 'bug', desc: 'send feedback about this simulation', run: 'cmd_bug' },
  { name: 'exit', desc: 'exit the session', run: 'cmd_exit' },
  { name: 'quit', desc: 'exit the session', run: 'cmd_exit' },
];

/** Recorder geometry has to be sampled once, before the screen exists. */
function snapshotSize(size) {
  try {
    const { rows = 24, cols = 80 } = size?.() ?? {};
    return { rows, cols };
  } catch {
    return { rows: 24, cols: 80 };
  }
}
