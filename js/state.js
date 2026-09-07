/**
 * state.js — minimal observable store. No framework, no virtual DOM: controls
 * write into the store, the store re-renders the parts that changed, and the
 * URL + localStorage stay in sync from a single place.
 */

export function createStore(initialState = {}, { onChange } = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  const commit = (next, meta) => {
    const prev = state;
    state = typeof next === 'function' ? { ...state, ...next(state) } : { ...state, ...next };
    if (onChange) onChange(state, prev, meta);
    for (const fn of [...listeners]) fn(state, prev, meta);
  };

  return {
    get state() {
      return state;
    },
    set(patch, meta) {
      const diff = typeof patch === 'function' ? patch(state) : patch;
      const changed = Object.entries(diff || {}).filter(([k, v]) => state[k] !== v);
      if (!changed.length) return;
      commit(Object.fromEntries(changed), meta);
    },
    replace(next, meta) {
      commit(next, meta);
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(state, state, { type: 'init' });
      return () => listeners.delete(fn);
    },
  };
}
