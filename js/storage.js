/**
 * storage.js — localStorage persistence with quota + privacy guards.
 *
 * Only URLs and parameters are persisted, never image bytes: a 4K PNG would
 * blow the 5 MB budget immediately, and the provider caches by
 * (prompt + seed + params) so re-fetching is cheap and reproducible.
 */

import { STORAGE_KEYS, MAX_HISTORY, sanitizeState } from './config.js';

function safeGet(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadState(storage = globalThis.localStorage) {
  const raw = safeGet(storage, STORAGE_KEYS.state);
  if (!raw) return null;
  try {
    return sanitizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  return safeSet(storage, STORAGE_KEYS.state, JSON.stringify(state));
}

export function loadHistory(storage = globalThis.localStorage) {
  const raw = safeGet(storage, STORAGE_KEYS.history);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object' && item.id).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function saveHistory(history, storage = globalThis.localStorage) {
  const trimmed = history.slice(0, MAX_HISTORY);
  const ok = safeSet(storage, STORAGE_KEYS.history, JSON.stringify(trimmed));
  if (ok) return trimmed;
  // Quota hit: halve the history and try again before giving up.
  let fallback = trimmed;
  while (fallback.length > 4) {
    fallback = fallback.slice(0, Math.ceil(fallback.length / 2));
    if (safeSet(storage, STORAGE_KEYS.history, JSON.stringify(fallback))) return fallback;
  }
  safeSet(storage, STORAGE_KEYS.history, JSON.stringify(fallback.slice(0, 4)));
  return fallback.slice(0, 4);
}

export function addHistoryItem(item, storage = globalThis.localStorage) {
  const history = loadHistory(storage);
  const next = [{ ...item }, ...history.filter((h) => h.id !== item.id)];
  return saveHistory(next, storage);
}

export function removeHistoryItem(id, storage = globalThis.localStorage) {
  return saveHistory(loadHistory(storage).filter((h) => h.id !== id), storage);
}

export function clearHistory(storage = globalThis.localStorage) {
  safeRemove(storage, STORAGE_KEYS.history);
  return [];
}

export function loadTheme(storage = globalThis.localStorage) {
  const t = safeGet(storage, STORAGE_KEYS.theme);
  if (t === 'light' || t === 'dark') return t;
  try {
    return globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme, storage = globalThis.localStorage) {
  return safeSet(storage, STORAGE_KEYS.theme, theme);
}

/**
 * Shareable link: state travels in the query string so a generation can be
 * reopened with every knob where it was.
 */
export function stateToQuery(state) {
  const p = new URLSearchParams();
  if (state.prompt) p.set('p', state.prompt);
  if (state.avoid) p.set('avoid', state.avoid);
  if (state.stylePreset && state.stylePreset !== 'none') p.set('style', state.stylePreset);
  p.set('m', state.model);
  p.set('r', state.resolution);
  p.set('a', state.aspect);
  if (state.aspect === 'custom') {
    p.set('w', String(state.width));
    p.set('h', String(state.height));
  }
  if (state.seed !== null && state.seed !== undefined) p.set('s', String(state.seed));
  if (state.batch > 1) p.set('n', String(state.batch));
  if (!state.enhance) p.set('enh', '0');
  if (state.safe) p.set('safe', '1');
  if (state.refs?.length) p.set('ref', state.refs.join('|'));
  if (state.mock) p.set('mock', '1');
  const q = p.toString();
  return q ? `?${q}` : '';
}

const QUERY_ALIASES = {
  prompt: 'p',
  model: 'm',
  resolution: 'r',
  aspect: 'a',
  width: 'w',
  height: 'h',
  seed: 's',
  batch: 'n',
  stylePreset: 'style',
  token: 't',
};

export function queryToState(search, baseState) {
  const p = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  // Short keys are what we emit; long names are accepted so hand-written links work.
  const longFor = Object.fromEntries(Object.entries(QUERY_ALIASES).map(([long, short]) => [short, long]));
  const read = (short) => {
    const direct = p.get(short);
    if (direct !== null) return direct;
    const long = longFor[short];
    return long ? p.get(long) : null;
  };
  const has = (short) => read(short) !== null;
  const next = { ...baseState };
  if (has('p')) next.prompt = read('p');
  if (has('avoid')) next.avoid = read('avoid');
  if (has('style')) next.stylePreset = read('style');
  if (has('m')) next.model = read('m');
  if (has('r')) next.resolution = read('r');
  if (has('a')) next.aspect = read('a');
  if (has('w')) next.width = Number(read('w'));
  if (has('h')) next.height = Number(read('h'));
  if (has('t')) next.token = read('t');
  if (has('s')) {
    const seed = Number(read('s'));
    if (Number.isInteger(seed) && seed >= 0) {
      next.seed = seed;
      next.lockSeed = true;
    }
  }
  if (has('n')) next.batch = Number(read('n'));
  if (read('enh') === '0' || p.get('enhance') === '0') next.enhance = false;
  if (p.get('safe') === '1') next.safe = true;
  const refs = p.get('ref') ?? p.get('refs');
  if (refs) next.refs = String(refs).split('|').filter(Boolean);
  if (p.get('mock') === '1') next.mock = true;
  else if (p.get('mock') === '0') next.mock = false;
  return sanitizeState(next);
}
