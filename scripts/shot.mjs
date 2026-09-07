/**
 * scripts/shot.mjs — optional visual smoke test.
 *
 * Renders the running app in headless Chromium and writes PNGs to .shots/ so a
 * human (or the agent) can look at the result. Uses `puppeteer` if a matching
 * browser is installed, otherwise falls back to @sparticuz/chromium +
 * puppeteer-core, and finally skips cleanly.
 *
 *   node server.js &   # then
 *   node scripts/shot.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = '.shots';
const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:3000/';

async function resolveBrowser() {
  try {
    const puppeteer = (await import('puppeteer')).default;
    return { puppeteer, opts: { args: ['--no-sandbox'] } };
  } catch {
    /* full puppeteer not installed */
  }
  try {
    const [{ default: puppeteer }, { default: chromium }] = await Promise.all([import('puppeteer-core'), import('@sparticuz/chromium')]);
    const executablePath = await chromium.executablePath();
    return {
      puppeteer,
      opts: { executablePath, args: [...(chromium.args || []), '--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' },
    };
  } catch (err) {
    console.log(`SKIP: no headless browser available (${err.message})`);
    return null;
  }
}

const resolved = await resolveBrowser();
if (!resolved) process.exit(0);

await mkdir(OUT, { recursive: true });
const { puppeteer, opts } = resolved;
const browser = await puppeteer.launch({ ...opts, protocolTimeout: 90000 });
const page = await browser.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
});
page.on('requestfailed', (r) => {
  const u = r.url();
  if (!u.includes('image.pollinations.ai')) problems.push(`requestfailed: ${u}`);
});

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(name, url, { width = 1440, height = 1000, wait = 800, steps } = {}) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => problems.push(`nav: ${e.message}`));
  await settle(wait);
  if (steps) await steps(page).catch((e) => problems.push(`steps: ${e.message}`));
  const buf = await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  if (buf) await writeFile(join(OUT, `${name}.png`), buf);
  return page;
}

// 1) first run, nothing rendered yet
await shot('01-dark-empty', `${BASE}?fresh=1`);

// 2) a queued mock batch (2 images, 16:9, cinematic style)
await shot('02-dark-mock-batch', `${BASE}?fresh=1&mock=1`, {
  steps: async (p) => {
    await p.evaluate(() => {
      const nb = globalThis.NanoBanana;
      nb.store.set({ prompt: 'a lone fisherman mending a net at blue hour', stylePreset: 'cinematic', batch: 2, resolution: '1K', aspect: '16:9' });
      nb.startGeneration();
    });
    await settle(2600);
  },
});

// 3) light theme with a single portrait result
await shot('03-light-result', `${BASE}?fresh=1&mock=1&p=neon%20tokyo%20alley%20in%20the%20rain&style=photo&a=3:4&s=7`, {
  steps: async (p) => {
    await p.click('#themeBtn');
    await p.evaluate(() => globalThis.NanoBanana.startGeneration());
    await settle(2200);
  },
});

// 4) phone viewport, expanded controls
await shot('04-mobile', `${BASE}?fresh=1&mock=1&p=macro%20of%20a%20dewdrop%20on%20a%20leaf`, { width: 390, height: 844, wait: 1200 });

// 5) history strip + library populated
await shot('05-history', `${BASE}?fresh=1&mock=1`, {
  steps: async (p) => {
    await p.evaluate(async () => {
      const nb = globalThis.NanoBanana;
      for (const prompt of ['isometric island with a lighthouse', 'vintage travel poster for the moon', 'a corgi in a linen suit']) {
        nb.store.set({ prompt, batch: 1 });
        nb.startGeneration();
        await new Promise((r) => setTimeout(r, 700));
      }
    });
    await settle(3600);
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await settle(300);
  },
});

// 6) help modal
await shot('06-help-modal', `${BASE}?fresh=1`, {
  steps: async (p) => {
    await p.click('#helpBtn');
    await settle(400);
  },
});

// 7) advanced panel open (edits, pacing, token)
await shot('07-advanced', `${BASE}?fresh=1&mock=1`, {
  steps: async (p) => {
    await p.evaluate(() => {
      document.getElementById('advancedCard').open = true;
      document.querySelector('[data-model="nanobanana"]').click();
    });
    await settle(300);
  },
});

const report = await page.evaluate(() => {
  const rect = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const b = n.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const cs = getComputedStyle(document.documentElement);
  return {
    bg: cs.getPropertyValue('--bg').trim(),
    text: cs.getPropertyValue('--text').trim(),
    layout: {
      topbar: rect('.topbar'),
      controls: rect('.controls'),
      stage: rect('.stage'),
      library: rect('.library'),
      history: rect('.history'),
      film: rect('.film'),
      generate: rect('#generateBtn'),
    },
    horizontalOverflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    fontFamily: getComputedStyle(document.body).fontFamily.slice(0, 40),
  };
});

console.log(JSON.stringify({ problems, report }, null, 2));
await browser.close();
