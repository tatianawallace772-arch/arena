/**
 * Spinner chrome: braille-ish sparkle frames and the whimsical verb list shown while the
 * agent works. Kept apart from the renderer so the Agent can name a status without
 * importing any drawing code.
 */
export const SPINNER_FRAMES = ['·', '✢', '✣', '✤', '✥', '✦', '✧', '✢', '✣', '✤', '✥', '✦', '✧', ''];

export const VERBS = [
  'Accomplishing', 'Apprehending', 'Booping', 'Bootstrapping', 'Bouncing', 'Braiding', 'Calculating',
  'Charting', 'Cogitating', 'Computing', 'Concocting', 'Considering', 'Cooking', 'Crafting', 'Crunching',
  'Deciphering', 'Deliberating', 'Determining', 'Divining', 'Enchanting', 'Envisioning', 'Finagling',
  'Forging', 'Formulating', 'Frolicking', 'Generating', 'Hatching', 'Herding', 'Hovering', 'Ideating',
  'Manifesting', 'Mulling', 'Mustering', 'Noodling', 'Percolating', 'Philosophizing', 'Pontificating',
  'Pondering', 'Processing', 'Perusing', 'Recruiting', 'Reticulating', 'Ruminating', 'Schlepping',
  'Shucking', 'Simmering', 'Smooshing', 'Spelunking', 'Synthesizing', 'Thinking', 'Tinkering',
  'Transmuting', 'Unfurling', 'Vibing', 'Wrangling',
];

export const SPARKS = ['✻', '✻', '✽', '✻', '※', '✻'];

export function spinnerFrame(tick) {
  return SPINNER_FRAMES[Math.abs(tick | 0) % SPINNER_FRAMES.length] || '·';
}

function hash(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 131 + ch.charCodeAt(0)) | 0;
  return h;
}

export function pickVerb(seed = Date.now()) {
  return VERBS[Math.abs(hash(seed)) % VERBS.length];
}

/** Closing line for a finished turn, e.g. "✻ Cogitated for 4s". */
export function finishLine(seconds) {
  const past = [
    'Accomplished', 'Booped', 'Brewed', 'Calculating', 'Churned', 'Cogitated', 'Concocted', 'Cooked',
    'Crunched', 'Deciphered', 'Deliberated', 'Divined', 'Envisioned', 'Forged', 'Hatched', 'Ideated',
    'Manifested', 'Mustered', 'Noodled', 'Percolated', 'Processed', 'Ruminated', 'Simmered', 'Synthesized',
    'Thought', 'Tinkered', 'Transmuted', 'Wrangled',
  ];
  return past[Math.abs(hash(seconds)) % past.length];
}

/** Turns per minute-ish pacing for the "s" suffix. */
export function fmtElapsed(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
