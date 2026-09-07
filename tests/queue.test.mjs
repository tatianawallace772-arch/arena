import { test } from 'node:test';
import assert from 'node:assert/strict';

import { JobQueue, Pacer } from '../js/queue.js';
import { ProviderError, sleep } from '../js/pollinations.js';

test('Pacer spaces consecutive requests by the configured interval', async () => {
  const pacer = new Pacer(60);
  const t0 = Date.now();
  await pacer.reserve();
  await pacer.reserve();
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 55, `expected a ~60ms gap, got ${elapsed}ms`);
});

test('Pacer reports the remaining wait so the UI can show a countdown', async () => {
  const pacer = new Pacer(40);
  await pacer.reserve();
  const snap = pacer.snapshot();
  assert.ok(snap.cooling, 'we are inside the cooldown window');
  assert.ok(snap.waitMs > 0 && snap.waitMs <= 40, `waitMs=${snap.waitMs}`);
  const events = [];
  const off = pacer.subscribe((s) => events.push(s.waitMs));
  pacer.backoff(30);
  assert.ok(pacer.snapshot().waitMs > 0, 'backoff pushes the next slot out');
  off();
  assert.equal(events.length, 1, 'subscribers are notified on change');
});

test('Pacer.setInterval can pull a queued slot forward but never delays a running one', () => {
  const pacer = new Pacer(200);
  pacer.nextSlotAt = Date.now() + 180;
  pacer.setInterval(0);
  assert.equal(pacer.snapshot().waitMs, 0, 'switching pace off unlocks immediately');

  const pacer2 = new Pacer(0);
  pacer2.nextSlotAt = Date.now() + 50;
  pacer2.setInterval(500);
  assert.ok(pacer2.snapshot().waitMs <= 50 + 5, 'a stricter pace does not punish the current job');
});

test('Pacer.reset clears the cooldown', async () => {
  const pacer = new Pacer(100);
  await pacer.reserve();
  assert.ok(pacer.snapshot().waitMs > 0);
  pacer.reset();
  assert.equal(pacer.snapshot().waitMs, 0);
});

test('sleep resolves after the delay and rejects on abort', async () => {
  const t0 = Date.now();
  await sleep(20);
  assert.ok(Date.now() - t0 >= 15);

  const c = new AbortController();
  const p = sleep(5000, c.signal);
  c.abort();
  await assert.rejects(p, (err) => err.code === 'ABORTED');
});

test('JobQueue runs jobs sequentially and reports progress', async () => {
  const pacer = new Pacer(0);
  const events = [];
  const seen = [];
  const queue = new JobQueue({ pacer, onEvent: (e) => events.push(e.type) });
  const jobs = [1, 2, 3].map((n) => ({
    id: `job-${n}`,
    run: async () => {
      await sleep(10);
      seen.push(n);
      return n * 10;
    },
    onDone: (result) => seen.push(result),
  }));
  jobs.forEach((j) => queue.enqueue(j));
  assert.equal(queue.isBusy, true, 'queue reports busy while running');
  await waitFor(() => !queue.isBusy);
  assert.deepEqual(seen, [1, 10, 2, 20, 3, 30], 'one job at a time: run then its result callback');
  assert.ok(events.includes('start') && events.includes('done') && events.includes('idle'));
});

test('JobQueue isolates a failing job and keeps draining', async () => {
  const queue = new JobQueue({ pacer: new Pacer(0) });
  const ok = [];
  let sawError = null;
  queue.enqueue({
    id: 'boom',
    run: async () => {
      throw new ProviderError('nope', { code: 'UPSTREAM' });
    },
    onError: (err) => {
      sawError = err;
    },
  });
  queue.enqueue({ id: 'fine', run: async () => 'y', onDone: (r) => ok.push(r) });
  await waitFor(() => !queue.isBusy);
  assert.equal(sawError.code, 'UPSTREAM', 'error surfaces to the job');
  assert.deepEqual(ok, ['y'], 'the next job still ran');
});

test('JobQueue.cancelAll drops pending work and aborts the running job', async () => {
  const queue = new JobQueue({ pacer: new Pacer(0) });
  let started = 0;
  let ran = 0;
  for (let i = 0; i < 3; i += 1) {
    queue.enqueue({
      id: `c-${i}`,
      run: async (signal) => {
        started += 1;
        await sleep(400, signal);
        ran += 1;
        return 'done';
      },
    });
  }
  await waitFor(() => started === 1);
  queue.cancelAll();
  await waitFor(() => !queue.isBusy);
  assert.equal(started, 1, 'only the in-flight job started');
  assert.equal(ran, 0, 'nothing completed');
  assert.equal(queue.pending, 0, 'pending jobs dropped');
});

test('JobQueue waits for the pacer before firing', async () => {
  const pacer = new Pacer(80);
  await pacer.reserve(); // consume the current window
  const queue = new JobQueue({ pacer });
  const t0 = Date.now();
  let fired = 0;
  queue.enqueue({ id: 'paced', run: async () => (fired = 1) });
  await waitFor(() => fired === 1, 1000);
  assert.ok(Date.now() - t0 >= 60, 'the job waited out the cooldown');
});

async function waitFor(predicate, ms = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (predicate()) return true;
    await sleep(5);
  }
  throw new Error('waitFor timed out');
}
