import type { ReactionKey, Reactions } from './types';

export const REACTIONS: Record<ReactionKey, { emoji: string; label: string; color: string }> = {
  like: { emoji: '👍', label: 'Like', color: '#2f7fe0' },
  love: { emoji: '❤️', label: 'Love', color: '#e0245e' },
  care: { emoji: '🥰', label: 'Care', color: '#f5a623' },
  haha: { emoji: '😆', label: 'Haha', color: '#f5a623' },
  wow: { emoji: '😮', label: 'Wow', color: '#f5a623' },
  sad: { emoji: '😢', label: 'Sad', color: '#f5a623' },
  angry: { emoji: '😡', label: 'Angry', color: '#e2603f' },
};

export const REACTION_ORDER: ReactionKey[] = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'];

export function totalReactions(r: Reactions): number {
  return REACTION_ORDER.reduce((n, k) => n + (r[k] ?? 0), 0);
}

export function topReactions(r: Reactions): ReactionKey[] {
  return REACTION_ORDER.filter((k) => (r[k] ?? 0) > 0)
    .sort((a, b) => (r[b] ?? 0) - (r[a] ?? 0))
    .slice(0, 3);
}

export function nfmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 >= 100 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(1, Math.floor((now - at) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 52) return `${w}w`;
  return `${Math.floor(d / 365)}y`;
}

export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function dayLabel(at: number, now = Date.now()): string {
  const a = new Date(at);
  const b = new Date(now);
  const same = (x: Date, y: Date) => x.toDateString() === y.toDateString();
  const yesterday = new Date(now - 86400000);
  if (same(a, b)) return 'Today';
  if (same(a, yesterday)) return 'Yesterday';
  return a.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export function fullDate(at: number): string {
  return new Date(at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

export const minutesAgo = (m: number) => Date.now() - m * 60_000;
export const hoursAgo = (h: number) => Date.now() - h * 3_600_000;
export const daysAgo = (d: number) => Date.now() - d * 86_400_000;

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function clampText(text: string, n = 320): { text: string; truncated: boolean } {
  if (text.length <= n) return { text, truncated: false };
  const cut = text.slice(0, n);
  return { text: cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20)) + '…', truncated: true };
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

const PALETTE = ['#c8553d', '#0f766e', '#4f46e5', '#b45309', '#7c3aed', '#0369a1', '#be123c', '#15803d'];
export function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function tint(hex: string, amt = 0.85): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function birthdayIsToday(mmdd?: string): boolean {
  if (!mmdd) return false;
  const now = new Date();
  const [m, d] = mmdd.split('-').map(Number);
  return now.getMonth() + 1 === m && now.getDate() === d;
}

export function monthDay(mmdd?: string): string {
  if (!mmdd) return '';
  const [m, d] = mmdd.split('-').map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString([], { month: 'long', day: 'numeric' });
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
