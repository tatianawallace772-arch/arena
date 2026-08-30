import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Agent, MODEL_CATALOG, approvalKey, defaultState, isReadOnlyCommand } from '../src/app/agent.js';
import { createVfs } from '../src/app/vfs.js';
import { runTests } from '../src/app/tools.js';

/** Turns run at ~instant speed in tests: sleeps are squeezed, streaming still ticks. */
function makeAgent({ decision = 'allow', mode = 'manual' } = {}) {
  const state = defaultState();
  state.mode = mode;
  const asks = [];
  const agent = new Agent({
    vfs: createVfs(),
    state,
    sleepFactory: (ms) => new Promise((r) => setTimeout(r, Math.min(1, ms / 500))),
    onUpdate: () => {},
    requestPermission: async (block) => {
      asks.push(block);
      return { action: decision };
    },
  });
  agent.streamSpeed = 600;
  return { agent, state, asks };
}

test('the fix scenario edits for real, runs the tests and turns them green', async () => {
  const { agent, state, asks } = makeAgent();
  await agent.submit('fix the failing tests and run them');
  assert.ok(asks.length >= 1, 'a write tool asked first');
  assert.ok(asks.some((a) => a.name === 'Edit'), 'the Edit needed approval');
  const tools = state.blocks.filter((b) => b.kind === 'tool');
  assert.ok(tools.some((b) => b.name === 'Bash' && /npm test/.test(b.args.command ?? '')), 'ran npm test');
  assert.equal(runTests(agent.vfs).fail, 0, 'the planted bug is fixed in the virtual repo');
  assert.ok(state.usage.cost > 0, 'the turn was billed');
  assert.equal(state.usage.turns, 1);
  assert.equal(state.phase, 'idle');
  assert.equal(agent.running, false);
  const finished = tools.filter((b) => b.status === 'done');
  assert.ok(finished.length >= 3, 'tools reported completion');
});

test('a denied edit is recorded and nothing is written', async () => {
  const { agent, state } = makeAgent({ decision: 'cancel' });
  await agent.submit('fix the failing tests and run them');
  const edit = state.blocks.find((b) => b.kind === 'tool' && b.name === 'Edit');
  assert.equal(edit.status, 'denied');
  assert.doesNotMatch(agent.vfs.files['src/util/sort.js'], /toLowerCase\(\)/);
  const reply = state.blocks.filter((b) => b.kind === 'assistant').at(-1);
  assert.match(reply.md ?? '', /leaving that alone/i, 'it acknowledges the refusal');
  assert.match(state.blocks.at(-1).text ?? '', /✻ \w+ for \d+s/, 'the turn still closes normally');
});

test('allow-session stops asking for the same tool', async () => {
  const state = defaultState();
  const asks = [];
  const agent = new Agent({
    vfs: createVfs(),
    state,
    sleepFactory: (ms) => new Promise((r) => setTimeout(r, Math.min(1, ms / 500))),
    requestPermission: async (block) => {
      asks.push(block);
      return { action: 'allow-session' };
    },
  });
  agent.streamSpeed = 600;
  await agent.submit('fix the failing tests and run them');
  const keys = asks.map((a) => approvalKey(a.name, a.args));
  assert.equal(new Set(keys).size, keys.length, `no key asked twice: ${keys.join(', ')}`);
  assert.equal(state.mode, 'acceptEdits', 'allowing edits in the session flips the mode');
});

test('acceptEdits mode asks for nothing read-only-ish and never for edits', async () => {
  const { agent, state, asks } = makeAgent({ mode: 'acceptEdits' });
  await agent.submit('fix the failing tests and run them');
  assert.equal(asks.length, 0, 'no prompts at all for this scenario');
  assert.equal(state.blocks.some((b) => b.kind === 'permission'), false);
});

test('approval policy is derived from the tool, not the scenario', () => {
  const { agent } = makeAgent();
  assert.equal(agent.needsApproval('Read', { file_path: 'src/db.js' }), false);
  assert.equal(agent.needsApproval('Grep', { pattern: 'x' }), false);
  assert.equal(agent.needsApproval('Glob', { pattern: '*.js' }), false);
  assert.equal(agent.needsApproval('Bash', { command: 'ls' }), false);
  assert.equal(agent.needsApproval('Bash', { command: 'rm -rf dist' }), true);
  assert.equal(agent.needsApproval('Edit', { file_path: 'src/db.js' }), true);
  assert.equal(agent.needsApproval('Edit', { file_path: 'src/db.js' }, 'none'), false);
  agent.state.mode = 'auto';
  assert.equal(agent.needsApproval('Edit', { file_path: 'src/db.js' }), false, 'auto-accept skips everything');
});

test('read-only commands are recognised as safe', () => {
  for (const c of ['ls -la', 'git status', 'npm test', 'cat package.json', 'grep -n TODO src']) {
    assert.equal(isReadOnlyCommand(c), true, c);
  }
  for (const c of ['rm -rf node_modules', 'git push', 'npm install', 'echo x > src/db.js']) {
    assert.equal(isReadOnlyCommand(c), false, c);
  }
});

test('plan mode defers mutations, then applies them after approval', async () => {
  const { agent, state, asks } = makeAgent({ mode: 'plan' });
  await agent.submit('add pagination to the tracks list');
  const exit = asks.find((a) => a.name === 'ExitPlanMode');
  assert.ok(exit, 'ExitPlanMode asked');
  const deferred = state.blocks.filter((b) => b.planned);
  assert.ok(deferred.length >= 1, 'mutations were shown as deferred');
  assert.match(deferred[0].summary, /read-only/);
  assert.ok(agent.vfs.dirty.size > 0, 'approved mutations were applied');
  assert.notEqual(agent.state.mode, 'plan', 'plan mode exits after approval');
});

test('rejecting a plan keeps the repo clean and stays in plan mode', async () => {
  const { agent, state } = makeAgent({ decision: 'cancel', mode: 'plan' });
  await agent.submit('add pagination to the tracks list');
  assert.equal(agent.vfs.dirty.size, 0, 'nothing written');
  assert.equal(agent.state.mode, 'plan', 'still planning');
  assert.ok(state.blocks.some((b) => /Plan rejected/.test(b.text ?? '')));
});

test('context pressure rises with usage and /compact releases it', async () => {
  const { agent, state } = makeAgent();
  assert.equal(agent.contextPct(), 0);
  for (let i = 0; i < 30; i++) {
    agent.push({ kind: 'assistant', md: 'x'.repeat(900) });
    state.usage.input += 4000;
    state.usage.output += 500;
  }
  const pct = agent.contextPct();
  assert.ok(pct > 0.05 && pct <= 0.999, `pct ${pct}`);
  const before = state.blocks.length;
  const res = agent.compact();
  assert.ok(state.blocks.length < before, 'blocks collapsed');
  assert.match(state.blocks[0].text, /compacted/i);
  assert.ok(res.after < res.before);
  assert.ok(agent.contextPct() < pct, 'tokens released');
});

test('interrupting mid-turn leaves one marker and a clean state', async () => {
  const { agent, state } = makeAgent();
  agent.streamSpeed = 1;
  const run = agent.submit('explain this codebase');
  await new Promise((r) => setTimeout(r, 20));
  agent.interrupt();
  await run;
  const notices = state.blocks.filter((b) => /Request interrupted/.test(b.text ?? ''));
  assert.equal(notices.length, 1, 'exactly one marker');
  assert.equal(state.phase, 'idle');
  assert.equal(agent.running, false);
});

test('a prompt arriving mid-turn is queued and run afterwards', async () => {
  const { agent, state } = makeAgent();
  agent.streamSpeed = 1;
  const run = agent.submit('explain this codebase');
  const queued = await agent.submit('and the tests');
  assert.deepEqual(queued, { queued: true });
  assert.ok(state.blocks.some((b) => /Queued for the next turn/.test(b.text ?? '')));
  await run;
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(state.usage.turns, 2, 'the queued prompt got its own turn');
});

test('the model catalog is priced per million tokens', () => {
  for (const m of MODEL_CATALOG) {
    assert.ok(m.price.in > 0 && m.price.out > m.price.in, m.name);
    assert.ok([200000, 1000000].includes(m.context), m.name);
  }
  const { agent, state } = makeAgent();
  agent.state.model = MODEL_CATALOG.find((m) => m.id === 'haiku');
  agent.tokens(1000);
  assert.ok(Math.abs(state.usage.cost - agent.state.model.price.out / 1000) < 1e-9, 'output tokens cost the out rate');
});
