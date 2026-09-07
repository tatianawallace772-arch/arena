/**
 * queue.js — pacing + job runner.
 *
 * The anonymous tier allows roughly one request every 15 seconds, so a naive
 * UI that fires a batch of four gets three 429s. Every request therefore goes
 * through a single-slot pacer that also absorbs `retry-after` back-off.
 */

import { ProviderError, sleep } from './pollinations.js';

export class Pacer {
  constructor(intervalMs = 0) {
    this.intervalMs = Math.max(0, intervalMs | 0);
    this.nextSlotAt = 0;
    this.lastStartedAt = 0;
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of [...this.listeners]) fn(this.snapshot());
  }

  snapshot() {
    const waitMs = Math.max(0, this.nextSlotAt - Date.now());
    return { waitMs, intervalMs: this.intervalMs, cooling: waitMs > 0 };
  }

  setInterval(ms) {
    this.intervalMs = Math.max(0, ms | 0);
    if (this.intervalMs === 0) {
      // Pacing off: release anything already waiting.
      this.nextSlotAt = 0;
    } else if (this.nextSlotAt > Date.now()) {
      // A stricter pace must never push an already-scheduled job later, but a
      // looser one may pull it forward.
      const natural = (this.lastStartedAt || Date.now()) + this.intervalMs;
      this.nextSlotAt = Math.min(this.nextSlotAt, natural);
    }
    if (this.nextSlotAt < Date.now()) this.nextSlotAt = 0;
    this.notify();
  }

  /** Resolves when it is legal to fire the next request. */
  async reserve(signal) {
    const waitMs = Math.max(0, this.nextSlotAt - Date.now());
    if (waitMs > 0) await sleep(waitMs, signal);
    const now = Date.now();
    this.lastStartedAt = now;
    this.nextSlotAt = now + this.intervalMs;
    this.notify();
  }

  /** Push the next slot out (used after a 429 / retry-after). */
  backoff(ms) {
    this.nextSlotAt = Math.max(Date.now(), this.nextSlotAt, Date.now() + Math.max(0, ms | 0));
    this.notify();
  }

  reset() {
    this.nextSlotAt = 0;
    this.lastStartedAt = 0;
    this.notify();
  }
}

export class JobQueue {
  /** @param {{pacer?:Pacer,onEvent?:Function}} opts */
  constructor({ pacer, onEvent = () => {} } = {}) {
    this.pacer = pacer || new Pacer();
    this.onEvent = onEvent;
    this.controller = null;
    this.jobs = [];
    this.running = false;
  }

  get pending() {
    return this.jobs.length;
  }

  get size() {
    return this.jobs.length + (this.running ? 1 : 0);
  }

  get isBusy() {
    return this.running || this.jobs.length > 0;
  }

  /** @param {{id?:string,label?:string,run:Function,onDone?:Function,onError?:Function}} job */
  enqueue(job) {
    this.jobs.push(job);
    this.onEvent({ type: 'queued', job, size: this.size });
    this.#drain();
    return job;
  }

  cancelAll() {
    const dropped = this.jobs.length;
    this.jobs = [];
    this.controller?.abort();
    this.onEvent({ type: 'cancelled', dropped });
  }

  async #drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.jobs.length) {
        const job = this.jobs.shift();
        this.controller = new AbortController();
        const started = Date.now();
        this.onEvent({ type: 'start', job, size: this.size });
        let cancelled = false;
        try {
          await this.pacer.reserve(this.controller.signal);
          const result = await job.run(this.controller.signal);
          this.onEvent({ type: 'done', job, result, ms: Date.now() - started });
          job.onDone?.(result);
        } catch (err) {
          cancelled = err?.code === 'ABORTED' || this.controller.signal.aborted;
          this.onEvent({
            type: cancelled ? 'cancelled-job' : 'error',
            job,
            error: err instanceof ProviderError ? err : new ProviderError(String(err?.message || err), { code: 'UNKNOWN' }),
            ms: Date.now() - started,
          });
          if (!cancelled) job.onError?.(err);
        }
        if (cancelled) {
          this.jobs = [];
          this.onEvent({ type: 'cancelled', dropped: this.jobs.length });
          break;
        }
      }
    } finally {
      this.running = false;
      this.controller = null;
      this.onEvent({ type: 'idle', size: 0 });
    }
  }
}
