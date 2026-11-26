import type { CalendarEvent, EventColor, Sticker } from './types';

export const EVENT_COLORS: Record<EventColor, { label: string; dot: string; soft: string; ink: string }> = {
  peppermint: { label: 'Peppermint', dot: '#e8384f', soft: '#ffe3e6', ink: '#a3122a' },
  cocoa: { label: 'Cocoa', dot: '#8a5a3b', soft: '#f6e7da', ink: '#5c3620' },
  pine: { label: 'Pine', dot: '#2f8f5b', soft: '#ddf6e6', ink: '#17663c' },
  frosting: { label: 'Frosting', dot: '#39a8c8', soft: '#ddf2f9', ink: '#116d86' },
  sugarplum: { label: 'Sugarplum', dot: '#a259d6', soft: '#f1e2fb', ink: '#6c2a9c' },
  caramel: { label: 'Caramel', dot: '#e09321', soft: '#fdead0', ink: '#95600c' },
};

export const EVENT_COLOR_KEYS = Object.keys(EVENT_COLORS) as EventColor[];

/**
 * The character stickers. The two art stickers are cut out from the supplied
 * artwork (transparent PNGs in /public/stickers) so they can be dropped onto
 * days, the week splash and the pinboard at any size.
 */
export const ART_STICKERS: Sticker[] = [
  { id: 'nova-hero', name: 'Starr Nova — Hero Pose', kind: 'art', src: '/stickers/nova-hero.png', base: 168 },
  { id: 'nova-card', name: 'Starr Nova — Staff Pose', kind: 'art', src: '/stickers/nova-card.png', base: 152 },
  { id: 'nova-gesture', name: 'Starr Nova — Cheer Pose', kind: 'art', src: '/stickers/nova-gesture.png', base: 162 },
  { id: 'nova-candycane', name: 'Starr Nova — Peace Pose', kind: 'art', src: '/stickers/nova-candycane.png', base: 160 },
];

export const GLYPH_STICKERS: Sticker[] = [
  { id: 'ginger-bread', name: 'Gingerbread', kind: 'glyph', glyph: '🍪', base: 44 },
  { id: 'candy-cane', name: 'Candy Cane', kind: 'glyph', glyph: '🍬', base: 40 },
  { id: 'cocoa', name: 'Cocoa', kind: 'glyph', glyph: '☕', base: 40 },
  { id: 'snowflake', name: 'Snowflake', kind: 'glyph', glyph: '❄️', base: 42 },
  { id: 'star', name: 'Ginger Star', kind: 'glyph', glyph: '⭐', base: 40 },
  { id: 'gift', name: 'Gift', kind: 'glyph', glyph: '🎁', base: 42 },
  { id: 'tree', name: 'Pine Tree', kind: 'glyph', glyph: '🎄', base: 46 },
  { id: 'bell', name: 'Bell', kind: 'glyph', glyph: '🔔', base: 40 },
  { id: 'sprinkle', name: 'Sprinkles', kind: 'glyph', glyph: '✨', base: 38 },
  { id: 'bow', name: 'Ribbon Bow', kind: 'glyph', glyph: '🎀', base: 40 },
  { id: 'house', name: 'Sugar House', kind: 'glyph', glyph: '🏠', base: 42 },
  { id: 'moon', name: 'Frost Moon', kind: 'glyph', glyph: '🌙', base: 38 },
  { id: 'heart', name: 'Sugar Heart', kind: 'glyph', glyph: '💚', base: 38 },
  { id: 'pretzel', name: 'Pretzel', kind: 'glyph', glyph: '🥨', base: 40 },
  { id: 'cupcake', name: 'Cupcake', kind: 'glyph', glyph: '🧁', base: 40 },
  { id: 'mitten', name: 'Mitten', kind: 'glyph', glyph: '🧤', base: 40 },
];

export const ALL_STICKERS: Sticker[] = [...ART_STICKERS, ...GLYPH_STICKERS];

export function stickerById(id: string): Sticker | undefined {
  return ALL_STICKERS.find((s) => s.id === id);
}

export const seedEvents: CalendarEvent[] = [
  {
    id: 'ev-gingerbread-day',
    title: 'National Gingerbread Cookie Day',
    date: '2026-11-21',
    color: 'caramel',
    sticker: 'ginger-bread',
    notes: 'Bake a batch, decorate the gingerbread village, and hand out samples downtown.',
  },
  {
    id: 'ev-cocoa',
    title: 'Cocoa & Carols Night',
    date: '2026-12-04',
    time: '18:30',
    endTime: '20:30',
    color: 'cocoa',
    sticker: 'cocoa',
    notes: 'Bring the thermos. Peppermint sticks provided.',
  },
  {
    id: 'ev-village',
    title: 'Gingerbread Village Build',
    date: '2026-12-12',
    time: '10:00',
    endTime: '14:00',
    color: 'peppermint',
    sticker: 'house',
    notes: 'Royal icing, sprinkles, and a lot of patience.',
  },
  {
    id: 'ev-bakeoff',
    title: 'Cookie Swap Bake-Off',
    date: '2026-12-12',
    time: '16:00',
    color: 'sugarplum',
    sticker: 'cupcake',
  },
  {
    id: 'ev-starr-nova',
    title: 'Starr Nova Gingerbread Drop',
    date: '2026-12-19',
    time: '19:00',
    color: 'peppermint',
    sticker: 'nova-hero',
    notes: 'Gingerbread Starr Nova costume reveal + photo booth.',
  },
  {
    id: 'ev-tree',
    title: 'Tree Lighting on the Square',
    date: '2026-12-06',
    time: '17:30',
    color: 'pine',
    sticker: 'tree',
  },
  {
    id: 'ev-shopping',
    title: 'Peppermint Market',
    date: '2026-12-20',
    time: '09:00',
    endTime: '13:00',
    color: 'caramel',
    sticker: 'candy-cane',
  },
  {
    id: 'ev-eve',
    title: 'Gingerbread Eve Dinner',
    date: '2026-12-24',
    time: '18:00',
    color: 'peppermint',
    sticker: 'star',
  },
  {
    id: 'ev-gift',
    title: 'Wrap the Sticker Boxes',
    date: '2026-12-23',
    time: '20:00',
    color: 'sugarplum',
    sticker: 'gift',
  },
  {
    id: 'ev-newyear',
    title: 'Sugarplum Countdown',
    date: '2026-12-31',
    time: '22:00',
    color: 'frosting',
    sticker: 'sprinkle',
  },
  {
    id: 'ev-recipe',
    title: 'Test the Spice Ratio',
    date: '2026-11-28',
    time: '11:00',
    color: 'cocoa',
    sticker: 'pretzel',
    notes: 'More cinnamon. Always more cinnamon.',
  },
  {
    id: 'ev-mitten',
    title: 'Knit Mitten Swap',
    date: '2026-12-09',
    time: '19:30',
    color: 'frosting',
    sticker: 'mitten',
  },
  {
    id: 'ev-moon',
    title: 'Frost Moon Walk',
    date: '2026-12-02',
    time: '21:00',
    color: 'sugarplum',
    sticker: 'moon',
  },
  {
    id: 'ev-heart',
    title: 'Deliver Kindness Cookies',
    date: '2026-12-15',
    time: '15:00',
    color: 'pine',
    sticker: 'heart',
  },
];

export interface Holiday {
  date: string; // MM-DD, applies to every year
  name: string;
  glyph: string;
}

export const HOLIDAYS: Holiday[] = [
  { date: '01-01', name: "New Year's Day", glyph: '🎉' },
  { date: '02-14', name: "Valentine's Day", glyph: '💝' },
  { date: '03-17', name: "St. Patrick's Day", glyph: '🍀' },
  { date: '04-01', name: 'April Fools', glyph: '🤡' },
  { date: '05-05', name: 'Cinco de Mayo', glyph: '🌮' },
  { date: '06-21', name: 'Midsummer', glyph: '☀️' },
  { date: '07-04', name: 'Independence Day', glyph: '🎆' },
  { date: '09-22', name: 'First Day of Fall', glyph: '🍂' },
  { date: '10-31', name: 'Halloween', glyph: '🎃' },
  { date: '11-11', name: 'Veterans Day', glyph: '🎖️' },
  { date: '11-26', name: 'Thanksgiving', glyph: '🦃' },
  { date: '12-06', name: 'St. Nicholas Day', glyph: '🥾' },
  { date: '12-13', name: 'St. Lucia Day', glyph: '🕯️' },
  { date: '12-21', name: 'Winter Solstice', glyph: '❄️' },
  { date: '12-24', name: 'Christmas Eve', glyph: '🕯️' },
  { date: '12-25', name: 'Christmas Day', glyph: '🎄' },
  { date: '12-26', name: 'Boxing Day', glyph: '🎁' },
  { date: '12-31', name: "New Year's Eve", glyph: '🥂' },
];

export function holidayFor(iso: string): Holiday | undefined {
  const md = iso.slice(5);
  return HOLIDAYS.find((h) => h.date === md);
}
