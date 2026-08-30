/**
 * Headless driver for the App: a fake terminal that captures writes, plus helpers to
 * settle turns and auto-answer permission prompts. Shared by the integration test and
 * the visual scratch script.
 */
import { App } from '../../src/tui/app.js';

const live = [];

/** Anything built by the harness, so a failed test cannot leave a paint timer running. */
export function disposeAll() {
  while (live.length) live.pop().dispose();
}

export function createHarness({ rows = 34, cols = 104, speed = 5000, ...rest } = {}) {
  const writes = [];
  const app = new App({
    write: (data) => writes.push(data),
    size: () => ({ rows, cols }),
    speed,
    onExport: () => {},
    ...rest,
  });
  app.agent.streamSpeed = speed;
  live.push(app);
  app.start();
  return {
    app,
    writes,
    frame: () => app.screen.toText(),
    keys: (str) => {
      for (const ch of str) app.handleData(ch === '\n' ? '\r' : ch);
    },
    press: (data) => app.handleData(data),
    dispose: () => {
      const i = live.indexOf(app);
      if (i >= 0) live.splice(i, 1);
      app.dispose();
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

/** Wait for the agent to finish, answering any permission prompt with option `answer`. */
export async function settle(app, { answer = '\r', timeout = 10000, onDialog } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (app.state.dialog) {
      if (onDialog) onDialog(app.state.dialog, app);
      else app.handleData(answer);
      await new Promise((r) => setTimeout(r, 2));
      continue;
    }
    if (app.state.phase === 'idle' && !app.agent.running) return true;
    await new Promise((r) => setTimeout(r, 4));
  }
  throw new Error(`settle timed out: phase=${app.state.phase} dialog=${app.state.dialog?.type ?? 'none'} running=${app.agent.running}`);
}

export async function boot(h) {
  h.keys('claude');
  h.press('\r');
  await new Promise((r) => setTimeout(r, 420));
  await settle(h.app);
}
