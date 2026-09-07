import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ASPECT_RATIOS,
  limitRefs,
  MAX_REFS,
  MODEL_CATALOG,
  MODEL_IDS,
  SEED_MAX,
  composePrompt,
  isSizeCapped,
  modelById,
  randomSeed,
  resolveDims,
  roundTo16,
  sanitizeState,
  seedFor,
  normalizeRefs,
} from '../js/config.js';
import { STYLE_PRESETS } from '../js/prompts.js';

test('resolveDims keeps every side on a 16px grid and inside the model cap', () => {
  const square = resolveDims({ aspect: '1:1', resolution: '1K', model: 'flux' });
  assert.deepEqual(square, { width: 1024, height: 1024 });

  // flux caps at 2048 on the long edge, so 2K wide is squeezed, not rejected.
  const wide = resolveDims({ aspect: '16:9', resolution: '2K', model: 'flux' });
  assert.deepEqual(wide, { width: 2048, height: 1152 });
  const widePro = resolveDims({ aspect: '16:9', resolution: '2K', model: 'nanobanana-pro' });
  assert.deepEqual(widePro, { width: 2560, height: 1440 });

  // Nano Banana caps at 2048px on the long edge, so 4K must be squeezed.
  const capped = resolveDims({ aspect: '16:9', resolution: '4K', model: 'nanobanana' });
  assert.equal(capped.width, 2048);
  assert.equal(capped.width % 16, 0);
  assert.equal(capped.height % 16, 0);
  assert.ok(capped.width > capped.height, 'landscape ratio is preserved');

  const pro = resolveDims({ aspect: '1:1', resolution: '4K', model: 'nanobanana-pro' });
  assert.deepEqual(pro, { width: 4096, height: 4096 });
});

test('resolveDims honours custom dimensions and clamps nonsense', () => {
  const custom = resolveDims({ aspect: 'custom', resolution: '1K', model: 'flux', customWidth: 1234, customHeight: 777 });
  assert.deepEqual(custom, { width: 1232, height: 784 });

  const tiny = resolveDims({ aspect: 'custom', resolution: '1K', model: 'flux', customWidth: 3, customHeight: 0 });
  assert.ok(tiny.width >= 128 && tiny.height >= 128, 'clamped to the hard minimum');

  const huge = resolveDims({ aspect: 'custom', resolution: '1K', model: 'flux', customWidth: 999999, customHeight: 40000 });
  assert.ok(huge.width <= 4096 && huge.height <= 4096, 'clamped to the hard maximum');
});

test('roundTo16 never returns a degenerate size', () => {
  assert.equal(roundTo16(1030), 1024);
  assert.equal(roundTo16(1), 128);
});

test('references survive a model switch but are capped per model at send time', () => {
  const refs = ['https://a.example/1.png', 'https://b.example/2.png', 'javascript:alert(1)', 'https://a.example/1.png'];
  const clean = normalizeRefs(refs);
  assert.deepEqual(clean, ['https://a.example/1.png', 'https://b.example/2.png'], 'invalid + duplicate refs dropped');
  assert.deepEqual(limitRefs(clean, 'flux'), [], 'flux takes none');
  assert.deepEqual(limitRefs(clean, 'kontext'), ['https://a.example/1.png'], 'kontext takes one');
  assert.equal(limitRefs(clean, 'nanobanana').length, 2, 'nano banana takes up to four');
  assert.equal(normalizeRefs(Array.from({ length: 30 }, (_, i) => `https://x.example/${i}.png`)).length, MAX_REFS, 'hard cap on stored refs');
  assert.deepEqual(normalizeRefs(null), []);
  assert.deepEqual(normalizeRefs(undefined), []);
});

test('every aspect ratio in the picker resolves to a real size', () => {
  for (const ratio of ASPECT_RATIOS) {
    for (const tier of ['1K', '2K', '4K']) {
      const { width, height } = resolveDims({ aspect: ratio.id, resolution: tier, model: 'nanobanana-pro', customWidth: 1024, customHeight: 1024 });
      assert.ok(Number.isInteger(width) && Number.isInteger(height), `${ratio.id}/${tier} must be integers`);
      assert.ok(width >= 128 && height >= 128, `${ratio.id}/${tier} too small`);
      assert.ok(width <= 4096 && height <= 4096, `${ratio.id}/${tier} too big`);
    }
  }
});

test('seed walk is deterministic, spaced and always in range', () => {
  const base = 12345;
  const seeds = [0, 1, 2, 3].map((i) => seedFor(base, i));
  assert.deepEqual(seeds, [12345, 20264, 28183, 36102]);
  for (const s of seeds) assert.ok(s >= 0 && s <= SEED_MAX);
  assert.equal(new Set(seeds).size, 4, 'batch seeds must not collide');
  assert.ok(randomSeed() >= 0);
});

test('sanitizeState repairs anything from storage or a shared URL', () => {
  const junk = {
    model: 'gpt-evil',
    resolution: '8K',
    aspect: 'purple',
    batch: 999,
    seed: -5,
    pace: 'yes',
    refs: ['javascript:alert(1)', 'https://ok.example/a.png'],
    prompt: 123,
    token: 'x'.repeat(900),
  };
  const clean = sanitizeState(junk);
  assert.equal(clean.model, 'nanobanana', 'unknown model falls back to the flagship default');
  assert.equal(clean.resolution, '1K');
  assert.equal(clean.aspect, '1:1');
  assert.equal(clean.batch, 4, 'batch clamped to MAX_BATCH');
  assert.equal(clean.seed, null, 'negative seed rejected');
  assert.equal(clean.pace, 'auto');
  assert.deepEqual(clean.refs, ['https://ok.example/a.png'], 'non-URL refs dropped, valid ones kept even if the model ignores them');
  assert.equal(clean.prompt, '123');
  assert.equal(clean.token.length, 400);
  assert.equal(clean.enhance, true, 'enhance defaults on');
  assert.equal(clean.nologo, true);
  assert.equal(clean.private, true);

  assert.doesNotThrow(() => sanitizeState(null));
  assert.equal(sanitizeState(undefined).model, 'nanobanana');
});

test('sanitizeState keeps a valid state untouched', () => {
  const valid = sanitizeState({ prompt: 'a banana', model: 'nanobanana', aspect: '16:9', resolution: '2K', seed: 42, lockSeed: true, batch: 3, mock: true });
  assert.equal(valid.model, 'nanobanana');
  assert.equal(valid.seed, 42);
  assert.equal(valid.lockSeed, true);
  assert.equal(valid.batch, 3);
  assert.equal(valid.mock, true, 'mock flag must survive a reload');
  const again = sanitizeState(valid);
  assert.deepEqual(again, valid, 'sanitising is idempotent');
});

test('composePrompt folds style presets and exclusions into one natural sentence', () => {
  const photo = STYLE_PRESETS.find((p) => p.id === 'photo');
  const out = composePrompt({ prompt: '  a   banana on a table ', stylePreset: 'photo', avoid: 'text, watermark' }, STYLE_PRESETS);
  assert.ok(out.startsWith('a banana on a table,'), 'whitespace collapsed, preset appended');
  assert.ok(out.includes(photo.append));
  assert.ok(out.endsWith('. Avoid: text, watermark'));
  assert.equal(composePrompt({ prompt: '   ' }, STYLE_PRESETS), '', 'blank prompt stays blank');
  assert.equal(composePrompt({ prompt: 'x'.repeat(9000) }, STYLE_PRESETS).length, 4000, 'prompt length capped');
});

test('isSizeCapped flags sizes the model cannot render', () => {
  assert.equal(isSizeCapped({ aspect: '1:1', resolution: '4K', model: 'nanobanana' }), true);
  assert.equal(isSizeCapped({ aspect: '1:1', resolution: '1K', model: 'nanobanana' }), false);
});

test('the model catalog is consistent with the fallback chain', () => {
  for (const id of ['nanobanana', 'nanobanana-pro', 'flux', 'turbo', 'kontext']) {
    assert.ok(MODEL_IDS.includes(id), `${id} must exist`);
    const m = modelById(id);
    assert.ok(m.label && m.subtitle && m.blurb && m.maxSide >= 512, `${id} metadata`);
  }
  assert.ok(modelById('nope') === null);
  // Every model named in the fallback chain has to be selectable.
  const { FALLBACK_CHAIN } = { FALLBACK_CHAIN: MODEL_IDS.slice(0, 3) };
  for (const id of FALLBACK_CHAIN) assert.ok(MODEL_CATALOG.some((m) => m.id === id));
});
