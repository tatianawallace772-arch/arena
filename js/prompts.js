/**
 * prompts.js — the style/prompt knowledge base.
 *
 * Everything here is plain text appended to (or prepended to) the user's
 * prompt. Nano Banana follows natural language well, so "style injection" is
 * legitimately just prompt engineering — no hidden API features required.
 */

export const STYLE_PRESETS = [
  { id: 'none', label: 'No style', prefix: '', append: '', hint: 'Send the prompt exactly as written.' },
  {
    id: 'photo',
    label: 'Editorial photo',
    prefix: '',
    append: 'shot on 50mm f/1.4, natural window light, shallow depth of field, editorial photography, skin texture preserved, 8K detail',
    hint: 'Lens + lighting language the model reacts to strongly.',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    prefix: '',
    append: 'cinematic still, anamorphic lens flare, teal and orange grade, volumetric haze, 2.39:1 framing, dramatic rim light',
    hint: 'Film-grade colour and blocking.',
  },
  {
    id: 'studio',
    label: 'Product studio',
    prefix: '',
    append: 'high-end product photography, seamless studio cyc, softbox lighting with crisp speculars, contact shadow, commercial retouching',
    hint: 'For objects, packs, hardware and skincare.',
  },
  {
    id: 'anime',
    label: 'Anime cel',
    prefix: '',
    append: 'modern anime key visual, clean cel shading, bold lineart, expressive eyes, dynamic composition, studio quality',
    hint: 'Stylised illustration with hard edges.',
  },
  {
    id: 'render3d',
    label: '3D render',
    prefix: '',
    append: 'octane 3D render, physically based materials, soft global illumination, subsurface scattering, isometric studio, 8K',
    hint: 'Toys, characters, abstract shapes.',
  },
  {
    id: 'watercolor',
    label: 'Watercolour',
    prefix: '',
    append: 'loose watercolour on cold-press paper, granulating pigment, visible brush edges, white space breathing, delicate palette',
    hint: 'Painterly and soft.',
  },
  {
    id: 'ink',
    label: 'Ink & hatching',
    prefix: '',
    append: 'pen and ink illustration, dense cross-hatching, high contrast black on cream paper, woodcut energy',
    hint: 'Graphic, print-like.',
  },
  {
    id: 'logo',
    label: 'Logo / mark',
    prefix: '',
    append: 'vector logo mark, geometric construction, flat colour, negative space, centred on clean background, scalable identity design',
    hint: 'Wordmarks and icons; add the exact text to render in quotes.',
  },
  {
    id: 'isometric',
    label: 'Isometric scene',
    prefix: '',
    append: 'isometric diorama, miniature tilt-shift, tidy modular layout, pastel palette, soft ambient occlusion',
    hint: 'Little worlds, maps, dashboards.',
  },
  {
    id: 'retro',
    label: 'Retro print',
    prefix: '',
    append: '1970s screen-print poster, limited palette of four inks, halftone grain, slight misregistration, vintage paper texture',
    hint: 'Nostalgic gig-poster energy.',
  },
  {
    id: 'macro',
    label: 'Macro',
    prefix: '',
    append: 'macro photography, 100mm lens, razor-thin focus plane, dewy micro-detail, dark bokeh background',
    hint: 'Texture studies: insects, food, fabric.',
  },
];

export const MOOD_TOKENS = [
  'golden hour',
  'blue hour',
  'overcast soft light',
  'neon night',
  'harsh midday sun',
  'candlelight',
  'moonlit',
  'studio butterfly light',
  'backlit silhouette',
  'stormy drama',
];

export const CAMERA_TOKENS = ['24mm wide', '35mm', '50mm', '85mm portrait', '100mm macro', 'fisheye', 'tilt-shift', 'aerial drone view'];

export const FINISH_TOKENS = ['ultra detailed', 'film grain', 'high contrast', 'pastel palette', 'monochrome', 'hyperrealistic', 'matte painting', 'soft focus'];

/** A starter gallery — every one of these renders well on Nano Banana. */
export const PROMPT_LIBRARY = [
  {
    id: 'banana-royal',
    title: 'Banana in a Vermeer',
    text: 'a single ripe banana resting on a linen cloth in a 17th century dutch interior,Vermeer style, soft window light from the left, oil painting texture, craquelure',
    tag: 'painterly',
  },
  {
    id: 'neon-market',
    title: 'Rainy night market',
    text: 'narrow tokyo alley food market at night in the rain, neon signage reflecting in puddles, steam rising from a ramen stall, candid documentary photograph, 35mm',
    tag: 'photo',
  },
  {
    id: 'botanical-type',
    title: 'Botanical type poster',
    text: 'editorial poster with the word GROW in oversized elegant serif, intertwined with monstera and fern leaves, cream paper, two-colour risograph print, generous margins',
    tag: 'design',
  },
  {
    id: 'island-map',
    title: 'Isometric island',
    text: 'isometric cutaway of a tiny fantasy island with a lighthouse, terraced farms, a harbour with fishing boats and a waterfall into the sea, playful miniature world',
    tag: '3d',
  },
  {
    id: 'product-drop',
    title: 'Product splash',
    text: 'matte black skincare bottle suspended in a slow-motion water splash, studio cyc background, crisp specular highlights, commercial beverage photography, 8K',
    tag: 'product',
  },
  {
    id: 'astronaut-garden',
    title: 'Astronaut gardener',
    text: 'an astronaut in a weathered suit tending a rooftop vegetable garden at sunrise, city skyline behind, hopeful cinematic mood, shallow depth of field',
    tag: 'cinematic',
  },
  {
    id: 'origami-city',
    title: 'Origami city',
    text: 'a sprawling metropolis folded from coloured origami paper, visible creases and paper grain, tiny cranes flying between towers, tilt-shift miniature photography',
    tag: '3d',
  },
  {
    id: 'cafe-window',
    title: 'Café window, 1962',
    text: 'view through a Parisian café window on a grey afternoon, condensation on the glass, two people mid-conversation, analog film still, kodak portra 400',
    tag: 'photo',
  },
  {
    id: 'logo-peak',
    title: 'Logo: Peak Coffee',
    text: 'minimal logo mark for PEAK COFFEE, mountain silhouette doubling as steam rising from a cup, flat vector, single ink on off-white, balanced negative space',
    tag: 'design',
  },
  {
    id: 'mech-fox',
    title: 'Biomorphic mech fox',
    text: 'a small robotic fox made of ceramic armour and exposed brass mechanics, sitting in autumn leaves, detailed concept art, rim light, studio ghibli meets hard-surface design',
    tag: 'concept',
  },
  {
    id: 'pasta-macro',
    title: 'Cacio e pepe macro',
    text: 'extreme macro of cacio e pepe twirled on a fork, black pepper crystals and glossy pecorino emulsion, dark moody plate, food editorial lighting',
    tag: 'macro',
  },
  {
    id: 'desert-runner',
    title: 'Desert ultra runner',
    text: 'lone ultramarathon runner crossing vast rippled sand dunes at golden hour, long shadow, dust kicked up behind, epic scale, shot from a low angle',
    tag: 'cinematic',
  },
  {
    id: 'sticker-pack',
    title: 'Cat barista stickers',
    text: 'sticker pack of five chubby cat baristas in tiny aprons, thick white die-cut borders, flat pastel colours, kawaii, arranged on a neutral background',
    tag: 'illustration',
  },
  {
    id: 'archive-room',
    title: 'Impossible library',
    text: 'interior of an infinite spiral library with ladders and brass rails, dust motes in shafts of light, wide-angle architectural photograph, tilt corrected',
    tag: 'architectural',
  },
  {
    id: 'fashion-scan',
    title: 'Puffer fashion scan',
    text: 'front and back 3D body scan of a model wearing an oversized iridescent puffer coat, grey studio, photogrammetry artefacts, fashion tech lookbook',
    tag: 'fashion',
  },
  {
    id: 'rpg-card',
    title: 'Trading card art',
    text: 'fantasy trading card illustration of a storm druid summoning lightning over a flooded village, painterly key art, ornate gilded frame, dramatic value contrast',
    tag: 'concept',
  },
];

export const RANDOM_SUBJECTS = [
  'a crotchety lighthouse keeper who is secretly a sea witch',
  'a 1970s space station cafeteria',
  'an alligator in a linen suit boarding a regional train',
  'a tiny librarian dragon organising scrolls',
  'the last payphone on a flooded street',
  'a mushroom village after a rainstorm',
  'a retro-futuristic market on Mars',
  'an elderly breakdancer mid-freeze',
  'a cathedral made of stacked books',
  'a robot barista perfecting latte art',
  'a night bus through a neon rainstorm',
  'a greenhouse growing constellations',
];

export const RANDOM_SETTINGS = [
  'at blue hour, wet pavement',
  'in soft morning fog',
  'under harsh midday sun',
  'during a power cut, lit by candles',
  'in the middle of a festival',
  'on an empty highway at 3am',
  'inside a snowglobe',
];

export const RANDOM_MEDIUMS = [
  '35mm documentary photograph',
  'gouache storyboard panel',
  'cinematic still, anamorphic',
  'editorial watercolour illustration',
  'macro product photograph',
  'linocut poster',
];

export function randomPrompt(rng = Math.random) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  return `${pick(RANDOM_SUBJECTS)}, ${pick(RANDOM_SETTINGS)}, ${pick(RANDOM_MEDIUMS)}`;
}

export function stylePresetById(id) {
  return STYLE_PRESETS.find((p) => p.id === id) || STYLE_PRESETS[0];
}

/**
 * Local "prompt doctor": the free tier's `enhance` flag is server-side, but we
 * can also do useful cheap cleanup here — collapse whitespace, quote text that
 * should be rendered, and nudge vague prompts toward something concrete.
 */
export function analysePrompt(text) {
  const clean = String(text || '').trim();
  const words = clean ? clean.split(/\s+/).length : 0;
  const tips = [];
  if (!clean) return { words, score: 0, tips: ['Write anything to begin — one clear subject is enough.'] };
  if (words < 6) tips.push('Add a subject detail + setting (who/what, where, when).');
  if (!/(photo|render|painting|illustration|still|concept art|sketch|poster)/i.test(clean)) {
    tips.push('Name the medium so the model stops guessing.');
  }
  if (!/(light|lit|glow|sun|lamp|neon|shadow)/i.test(clean)) tips.push('Describe the light: "soft window light", "neon night", "golden hour".');
  if (!/(50mm|35mm|85mm|macro|wide|anamorphic|aerial|angle|close-up)/i.test(clean)) tips.push('Add a lens or camera angle for composition control.');
  if (clean.length < 60) tips.push('More specificity is safe here — Nano Banana follows long prompts well.');
  const score = Math.max(1, Math.min(5, 5 - tips.length));
  return { words, score, tips };
}
