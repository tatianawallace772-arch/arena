/**
 * config.js — provider contract, model catalog, sizing maths and pure state
 * sanitising. This module is intentionally free of DOM and network access so
 * it can be unit tested in plain Node (see tests/).
 */

export const APP_NAME = 'Nano Banana Studio';
export const APP_TAGLINE = 'Keyless AI image generation · powered by Gemini Nano Banana via Pollinations';

/** Keyless endpoints. Everything here works with zero API key / signup. */
export const PROVIDER = {
  id: 'pollinations',
  label: 'Pollinations.AI (keyless)',
  imageBase: 'https://image.pollinations.ai/prompt/',
  modelsEndpoint: 'https://image.pollinations.ai/models',
  docs: 'https://github.com/pollinations/pollinations/blob/master/APIDOCS.md',
  /** Anonymous tier is documented at ~1 request / 15s and may be watermarked. */
  anonMinIntervalMs: 15_000,
  referrer: 'nano-banana-studio',
};

/** Models we know the image endpoint validates. `premium` = usually key-gated. */
export const MODEL_CATALOG = [
  {
    id: 'nanobanana',
    label: 'Nano Banana',
    subtitle: 'Gemini 2.5 Flash Image',
    blurb: 'Fast, superb prompt adherence, great at edits and text-in-image.',
    maxSide: 2048,
    references: 4,
    premium: true,
  },
  {
    id: 'nanobanana-pro',
    label: 'Nano Banana Pro',
    subtitle: 'Gemini 3 Pro Image',
    blurb: 'Highest photorealism and sharp typography. Renders up to 4K, slower.',
    maxSide: 4096,
    references: 8,
    premium: true,
  },
  {
    id: 'flux',
    label: 'Flux',
    subtitle: 'FLUX.1 [dev]',
    blurb: 'Open workhorse. Always free on the keyless tier — the safe default.',
    maxSide: 2048,
    references: 0,
    premium: false,
  },
  {
    id: 'turbo',
    label: 'Turbo',
    subtitle: 'Lightning-class speed',
    blurb: 'Quickest drafts when you are iterating on composition.',
    maxSide: 1024,
    references: 0,
    premium: false,
  },
  {
    id: 'sana',
    label: 'Sana',
    subtitle: 'Efficient DiT',
    blurb: 'Lightweight alternative when the flagship models are saturated.',
    maxSide: 1024,
    references: 0,
    premium: false,
  },
  {
    id: 'kontext',
    label: 'Kontext Edit',
    subtitle: 'Image-to-image',
    blurb: 'Transform a reference image with a text instruction.',
    maxSide: 1536,
    references: 1,
    premium: false,
  },
];

/**
 * Order we walk when a model is unavailable for anonymous callers. The
 * provider returns 4xx "invalid model / upgrade tier" errors for gated models;
 * instead of showing a dead end we silently retry the next entry.
 */
export const FALLBACK_CHAIN = ['nanobanana', 'nanobanana-pro', 'flux', 'turbo', 'sana'];

export const MODEL_IDS = MODEL_CATALOG.map((m) => m.id);

export function modelById(id) {
  return MODEL_CATALOG.find((m) => m.id === id) || null;
}

export function modelLabel(id) {
  return modelById(id)?.label || id;
}

export const RESOLUTION_TIERS = [
  { id: '1K', scale: 1, note: 'draft · ~1 MP' },
  { id: '2K', scale: 2, note: 'HD · ~4 MP' },
  { id: '4K', scale: 4, note: 'print · Pro only' },
];

/** Base pairs live at the 1K tier; every side is a multiple of 16. */
export const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square', w: 1024, h: 1024 },
  { id: '3:2', label: 'Photo', w: 1248, h: 832 },
  { id: '2:3', label: 'Portrait', w: 832, h: 1248 },
  { id: '4:3', label: 'Classic', w: 1152, h: 864 },
  { id: '3:4', label: 'Book', w: 864, h: 1152 },
  { id: '16:9', label: 'Wide', w: 1280, h: 720 },
  { id: '9:16', label: 'Story', w: 720, h: 1280 },
  { id: '4:5', label: 'Social', w: 896, h: 1120 },
  { id: '5:4', label: 'Landscape', w: 1120, h: 896 },
  { id: '21:9', label: 'Cinema', w: 1344, h: 576 },
  { id: 'custom', label: 'Custom', w: 1024, h: 1024 },
];

export const ASPECT_IDS = ASPECT_RATIOS.map((a) => a.id);

export const HARD_MAX_SIDE = 4096;
export const HARD_MIN_SIDE = 128;

/** Pace presets for the local throttle that keeps us inside the free tier. */
export const PACE_OPTIONS = [
  { id: 'auto', intervalMs: PROVIDER.anonMinIntervalMs, label: 'Auto (15s)', note: 'Matches the anonymous tier — no 429s.' },
  { id: 'fast', intervalMs: 5_000, label: 'Turbo (5s)', note: 'Seed-tier spacing. May need a retry or two.' },
  { id: 'off', intervalMs: 0, label: 'Off', note: 'Fire when ready; back off only after a real 429.' },
];

export const MAX_BATCH = 4;
export const MAX_HISTORY = 60;
export const GENERATE_TIMEOUT_MS = 150_000;
export const MAX_ATTEMPTS = 3;

export const STORAGE_KEYS = {
  state: 'nbs:state:v1',
  history: 'nbs:history:v1',
  theme: 'nbs:theme',
};

export const SEED_MAX = 2_147_483_647;

/** The flagship is the default; FALLBACK_CHAIN keeps it working if gated. */
export const DEFAULT_MODEL = 'nanobanana';
export const DEFAULT_ASPECT = '1:1';
export const DEFAULT_RESOLUTION = '1K';

/* ------------------------------------------------------------------ helpers */

export function isInt(value) {
  return Number.isFinite(value) && Number.isInteger(value);
}

export function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Diffusion backends prefer dimensions on a 16px grid. */
export function roundTo16(n) {
  return Math.max(HARD_MIN_SIDE, Math.round(n / 16) * 16);
}

export function randomSeed() {
  return Math.floor(Math.random() * SEED_MAX);
}

/** Deterministic seed walk so a batch never collides but stays reproducible. */
export function seedFor(baseSeed, index) {
  return (baseSeed + index * 7919) % SEED_MAX;
}

/**
 * Resolve the pixel dimensions for a ratio + tier, respecting the model cap.
 * Returns {width, height} with both sides multiples of 16.
 */
export function resolveDims({
  aspect = '1:1',
  resolution = '1K',
  model = 'flux',
  customWidth,
  customHeight,
} = {}) {
  const ratio = ASPECT_RATIOS.find((a) => a.id === aspect) || ASPECT_RATIOS[0];
  const tier = RESOLUTION_TIERS.find((t) => t.id === resolution) || RESOLUTION_TIERS[0];
  const maxSide = Math.min(modelById(model)?.maxSide || HARD_MAX_SIDE, HARD_MAX_SIDE);

  let w;
  let h;
  if (ratio.id === 'custom') {
    w = clampInt(customWidth, HARD_MIN_SIDE, HARD_MAX_SIDE, 1024);
    h = clampInt(customHeight, HARD_MIN_SIDE, HARD_MAX_SIDE, 1024);
  } else {
    w = ratio.w * tier.scale;
    h = ratio.h * tier.scale;
  }

  // Clamp the longest edge to whatever the model can actually render.
  const longest = Math.max(w, h);
  if (longest > maxSide) {
    const k = maxSide / longest;
    w *= k;
    h *= k;
  }
  return { width: roundTo16(w), height: roundTo16(h) };
}

export const MAX_REFS = 8;

/** Validate reference URLs. Model-specific caps happen at request time. */
export function normalizeRefs(refs) {
  const seen = new Set();
  return (Array.isArray(refs) ? refs : [])
    .map((r) => String(r || '').trim())
    .filter((r) => {
      if (!/^(https?:)?\/\//i.test(r) && !/^data:image\//i.test(r)) return false;
      if (seen.has(r)) return false;
      seen.add(r);
      return true;
    })
    .slice(0, MAX_REFS);
}

/** How many of the user's references the selected model will actually read. */
export function limitRefs(refs, model) {
  const limit = modelById(model)?.references ?? 0;
  return normalizeRefs(refs).slice(0, limit);
}

/**
 * Clamp anything that came from localStorage or a shared URL: that data is
 * untrusted and may have been written by an older build.
 */
export function sanitizeState(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const model = MODEL_IDS.includes(s.model) ? s.model : DEFAULT_MODEL;
  const resolution = RESOLUTION_TIERS.some((t) => t.id === s.resolution) ? s.resolution : DEFAULT_RESOLUTION;
  const aspect = ASPECT_IDS.includes(s.aspect) ? s.aspect : DEFAULT_ASPECT;
  const dims = resolveDims({ aspect, resolution, model, customWidth: s.width, customHeight: s.height });

  return {
    prompt: String(s.prompt ?? '').slice(0, 4000),
    avoid: String(s.avoid ?? '').slice(0, 500),
    stylePreset: String(s.stylePreset ?? 'none'),
    model,
    resolution,
    aspect,
    width: clampInt(s.width, HARD_MIN_SIDE, HARD_MAX_SIDE, dims.width),
    height: clampInt(s.height, HARD_MIN_SIDE, HARD_MAX_SIDE, dims.height),
    seed: isInt(s.seed) && s.seed >= 0 && s.seed <= SEED_MAX ? s.seed : null,
    lockSeed: Boolean(s.lockSeed),
    batch: clampInt(s.batch, 1, MAX_BATCH, 1),
    enhance: s.enhance !== false,
    nologo: s.nologo !== false,
    safe: Boolean(s.safe),
    private: s.private !== false,
    pace: PACE_OPTIONS.some((p) => p.id === s.pace) ? s.pace : 'auto',
    refs: normalizeRefs(s.refs),
    token: String(s.token ?? '').slice(0, 400),
    /** Local deterministic renderer — lets the whole app run with no network. */
    mock: Boolean(s.mock),
  };
}

/** True when the requested tier is bigger than the model can render. */
export function isSizeCapped({ aspect = '1:1', resolution = '1K', model = 'flux', customWidth, customHeight } = {}) {
  const uncapped = resolveDims({ aspect, resolution, model: 'unlimited', customWidth, customHeight });
  const capped = resolveDims({ aspect, resolution, model, customWidth, customHeight });
  return uncapped.width !== capped.width || uncapped.height !== capped.height;
}

/** Compose the final prompt text sent to the model. */
export function composePrompt({ prompt = '', stylePreset = 'none', avoid = '' } = {}, presets = []) {
  const base = String(prompt).trim().replace(/\s+/g, ' ');
  if (!base) return '';
  const preset = presets.find((p) => p.id === stylePreset);
  let out = base;
  if (preset?.append) out += `, ${preset.append}`;
  if (preset?.prefix) out = `${preset.prefix}, ${out}`;
  const avoidText = String(avoid).trim();
  if (avoidText) out += `. Avoid: ${avoidText}`;
  return out.slice(0, 4000);
}

/** Max seed the selected model will accept for the current tier. */
export function maxSideFor(model) {
  return Math.min(modelById(model)?.maxSide || HARD_MAX_SIDE, HARD_MAX_SIDE);
}
