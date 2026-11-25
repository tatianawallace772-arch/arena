import { STICKER_MAP } from './stickers';
import { MONTHS, monthMatrix, weekdayLabels, keyOf } from './dates';
import { holidaysForYear } from './holidays';
import type { CalendarState } from './types';
import { monthKeyOf } from './types';
import { emojiSrc, type EmojiName } from '../components/Emoji';
import { stickerImageSrc } from '../components/Sticker';

const W = 2000;
const PAD = 78;

const C = {
  ink: '#3b2116',
  soft: '#7c5b4a',
  red: '#c9243f',
  redDark: '#96162c',
  green: '#1f7a48',
  gold: '#f2b233',
  goldDeep: '#d38f13',
  paper: '#fffdf8',
  cream: '#fff8ec',
  line: 'rgba(66,40,28,0.16)',
};

const F_DISPLAY = '"Baloo 2 Variable", "Baloo 2", "Trebuchet MS", sans-serif';
const F_BODY = '"Nunito Variable", Nunito, "Segoe UI", sans-serif';

export const imgCache = new Map<string, HTMLImageElement>();

function loadImage(src: string) {
  const hit = imgCache.get(src);
  if (hit) return Promise.resolve(hit);
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      imgCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function primeStickerImages() {
  const urls = new Set<string>();
  Object.values(STICKER_MAP).forEach((s) => {
    const src = stickerImageSrc(s.id);
    if (src) urls.add(src);
  });
  (['dove', 'turkey', 'pumpkin', 'tree', 'heartbox', 'clover', 'confetti', 'candle', 'fireworks', 'bunny', 'bouquet', 'medal', 'cap', 'sunface', 'tools', 'pie', 'tophat', 'star'] as EmojiName[]).forEach(
    (n) => urls.add(emojiSrc(n)),
  );
  await Promise.all([...urls].map((u) => loadImage(u)));
  await Promise.all([
    document.fonts.load(`800 90px ${F_DISPLAY}`),
    document.fonts.load(`700 24px ${F_BODY}`),
    document.fonts.load(`600 24px ${F_BODY}`),
  ]).catch(() => undefined);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      if (lines.length === maxLines) break;
      line = word;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

const drawImageFit = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
) => {
  const ratio = Math.min(size / img.width, size / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
};

export async function exportMonthImage(year: number, month: number, state: CalendarState) {
  const rows = monthMatrix(year, month, state.settings.weekStart);
  const labels = weekdayLabels(state.settings.weekStart);
  const holidayMap = holidaysForYear(year);

  let lastRow = 0;
  rows.forEach((row, i) => {
    if (row.some((d) => d.getMonth() === month)) lastRow = i;
  });
  const visible = rows.slice(0, Math.max(lastRow + 1, 5));

  const colW = (W - PAD * 2) / 7;
  const cellH = 158;
  const headerH = 262;
  const weekdayH = 50;
  const footerH = 120;
  const H = headerH + weekdayH + visible.length * (cellH + 10) + footerH + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // ---- backdrop
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#fff6e6');
  bg.addColorStop(0.5, '#ffe9ef');
  bg.addColorStop(1, '#f3edff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(201,36,63,0.10)';
  for (let x = 20; x < W; x += 32) {
    for (let y = 20; y < H; y += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- sheet
  const sx = 38;
  const sy = 30;
  const sw = W - 76;
  const sh = H - 60;
  ctx.save();
  ctx.shadowColor = 'rgba(66,40,28,0.28)';
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 20;
  roundRect(ctx, sx, sy, sw, sh, 42);
  ctx.fillStyle = C.paper;
  ctx.fill();
  ctx.restore();

  // candy-cane lace
  ctx.save();
  roundRect(ctx, sx, sy, sw, sh, 42);
  ctx.clip();
  const stripe = 30;
  for (let x = sx - 120; x < sx + sw + 120; x += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x, sy);
    ctx.lineTo(x + stripe, sy);
    ctx.lineTo(x + stripe - 34, sy + 26);
    ctx.lineTo(x - 34, sy + 26);
    ctx.closePath();
    ctx.fillStyle = C.red;
    ctx.fill();
  }
  ctx.restore();

  // ---- header text
  const monthName = MONTHS[month];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.redDark;
  ctx.font = `800 96px ${F_DISPLAY}`;
  ctx.fillText(monthName, PAD + 14, sy + 158);
  const monthW = ctx.measureText(monthName).width;
  ctx.fillStyle = C.soft;
  ctx.font = `700 40px ${F_DISPLAY}`;
  ctx.fillText(String(year), PAD + 30 + monthW, sy + 156);

  const totalStickers = countMonth(state, year, month);
  ctx.font = `700 25px ${F_BODY}`;
  ctx.fillStyle = C.soft;
  ctx.fillText(
    `${state.settings.name ? `${state.settings.name}’s` : 'A'} cozy little month · ${totalStickers} stickers tucked in`,
    PAD + 16,
    sy + 206,
  );

  // ---- mascots in the header
  const decorations = state.months[monthKeyOf(year, month)]?.decorations ?? [];
  const mascots = decorations.filter((d) => STICKER_MAP[d.sticker]?.src).slice(-3);
  const mascotImgs = await Promise.all(mascots.map((m) => loadImage(STICKER_MAP[m.sticker].src!)));
  mascotImgs.forEach((img, i) => {
    if (!img) return;
    const size = 214;
    const x = sx + sw - 170 - i * 158;
    const y = sy + 12 + (i % 2 === 0 ? 0 : 22);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((i % 2 === 0 ? -1 : 1) * 0.08);
    ctx.drawImage(img, -size / 2, 0, size, size);
    ctx.restore();
  });

  // ---- weekday row
  let y = sy + headerH - 24;
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    ctx.fillStyle = i === 0 || i === 6 ? C.red : C.soft;
    ctx.font = `800 22px ${F_DISPLAY}`;
    ctx.fillText(label.toUpperCase(), PAD + 40 + i * colW + (colW - 44) / 2, y + 22);
  });
  ctx.textAlign = 'left';

  // ---- days
  const gridTop = y + weekdayH;
  const todayKeyStr = keyOf(new Date());
  const holidayImages = await Promise.all(
    Object.values(holidayMap).map((h) => loadImage(emojiSrc(h.emoji))),
  );
  const holidayImg = new Map<EmojiName, HTMLImageElement>();
  Object.values(holidayMap).forEach((h, i) => {
    const img = holidayImages[i];
    if (img) holidayImg.set(h.emoji, img);
  });
  const stickerImgs = new Map<string, HTMLImageElement | null>();
  for (const id of Object.keys(STICKER_MAP)) {
    const src = stickerImageSrc(id);
    if (src) stickerImgs.set(id, await loadImage(src));
  }

  visible.forEach((row, r) => {
    row.forEach((date, c) => {
      const x = PAD + 20 + c * colW;
      const cy = gridTop + r * (cellH + 10);
      const key = keyOf(date);
      const inMonth = date.getMonth() === month && date.getFullYear() === year;
      const entry = state.days[key];
      const holiday = holidayMap[key];

      ctx.save();
      if (!inMonth) ctx.globalAlpha = 0.32;
      roundRect(ctx, x + 5, cy, colW - 14, cellH, 22);
      ctx.fillStyle = entry?.done ? '#e2f2e6' : inMonth ? C.cream : 'rgba(255,255,255,0.25)';
      ctx.fill();
      ctx.lineWidth = key === todayKeyStr ? 5 : 2;
      ctx.strokeStyle = key === todayKeyStr ? C.red : C.line;
      ctx.stroke();
      ctx.restore();

      if (!inMonth) return;

      // day number
      const num = String(date.getDate());
      if (key === todayKeyStr) {
        roundRect(ctx, x + 20, cy + 16, 54, 46, 15);
        ctx.fillStyle = C.red;
        ctx.fill();
        ctx.fillStyle = '#fff';
      } else {
        ctx.fillStyle = C.ink;
      }
      ctx.font = `800 30px ${F_DISPLAY}`;
      ctx.fillText(num, x + 30, cy + 50);

      // holiday marker
      let cursor = cy + 92;
      if (holiday) {
        const img = holidayImg.get(holiday.emoji);
        if (img) drawImageFit(ctx, img, x + colW - 58, cy + 14, 38);
        ctx.font = `800 19px ${F_BODY}`;
        ctx.fillStyle =
          holiday.tone === 'green' ? C.green : holiday.tone === 'gold' ? C.goldDeep : C.redDark;
        const label = holiday.short.length > 16 ? `${holiday.short.slice(0, 15)}…` : holiday.short;
        ctx.fillText(label, x + 22, cursor);
        cursor += 26;
      }

      // stickers
      const noteLines =
        state.settings.showNotes && entry?.note?.text
          ? (() => {
              ctx.font = `700 17px ${F_BODY}`;
              return fitLines(ctx, entry.note.text, colW - 54, 2);
            })()
          : [];
      const noteSpace = noteLines.length * 20;
      const stickerBottom = cy + cellH - 26 - noteSpace;
      const stickers = (entry?.stickers ?? []).slice(0, 6);
      if (stickers.length) {
        const rowSize = stickers.some((id) => STICKER_MAP[id]?.src) ? 50 : 40;
        let stx = x + 24;
        const sty = Math.min(cursor + 2, stickerBottom - rowSize);
        stickers.forEach((id) => {
          const img = stickerImgs.get(id);
          if (!img) return;
          const size = STICKER_MAP[id]?.src ? 52 : 40;
          drawImageFit(ctx, img, stx, sty - (size > 40 ? 6 : 0), size);
          stx += size - (size > 40 ? 4 : 8);
        });
      }

      // note
      if (noteLines.length) {
        ctx.font = `700 17px ${F_BODY}`;
        ctx.fillStyle = C.soft;
        noteLines.forEach((line, i) =>
          ctx.fillText(line, x + 22, cy + cellH - 42 - noteSpace + 20 + i * 20),
        );
      }

      // done check
      if (entry?.done) {
        ctx.beginPath();
        ctx.arc(x + colW - 42, cy + cellH - 30, 14, 0, Math.PI * 2);
        ctx.fillStyle = C.green;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x + colW - 49, cy + cellH - 30);
        ctx.lineTo(x + colW - 43, cy + cellH - 24);
        ctx.lineTo(x + colW - 34, cy + cellH - 37);
        ctx.stroke();
      }
    });
  });

  // ---- footer
  const footY = H - PAD + 14;
  ctx.font = `700 22px ${F_BODY}`;
  ctx.fillStyle = C.soft;
  ctx.textAlign = 'left';
  ctx.fillText(`made with Sticker Calendar · ${monthName} ${year}`, PAD + 20, footY + 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.redDark;
  ctx.fillText('sweet planning ♥', W - PAD - 20, footY + 18);
  ctx.textAlign = 'left';

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `sticker-calendar-${year}-${String(month + 1).padStart(2, '0')}.png`;
  document.body.append(a);
  a.click();
  a.remove();
  return url;
}

function countMonth(state: CalendarState, year: number, month: number) {
  let n = 0;
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d += 1) {
    n += state.days[keyOf(new Date(year, month, d))]?.stickers.length ?? 0;
  }
  return n;
}
