import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addHistoryItem,
  clearHistory,
  loadHistory,
  loadState,
  queryToState,
  removeHistoryItem,
  saveHistory,
  saveState,
  stateToQuery,
} from '../js/storage.js';
import { MAX_HISTORY, sanitizeState } from '../js/config.js';

/** localStorage-shaped in-memory store. */
function memoryStorage({ throwAbove = Infinity } = {}) {
  const map = new Map();
  let bytes = 0;
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      bytes += String(v).length;
      if (bytes > throwAbove) throw new Error('QuotaExceededError');
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
  };
}

test('state survives a save/load round trip', () => {
  const store = memoryStorage();
  const state = sanitizeState({ prompt: 'a banana', model: 'nanobanana-pro', aspect: '21:9', resolution: '2K', seed: 99, lockSeed: true, batch: 3, mock: true });
  assert.equal(saveState(state, store), true);
  assert.deepEqual(loadState(store), state);
});

test('corrupt storage yields null instead of throwing at boot', () => {
  const store = memoryStorage();
  store.setItem('nbs:state:v1', '{not json');
  assert.equal(loadState(store), null);
  store.setItem('nbs:history:v1', 'null');
  assert.deepEqual(loadHistory(store), []);
  assert.deepEqual(loadHistory({ getItem: () => { throw new Error('blocked'); } }), []);
  assert.equal(loadState({ getItem: () => { throw new Error('private mode'); } }), null);
});

test('history adds newest-first, dedupes by id and caps at MAX_HISTORY', () => {
  const store = memoryStorage();
  let list = [];
  for (let i = 0; i < MAX_HISTORY + 12; i += 1) {
    list = addHistoryItem({ id: `h${i}`, prompt: `p${i}`, seed: i }, store);
  }
  assert.equal(list.length, MAX_HISTORY);
  assert.equal(list[0].prompt, `p${MAX_HISTORY + 11}`, 'newest first');
  list = addHistoryItem({ id: 'h77', prompt: 'updated' }, store);
  assert.equal(list[0].prompt, 'updated');
  assert.equal(list.filter((h) => h.id === 'h77').length, 1, 'no duplicates by id');

  const removed = removeHistoryItem('h78', store);
  assert.equal(removed.find((h) => h.id === 'h78'), undefined);
  assert.deepEqual(clearHistory(store), []);
  assert.deepEqual(loadHistory(store), []);
});

test('history trims itself when the storage quota is hit', () => {
  // Quota is exceeded almost immediately: the writer must shrink, not throw.
  const store = memoryStorage({ throwAbove: 4200 });
  let list = [];
  for (let i = 0; i < 30; i += 1) {
    list = addHistoryItem({ id: `q${i}`, prompt: 'x'.repeat(200), seed: i }, store);
    assert.ok(Array.isArray(list), 'always returns a usable list');
  }
  assert.ok(list.length < 30, `history was trimmed to ${list.length}`);
  assert.ok(list.every((h) => h.id));
});

test('a shared link round-trips every control except the token', () => {
  const original = sanitizeState({
    prompt: 'neon tokyo alley, rain, 35mm photo',
    avoid: 'text, watermark',
    stylePreset: 'cinematic',
    model: 'nanobanana',
    resolution: '2K',
    aspect: '16:9',
    seed: 1234,
    lockSeed: true,
    batch: 4,
    enhance: false,
    safe: true,
    refs: ['https://example.com/a.png'],
    mock: true,
    token: 'sk-secret',
  });
  const query = stateToQuery(original);
  assert.ok(!query.includes('sk-secret'), 'tokens are never shared in a URL');
  const restored = queryToState(query, sanitizeState({}));
  for (const key of ['prompt', 'avoid', 'stylePreset', 'model', 'resolution', 'aspect', 'seed', 'batch', 'enhance', 'safe', 'refs', 'mock', 'lockSeed']) {
    assert.deepEqual(restored[key], original[key], `${key} must survive the link`);
  }
  assert.equal(restored.token, '', 'and the token stays behind');
});

test('a share link with no seed leaves generation unlocked', () => {
  const query = stateToQuery(sanitizeState({ prompt: 'hello', seed: null }));
  const restored = queryToState(query, sanitizeState({}));
  assert.equal(restored.seed, null);
  assert.equal(restored.lockSeed, false);
});

test('query parsing tolerates garbage and hostile values', () => {
  const garbage = queryToState('?m=bogus&r=9K&a=1:0&w=abc&h=&s=-4&n=99&ref=javascript:alert(1)|https://x.y/z.png&mock=1', sanitizeState({}));
  assert.equal(garbage.model, 'nanobanana', 'unknown models fall back to the default');
  assert.equal(garbage.resolution, '1K');
  assert.equal(garbage.aspect, '1:1');
  assert.equal(garbage.batch, 4);
  assert.equal(garbage.seed, null, 'negative seeds are dropped');
  assert.deepEqual(garbage.refs, ['https://x.y/z.png'], 'non-URL refs dropped');
  assert.equal(garbage.mock, true);
  assert.equal(queryToState('', sanitizeState({ prompt: 'keep me' })).prompt, 'keep me');
});

test('saveHistory returns the exact list it persisted', () => {
  const store = memoryStorage();
  const list = saveHistory(Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({ id: `x${i}`, seed: i })), store);
  assert.equal(list.length, MAX_HISTORY);
  assert.deepEqual(loadHistory(store).length, MAX_HISTORY);
});

test('long-form query names work as well as the short ones we emit', () => {
  const fromLong = queryToState('?prompt=a%20corgi&model=nanobanana-pro&aspect=21:9&resolution=2K&seed=9&batch=2&enhance=0&refs=https://x.y/z.png', sanitizeState({}));
  assert.equal(fromLong.prompt, 'a corgi');
  assert.equal(fromLong.model, 'nanobanana-pro');
  assert.equal(fromLong.aspect, '21:9');
  assert.equal(fromLong.resolution, '2K');
  assert.equal(fromLong.seed, 9);
  assert.equal(fromLong.batch, 2);
  assert.equal(fromLong.enhance, false);
  assert.deepEqual(fromLong.refs, ['https://x.y/z.png']);
  // A hand-written link and a generated one must agree.
  const fromShort = queryToState(stateToQuery(fromLong), sanitizeState({}));
  assert.equal(fromShort.model, fromLong.model);
  assert.equal(fromShort.seed, fromLong.seed);
  assert.equal(fromShort.aspect, fromLong.aspect);
});
