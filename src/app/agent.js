/**
 * Agent: executes a scenario plan against the virtual filesystem and mutates shared UI
 * state. It never touches the DOM or ANSI — App.js renders whatever state this produces.
 *
 * Interruption model mirrors the real CLI: `esc` sets `interruptRequested`, the agent
 * checks it at the next awaitable boundary, rolls the turn back to a prompt, and leaves
 * already-applied edits in place (the real tool does not roll edits back either).
 */
import { selectScenario } from './scenarios.js';
import { finishLine, pickVerb } from '../tui/spinner.js';
import { toolRead, toolWrite, toolEdit, toolGlob, toolGrep, toolBash, runTests } from './tools.js';
import { fmtDuration } from '../ansi/text.js';

export const MODES = ['manual', 'acceptEdits', 'plan', 'auto'];

export const MODEL_CATALOG = [
  { id: 'opus', name: 'Opus 4.1', context: 200000, speed: 'most capable', price: { in: 15, out: 75 }, note: 'default for hard work' },
  { id: 'opus-1m', name: 'Opus 4.1 (1M context)', context: 1000000, speed: 'most capable', price: { in: 15, out: 75 }, note: 'beta · long sessions' },
  { id: 'sonnet', name: 'Sonnet 4.5', context: 200000, speed: 'balanced', price: { in: 3, out: 15 }, note: 'fast, good everyday pick' },
  { id: 'sonnet-1m', name: 'Sonnet 4.5 (1M context)', context: 1000000, speed: 'balanced', price: { in: 3, out: 15 }, note: 'beta' },
  { id: 'haiku', name: 'Haiku 4.5', context: 200000, speed: 'fastest', price: { in: 0.8, out: 4 }, note: 'cheap, for quick edits' },
];

export function defaultState(themeName = 'dark') {
  return {
    themeName,
    phase: 'idle',
    booted: false,
    blocks: [],
    nextBlockId: 1,
    todos: [],
    mode: 'manual',
    verbose: false,
    vim: false,
    model: MODEL_CATALOG[0],
    subscription: 'Max plan · 1.0x',
    status: null,
    dialog: null,
    queued: [],
    usage: { input: 0, output: 0, cost: 0, linesAdded: 0, linesRemoved: 0, turns: 0, tools: 0, startedAt: Date.now() },
    live: { api: false, label: '' },
    scroll: { offset: 0, follow: true },
    input: { text: '', caret: 0, history: [], histIdx: -1 },
    session: { id: sessionId(), started: Date.now(), scenario: null },
    hint: null,
  };
}

function sessionId() {
  return Math.random().toString(16).slice(2, 10);
}

export class Agent {
  /**
   * @param {{vfs:object, state:object, onUpdate:()=>void, requestPermission:(b:object)=>Promise<object>, sleepFactory?:Function}} opts
   */
  constructor(opts) {
    this.vfs = opts.vfs;
    this.state = opts.state;
    this.onUpdate = opts.onUpdate ?? (() => {});
    this.requestPermission = opts.requestPermission ?? (async () => ({ action: 'accept' }));
    this.interruptRequested = false;
    this.running = false;
    this.sleep = opts.sleepFactory ?? ((ms) => new Promise((r) => setTimeout(r, Math.max(0, ms))));
    this.streamSpeed = 1;
    this.api = null; // set to a live backend (src/app/live.js) when logged in
  }

  // ------------------------------------------------------------------ helpers

  push(block) {
    const st = this.state;
    const full = { id: st.nextBlockId++, ts: Date.now(), ...block };
    st.blocks.push(full);
    this.onUpdate();
    return full;
  }

  findBlock(id) {
    return this.state.blocks.find((b) => b.id === id);
  }

  touch() {
    this.onUpdate();
  }

  tokens(n) {
    const u = this.state.usage;
    if (n > 0) u.output += n;
    else u.input += -n;
    const price = this.state.model.price;
    u.cost += (Math.abs(n) / 1000) * (n > 0 ? price.out : price.in) / 1000;
  }

  /** Context-window pressure, shown in the status bar. */
  contextPct() {
    const u = this.state.usage;
    const used = u.input + u.output;
    return Math.min(0.999, used / this.state.model.context);
  }

  async wait(ms) {
    const step = 40;
    let left = ms / this.streamSpeed;
    while (left > 0) {
      if (this.interruptRequested) return 'interrupted';
      await this.sleep(Math.min(step, left));
      left -= step;
    }
    return this.interruptRequested ? 'interrupted' : 'ok';
  }

  /** Stream markdown into a block, a few characters per frame. */
  async streamInto(block, md, { cps = 900 } = {}) {
    block.md = '';
    block.streaming = true;
    const chunkEvery = 2;
    let i = 0;
    while (i < md.length) {
      if (this.interruptRequested) {
        block.md = md.slice(0, i);
        block.streaming = false;
        return 'interrupted';
      }
      const take = Math.max(2, Math.round((cps * chunkEvery) / 1000));
      block.md = md.slice(0, i + take);
      i += take;
      this.onUpdate();
      await this.sleep(chunkEvery);
    }
    block.md = md;
    block.streaming = false;
    this.tokens(Math.ceil(md.length / 3.6));
    this.onUpdate();
    return 'ok';
  }

  // ------------------------------------------------------------------ turn loop

  async submit(prompt) {
    const st = this.state;
    if (this.running) {
      st.queued.push(prompt);
      this.push({ kind: 'system', tone: 'dim', text: `Queued for the next turn · ${st.queued.length} waiting` });
      return { queued: true };
    }
    this.running = true;
    this.interruptRequested = false;
    this._interruptReported = false;
    st.phase = 'working';
    st.turnStartedAt = Date.now();
    st.status = { verb: pickVerb(prompt), startedAt: Date.now() };
    st.usage.turns += 1;
    this.push({ kind: 'user', text: prompt });
    this.tokens(-Math.ceil(prompt.length / 3.6) - 320);

    let outcome;
    try {
      outcome = st.live.api && this.api ? await this.runLive(prompt) : await this.runSimulated(prompt);
    } catch (err) {
      this.push({ kind: 'error', text: `Turn failed: ${err?.message ?? err}` });
      outcome = 'error';
    }
    st.phase = 'idle';
    st.status = null;
    st.turnDoneAt = Date.now();
    this.running = false;
    if (outcome !== 'queued') {
      // the CLI closes every turn with "✻ Simmered for 6s"
      const secs = Math.max(1, Math.round((st.turnDoneAt - (st.turnStartedAt ?? st.turnDoneAt)) / 1000));
      this.push({ kind: 'finish', text: `\u273b ${finishLine(secs)} for ${fmtDuration(secs * 1000)}`, seconds: secs });
    }
    this.onUpdate();
    const next = st.queued.shift();
    if (next) {
      await this.sleep(140);
      return this.submit(next);
    }
    return { outcome };
  }

  async runSimulated(prompt) {
    const st = this.state;
    const ctx = {
      vfs: this.vfs,
      prompt,
      state: st,
      agent: this,
      tests: () => runTests(this.vfs),
      dirty: () => [...this.vfs.dirty],
    };
    const scenario = selectScenario(prompt, ctx);
    st.session.scenario = scenario.id;
    let plan;
    try {
      plan = scenario.plan(ctx) ?? [];
    } catch (err) {
      plan = [{ kind: 'text', md: `I hit a snag planning that: \`${err.message}\`. Tell me the file or symptom and I'll take another pass.` }];
    }
    const pendingMutations = [];
    for (const step of plan) {
      if (this.interruptRequested) {
        this.noteInterrupt();
        return 'interrupted';
      }
      switch (step.kind) {
        case 'think': {
          st.status = { verb: 'Thinking', startedAt: Date.now() };
          const block = this.push({ kind: 'thinking', text: '', expanded: false, streaming: true });
          this.onUpdate();
          const res = await this.streamInto(block, step.text, { cps: 1400 });
          block.streaming = false;
          st.status = null;
          this.onUpdate();
          if (res === 'interrupted') {
            this.noteInterrupt();
            return 'interrupted';
          }
          await this.wait(140);
          break;
        }
        case 'text': {
          const md = typeof step.md === 'function' ? String(step.md(ctx) ?? '') : String(step.md ?? '');
          st.status = { verb: pickVerb(md.slice(0, 24)), startedAt: st.status?.startedAt ?? Date.now() };
          const block = this.push({ kind: 'assistant', md: '', streaming: true });
          const res = await this.streamInto(block, md);
          if (res === 'interrupted') {
            this.noteInterrupt();
            return 'interrupted';
          }
          await this.wait(90);
          break;
        }
        case 'todos':
          st.todos = step.items.map((i) => ({ ...i, content: i.content ?? i.text ?? '', status: i.status ?? 'pending' }));
          this.push({ kind: 'todos', items: st.todos.map((i) => ({ ...i })) });
          await this.wait(120);
          break;
        case 'notice':
          this.push({ kind: 'system', tone: step.tone ?? 'dim', text: step.text });
          break;
        case 'error':
          this.push({ kind: 'error', text: step.text });
          break;
        case 'tool': {
          const args = typeof step.args === 'function' ? step.args(ctx) : step.args;
          const mutating = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(step.name) || (step.name === 'Bash' && !isReadOnlyCommand(args.command));
          if (st.mode === 'plan' && mutating) {
            pendingMutations.push({ ...step, args });
            this.push({ kind: 'tool', name: step.name, args, status: 'done', summary: 'Deferred — plan mode is read-only', planned: true });
            break;
          }
          const res = await this.runTool({ ...step, args });
          if (res === 'interrupted') {
            this.noteInterrupt();
            return 'interrupted';
          }
          if (res === 'denied') {
            this.push({
              kind: 'assistant',
              md: `Understood — leaving that alone. Tell me what you'd prefer instead: a different approach, or a narrower change I can show you before it touches anything.`,
              streaming: false,
            });
            return 'denied';
          }
          break;
        }
        default:
          break;
      }
    }
    if (pendingMutations.length) {
      const verdict = await this.requestPlanApproval(pendingMutations);
      if (verdict === 'reject') {
        this.push({ kind: 'system', tone: 'warn', text: 'Plan rejected — staying in plan mode' });
        return 'plan-rejected';
      }
      st.mode = verdict === 'auto' ? 'acceptEdits' : 'manual';
      this.push({ kind: 'system', tone: 'ok', text: `Plan approved · switching to ${st.mode === 'auto' ? 'accept edits' : 'manual approval'} mode` });
      for (const step of pendingMutations) {
        const res = await this.runTool(step);
        if (res === 'interrupted') return 'interrupted';
      }
    }
    return 'ok';
  }

  /**
   * Execute one tool step: creates the transcript block, asks permission if the mode
   * requires it, runs against the VFS, and animates the result.
   */
  async runTool(step) {
    const st = this.state;
    const { name, args = {} } = step;
    const needsAsk = this.needsApproval(name, args, step.approval);
    let permission = needsAsk ? await this.requestPermission({ name, args, note: step.note }) : { action: 'allow' };
    if (permission.action === 'cancel') {
      this.push({ kind: 'tool', name, args, status: 'denied', summary: 'cancelled' });
      return 'denied';
    }
    if (permission.action === 'allow-session') {
      st.mode = ['Edit', 'Write', 'MultiEdit'].includes(name) ? 'acceptEdits' : st.mode;
      st.sessionAllowed = st.sessionAllowed ?? new Set();
      st.sessionAllowed.add(approvalKey(name, args));
    }

    const block = this.push({
      kind: 'tool',
      name,
      args,
      status: 'running',
      tick: 0,
      progressLabel: name === 'Bash' ? 'Running…' : `${name}…`,
      showDiff: permission.action === 'show-diff',
    });
    st.status = { verb: name === 'Bash' ? 'Running command' : name, startedAt: Date.now(), tool: name };
    this.onUpdate();

    const spin = setInterval(() => {
      block.tick = (block.tick ?? 0) + 1;
      this.onUpdate();
    }, 110);

    const startedAt = Date.now();
    let result;
    try {
      result = await this.exec(name, args, block);
    } catch (err) {
      result = { ok: false, error: String(err?.message ?? err), summary: `Error: ${err?.message ?? err}` };
    }
    clearInterval(spin);
    st.status = null;
    const took = Date.now() - startedAt;
    block.status = result.ok === false ? 'error' : 'done';
    block.summary = result.summary ?? 'Done';
    block.error = result.error;
    block.content = result.content;
    block.diff = result.diff;
    block.preview = result.preview;
    block.output = result.stream ? toOutputLines(result.stream) : result.output;
    block.durationMs = took;
    if (result.stats) {
      st.usage.linesAdded += result.stats.added ?? 0;
      st.usage.linesRemoved += result.stats.removed ?? 0;
    }
    st.usage.tools += 1;
    this.tokens(-Math.ceil(String(result.content ?? '').length / 3.6) - 60);
    this.tokens(Math.ceil(String(block.summary ?? '').length / 3.6));
    if (result.ok === false) this.push({ kind: 'system', tone: 'error', text: `${name} failed: ${result.error ?? 'unknown error'}` });
    if (this.interruptRequested && took < 400) {
      this.noteInterrupt();
      return 'interrupted';
    }
    // small pause so the ⎿ line is readable, mirroring real tool cadence
    await this.wait(Math.min(420, 140 + took / 3));
    this.onUpdate();
    return 'ok';
  }

  needsApproval(name, args, hint) {
    const st = this.state;
    if (hint === 'none' || hint === 'auto') return false;
    if (st.mode === 'auto') return false;
    if (st.mode === 'acceptEdits' && ['Edit', 'Write', 'MultiEdit'].includes(name)) return false;
    const key = approvalKey(name, args);
    if (st.sessionAllowed?.has(key)) return false;
    if (hint === 'ask') return true;
    if (['Edit', 'Write', 'MultiEdit'].includes(name)) return true;
    if (name === 'Bash' && !isReadOnlyCommand(args.command ?? '')) return true;
    return false;
  }

  async exec(name, args, block) {
    const vfs = this.vfs;
    switch (name) {
      case 'Read':
        await this.wait(200);
        return toolRead(vfs, args);
      case 'Glob':
        await this.wait(160);
        return toolGlob(vfs, args);
      case 'Grep':
        await this.wait(200);
        return toolGrep(vfs, args);
      case 'Write':
        await this.wait(240);
        return toolWrite(vfs, args);
      case 'Edit':
      case 'MultiEdit':
        await this.wait(220);
        return toolEdit(vfs, args);
      case 'Bash': {
        const res = toolBash(vfs, args);
        if (res.stream) {
          block.output = [];
          for (const line of toOutputLines(res.stream)) {
            if (this.interruptRequested) break;
            block.output.push(line);
            block.progress = line.text;
            this.onUpdate();
            await this.wait(90);
          }
          delete block.progress;
        } else {
          await this.wait(300);
        }
        const out = String(res.content ?? '');
        return { ...res, output: toOutputLines(out.split('\n').map((text) => ({ text }))), summary: res.summary };
      }
      case 'Task': {
        await this.wait(700);
        return { ok: true, summary: 'Subagent finished', content: 'Read 4 files, found nothing alarming beyond the open questions.' };
      }
      default:
        await this.wait(160);
        return { ok: false, error: `Unknown tool: ${name}`, summary: `Unknown tool: ${name}` };
    }
  }

  async requestPlanApproval(steps) {
    const files = [...new Set(steps.map((s) => s.args?.file_path).filter(Boolean))];
    const decision = await this.requestPermission({
      name: 'ExitPlanMode',
      args: { plan: `Apply ${steps.length} planned change${steps.length === 1 ? '' : 's'}${files.length ? ` to ${files.join(', ')}` : ''}` },
      note: 'plan approval',
      planApproval: true,
      steps,
    });
    if (decision.action === 'allow' || decision.action === 'allow-session') return decision.action === 'allow-session' ? 'auto' : 'proceed';
    return 'reject';
  }

  /** `/compact` — summarise the transcript into one system line. */
  compact() {
    const st = this.state;
    const before = st.usage.input + st.usage.output;
    const kept = st.blocks.slice(-4);
    st.blocks = [
      {
        id: st.nextBlockId++,
        kind: 'system',
        tone: 'dim',
        ts: Date.now(),
        text: `∴ Context auto-compacted · ${kept.length} recent messages kept, ${fmt(before)} tokens summarised away`,
      },
      ...kept,
    ];
    st.usage.input = Math.round(st.usage.input * 0.25);
    st.usage.output = Math.round(st.usage.output * 0.3);
    this.onUpdate();
    return { before, after: st.usage.input + st.usage.output };
  }

  interrupt() {
    this.interruptRequested = true;
  }

  /** The CLI prints the interruption notice exactly once per turn, wherever it lands. */
  noteInterrupt() {
    if (this._interruptReported) return;
    this._interruptReported = true;
    this.push({ kind: 'system', tone: 'warn', text: '[Request interrupted by user]' });
  }
}

function fmt(n) {
  return n > 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function toOutputLines(stream) {
  if (!Array.isArray(stream)) return undefined;
  return stream.map((line) => (typeof line === 'string' ? { text: line } : line));
}

const READ_ONLY = /^\s*(?:ls|cat|head|tail|wc|grep|rg|find|tree|pwd|which|date|uname|whoami|du|node\s--version|npm\s+(?:ls|test|run\s+lint)|npx\s+eslint|git\s+(?:status|diff|log|show|branch)|git\s+diff\b)/;

export function isReadOnlyCommand(cmd) {
  if (!cmd) return true;
  if (/[;&|`$()]/.test(cmd) && !/&&\s*(npm run lint|npm test)/.test(cmd)) return false;
  return READ_ONLY.test(String(cmd).trim());
}

function approvalKey(name, args = {}) {
  if (name === 'Bash') {
    const first = String(args.command ?? '').trim().split(/\s+/).slice(0, 2).join(' ');
    return `Bash(${first})`;
  }
  if (['Edit', 'Write', 'MultiEdit'].includes(name)) return `${name}(${args.file_path ?? ''})`;
  return `${name}(${args.pattern ?? args.url ?? ''})`;
}

export { approvalKey };
