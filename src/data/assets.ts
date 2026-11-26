import type { BackdropModel, Costume, SoundAsset } from '../types/studio';

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export interface LibrarySpriteItem {
  id: string;
  name: string;
  category: 'Featured' | 'Fantasy' | 'Games' | 'Tech & UI';
  defaultSize: number;
  costumes: Costume[];
  defaultSounds: SoundAsset[];
}

export const BUILTIN_SOUNDS: SoundAsset[] = [
  { id: 'snd-magic', name: 'Magic Chime', preset: 'magic', pitch: 1, speed: 1 },
  { id: 'snd-cheer', name: 'Happy Cheer', preset: 'cheer', pitch: 1, speed: 1 },
  { id: 'snd-jump', name: 'Jump Hop', preset: 'jump', pitch: 1, speed: 1 },
  { id: 'snd-coin', name: 'Star Coin', preset: 'coin', pitch: 1, speed: 1 },
  { id: 'snd-pop', name: 'Bubble Pop', preset: 'pop', pitch: 1, speed: 1 },
  { id: 'snd-laser', name: 'Laser Zap', preset: 'laser', pitch: 1, speed: 1 },
  { id: 'snd-boing', name: 'Spring Boing', preset: 'boing', pitch: 1, speed: 1 },
  { id: 'snd-powerup', name: '8-Bit Powerup', preset: 'powerup', pitch: 1, speed: 1 },
  { id: 'snd-win', name: 'Victory Fanfare', preset: 'win', pitch: 1, speed: 1 },
  { id: 'snd-lose', name: 'Oops Wah', preset: 'lose', pitch: 1, speed: 1 },
  { id: 'snd-click', name: 'UI Tap', preset: 'click', pitch: 1, speed: 1 },
];

export const SPRITE_LIBRARY: LibrarySpriteItem[] = [
  {
    id: 'lib-ginger-star',
    name: 'Gingerbread Star',
    category: 'Featured',
    defaultSize: 34,
    costumes: [
      { id: 'cost-ginger-peace', name: 'Peace Pose', dataUrl: '/sprites/ginger-peace.png' },
      { id: 'cost-ginger-wand', name: 'Star Wand', dataUrl: '/sprites/ginger-wand.png' },
      { id: 'cost-ginger-cheer', name: 'Happy Cheer', dataUrl: '/sprites/ginger-cheer.png' },
    ],
    defaultSounds: [BUILTIN_SOUNDS[0], BUILTIN_SOUNDS[1], BUILTIN_SOUNDS[2]],
  },
  {
    id: 'lib-star-gem',
    name: 'Star Gem',
    category: 'Featured',
    defaultSize: 65,
    costumes: [
      {
        id: 'cost-star-1',
        name: 'Star Glow',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
            <defs>
              <radialGradient id="sg" cx="45%" cy="38%" r="60%">
                <stop offset="0%" stop-color="#FFF7AE"/>
                <stop offset="55%" stop-color="#FFD43B"/>
                <stop offset="100%" stop-color="#F59F00"/>
              </radialGradient>
            </defs>
            <polygon points="60,8 75,41 111,45 84,70 91,106 60,88 29,106 36,70 9,45 45,41"
              fill="url(#sg)" stroke="#9C4221" stroke-width="5" stroke-linejoin="round"/>
            <ellipse cx="47" cy="54" rx="4.5" ry="7" fill="#4A2511"/>
            <ellipse cx="73" cy="54" rx="4.5" ry="7" fill="#4A2511"/>
            <circle cx="45.5" cy="51.5" r="2" fill="#FFF"/>
            <circle cx="71.5" cy="51.5" r="2" fill="#FFF"/>
            <path d="M52 67 Q60 75 68 67" fill="none" stroke="#4A2511" stroke-width="3.8" stroke-linecap="round"/>
            <circle cx="40" cy="63" r="4.5" fill="#FF8787" opacity="0.65"/>
            <circle cx="80" cy="63" r="4.5" fill="#FF8787" opacity="0.65"/>
          </svg>
        `),
      },
      {
        id: 'cost-star-2',
        name: 'Star Sparkle',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
            <defs>
              <radialGradient id="sg2" cx="45%" cy="38%" r="60%">
                <stop offset="0%" stop-color="#FFFFFF"/>
                <stop offset="50%" stop-color="#FFE066"/>
                <stop offset="100%" stop-color="#FAB005"/>
              </radialGradient>
            </defs>
            <polygon points="60,5 76,40 114,44 86,70 93,108 60,89 27,108 34,70 6,44 44,40"
              fill="url(#sg2)" stroke="#B45309" stroke-width="5" stroke-linejoin="round"/>
            <path d="M42 54 L48 50 L54 54" fill="none" stroke="#4A2511" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M66 54 L72 50 L78 54" fill="none" stroke="#4A2511" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M51 67 Q60 78 69 67 Z" fill="#FF6B6B" stroke="#4A2511" stroke-width="3"/>
          </svg>
        `),
      },
    ],
    defaultSounds: [BUILTIN_SOUNDS[3], BUILTIN_SOUNDS[0]],
  },
  {
    id: 'lib-ginger-cookie',
    name: 'Cookie Buddy',
    category: 'Fantasy',
    defaultSize: 75,
    costumes: [
      {
        id: 'cost-cookie-1',
        name: 'Cookie Wave',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="34" r="22" fill="#C47835" stroke="#5C3210" stroke-width="4.5"/>
            <rect x="44" y="50" width="32" height="36" rx="14" fill="#C47835" stroke="#5C3210" stroke-width="4.5"/>
            <line x1="25" y1="52" x2="46" y2="60" stroke="#C47835" stroke-width="15" stroke-linecap="round"/>
            <line x1="95" y1="45" x2="74" y2="60" stroke="#C47835" stroke-width="15" stroke-linecap="round"/>
            <line x1="48" y1="84" x2="40" y2="108" stroke="#C47835" stroke-width="15" stroke-linecap="round"/>
            <line x1="72" y1="84" x2="80" y2="108" stroke="#C47835" stroke-width="15" stroke-linecap="round"/>
            <circle cx="52" cy="31" r="3.5" fill="#FFF"/>
            <circle cx="68" cy="31" r="3.5" fill="#FFF"/>
            <path d="M52 41 Q60 47 68 41" fill="none" stroke="#FFF" stroke-width="3.5" stroke-linecap="round"/>
            <circle cx="60" cy="61" r="4" fill="#FF4D6D"/>
            <circle cx="60" cy="73" r="4" fill="#38D9A9"/>
          </svg>
        `),
      },
    ],
    defaultSounds: [BUILTIN_SOUNDS[4], BUILTIN_SOUNDS[2]],
  },
  {
    id: 'lib-pixel-cat',
    name: 'Coder Cat',
    category: 'Featured',
    defaultSize: 80,
    costumes: [
      {
        id: 'cost-cat-1',
        name: 'Cat Stride A',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
            <path d="M28 92 Q12 85 16 68" fill="none" stroke="#FF922B" stroke-width="10" stroke-linecap="round"/>
            <ellipse cx="62" cy="84" rx="22" ry="18" fill="#FF922B" stroke="#7C2D12" stroke-width="4"/>
            <ellipse cx="62" cy="86" rx="12" ry="11" fill="#FFF4E6"/>
            <line x1="50" y1="98" x2="42" y2="115" stroke="#FF922B" stroke-width="10" stroke-linecap="round"/>
            <line x1="74" y1="98" x2="84" y2="113" stroke="#FF922B" stroke-width="10" stroke-linecap="round"/>
            <polygon points="40,42 35,16 56,30" fill="#FF922B" stroke="#7C2D12" stroke-width="4" stroke-linejoin="round"/>
            <polygon points="88,42 93,16 72,30" fill="#FF922B" stroke="#7C2D12" stroke-width="4" stroke-linejoin="round"/>
            <ellipse cx="64" cy="48" rx="28" ry="24" fill="#FF922B" stroke="#7C2D12" stroke-width="4"/>
            <ellipse cx="64" cy="56" rx="20" ry="13" fill="#FFF4E6"/>
            <ellipse cx="53" cy="44" rx="5.5" ry="7" fill="#FFF" stroke="#1E293B" stroke-width="2.5"/>
            <ellipse cx="75" cy="44" rx="5.5" ry="7" fill="#FFF" stroke="#1E293B" stroke-width="2.5"/>
            <circle cx="55" cy="44" r="3" fill="#1E293B"/>
            <circle cx="77" cy="44" r="3" fill="#1E293B"/>
            <polygon points="64,51 60,55 68,55" fill="#F76707"/>
            <path d="M56 60 Q64 67 72 60" fill="none" stroke="#7C2D12" stroke-width="3" stroke-linecap="round"/>
          </svg>
        `),
      },
      {
        id: 'cost-cat-2',
        name: 'Cat Stride B',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
            <path d="M28 88 Q10 76 20 60" fill="none" stroke="#FF922B" stroke-width="10" stroke-linecap="round"/>
            <ellipse cx="62" cy="82" rx="22" ry="18" fill="#FF922B" stroke="#7C2D12" stroke-width="4"/>
            <ellipse cx="62" cy="84" rx="12" ry="11" fill="#FFF4E6"/>
            <line x1="52" y1="96" x2="58" y2="115" stroke="#FF922B" stroke-width="10" stroke-linecap="round"/>
            <line x1="72" y1="96" x2="66" y2="115" stroke="#FF922B" stroke-width="10" stroke-linecap="round"/>
            <polygon points="40,40 35,14 56,28" fill="#FF922B" stroke="#7C2D12" stroke-width="4" stroke-linejoin="round"/>
            <polygon points="88,40 93,14 72,28" fill="#FF922B" stroke="#7C2D12" stroke-width="4" stroke-linejoin="round"/>
            <ellipse cx="64" cy="46" rx="28" ry="24" fill="#FF922B" stroke="#7C2D12" stroke-width="4"/>
            <ellipse cx="64" cy="54" rx="20" ry="13" fill="#FFF4E6"/>
            <ellipse cx="53" cy="42" rx="5.5" ry="7" fill="#FFF" stroke="#1E293B" stroke-width="2.5"/>
            <ellipse cx="75" cy="42" rx="5.5" ry="7" fill="#FFF" stroke="#1E293B" stroke-width="2.5"/>
            <circle cx="55" cy="42" r="3" fill="#1E293B"/>
            <circle cx="77" cy="42" r="3" fill="#1E293B"/>
            <polygon points="64,49 60,53 68,53" fill="#F76707"/>
            <path d="M55 58 Q64 68 73 58" fill="none" stroke="#7C2D12" stroke-width="3" stroke-linecap="round"/>
          </svg>
        `),
      },
    ],
    defaultSounds: [BUILTIN_SOUNDS[4], BUILTIN_SOUNDS[2]],
  },
  {
    id: 'lib-cyber-bot',
    name: 'AppBot AI',
    category: 'Tech & UI',
    defaultSize: 75,
    costumes: [
      {
        id: 'cost-bot-1',
        name: 'Bot Smile',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
            <line x1="60" y1="12" x2="60" y2="26" stroke="#4C6EF5" stroke-width="5"/>
            <circle cx="60" cy="11" r="6" fill="#22D3EE" stroke="#1E3A8A" stroke-width="3"/>
            <rect x="26" y="26" width="68" height="52" rx="18" fill="#EEF2FF" stroke="#3B5BDB" stroke-width="4.5"/>
            <rect x="35" y="36" width="50" height="30" rx="10" fill="#1E1B4B"/>
            <circle cx="48" cy="50" r="5.5" fill="#22D3EE"/>
            <circle cx="72" cy="50" r="5.5" fill="#22D3EE"/>
            <path d="M51 59 Q60 64 69 59" fill="none" stroke="#38BDF8" stroke-width="3" stroke-linecap="round"/>
            <rect x="36" y="80" width="48" height="28" rx="12" fill="#DBE4FF" stroke="#3B5BDB" stroke-width="4"/>
            <circle cx="60" cy="94" r="6" fill="#4C6EF5"/>
          </svg>
        `),
      },
    ],
    defaultSounds: [BUILTIN_SOUNDS[5], BUILTIN_SOUNDS[10]],
  },
  {
    id: 'lib-rocket',
    name: 'Star Rocket',
    category: 'Games',
    defaultSize: 72,
    costumes: [
      {
        id: 'cost-rocket-1',
        name: 'Rocket Boost',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
            <polygon points="18,60 40,46 40,74" fill="#FF922B"/>
            <polygon points="8,60 34,51 34,69" fill="#FFE066"/>
            <path d="M35 42 L78 42 Q105 60 78 78 L35 78 Z" fill="#F8FAFC" stroke="#1E293B" stroke-width="4"/>
            <path d="M78 42 Q105 60 78 78 Z" fill="#FF4D6D" stroke="#1E293B" stroke-width="4"/>
            <polygon points="35,42 24,26 52,42" fill="#4C6EF5" stroke="#1E293B" stroke-width="3.5"/>
            <polygon points="35,78 24,94 52,78" fill="#4C6EF5" stroke="#1E293B" stroke-width="3.5"/>
            <circle cx="62" cy="60" r="10" fill="#38BDF8" stroke="#1E293B" stroke-width="3.5"/>
          </svg>
        `),
      },
    ],
    defaultSounds: [BUILTIN_SOUNDS[5], BUILTIN_SOUNDS[7]],
  },
  {
    id: 'lib-magic-orb',
    name: 'Magic Spark',
    category: 'Games',
    defaultSize: 55,
    costumes: [
      {
        id: 'cost-orb-1',
        name: 'Spark Bolt',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="28" fill="#A855F7" opacity="0.35"/>
            <circle cx="40" cy="40" r="18" fill="#E879F9" stroke="#7E22CE" stroke-width="3.5"/>
            <circle cx="35" cy="35" r="7" fill="#FFFFFF"/>
          </svg>
        `),
      },
    ],
    defaultSounds: [BUILTIN_SOUNDS[5]],
  },
  {
    id: 'lib-slime',
    name: 'Candy Slime',
    category: 'Fantasy',
    defaultSize: 70,
    costumes: [
      {
        id: 'cost-slime-1',
        name: 'Slime Bounce',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
            <path d="M20 88 Q20 36 60 36 Q100 36 100 88 Q100 102 60 102 Q20 102 20 88 Z"
              fill="#63E6BE" stroke="#0CA678" stroke-width="4.5"/>
            <ellipse cx="44" cy="54" rx="10" ry="5" fill="#FFF" opacity="0.6" transform="rotate(-20 44 54)"/>
            <circle cx="46" cy="70" r="5" fill="#083344"/>
            <circle cx="74" cy="70" r="5" fill="#083344"/>
            <path d="M54 78 Q60 84 66 78" fill="none" stroke="#083344" stroke-width="3.5" stroke-linecap="round"/>
          </svg>
        `),
      },
    ],
    defaultSounds: [BUILTIN_SOUNDS[6], BUILTIN_SOUNDS[4]],
  },
  {
    id: 'lib-potion-flask',
    name: 'Reaction Flask',
    category: 'Featured',
    defaultSize: 92,
    costumes: [
      {
        id: 'cost-flask-empty',
        name: 'Empty Beaker',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
            <ellipse cx="70" cy="124" rx="44" ry="8" fill="#0F172A" opacity="0.35"/>
            <path d="M54 22 L86 22 L86 46 L114 106 Q120 120 104 122 L36 122 Q20 120 26 106 L54 46 Z"
              fill="#E0F2FE" fill-opacity="0.28" stroke="#93C5FD" stroke-width="4.5" stroke-linejoin="round"/>
            <rect x="48" y="16" width="44" height="9" rx="4.5" fill="#DBEAFE" stroke="#60A5FA" stroke-width="3.5"/>
            <line x1="82" y1="68" x2="92" y2="68" stroke="#BAE6FD" stroke-width="3" stroke-linecap="round"/>
            <line x1="87" y1="84" x2="99" y2="84" stroke="#BAE6FD" stroke-width="3" stroke-linecap="round"/>
            <line x1="92" y1="100" x2="105" y2="100" stroke="#BAE6FD" stroke-width="3" stroke-linecap="round"/>
            <path d="M42 96 L56 62" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.65"/>
          </svg>
        `),
      },
      {
        id: 'cost-flask-cyan',
        name: 'Frost Cyan Reagent',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#67E8F9"/>
                <stop offset="100%" stop-color="#0284C7"/>
              </linearGradient>
            </defs>
            <ellipse cx="70" cy="124" rx="46" ry="9" fill="#22D3EE" opacity="0.32"/>
            <path d="M39 78 Q55 72 70 78 T101 78 L113 106 Q119 119 103 121 L37 121 Q21 119 27 106 Z" fill="url(#fc)"/>
            <path d="M54 22 L86 22 L86 46 L114 106 Q120 120 104 122 L36 122 Q20 120 26 106 L54 46 Z"
              fill="none" stroke="#BAE6FD" stroke-width="4.5" stroke-linejoin="round"/>
            <rect x="48" y="16" width="44" height="9" rx="4.5" fill="#DBEAFE" stroke="#38BDF8" stroke-width="3.5"/>
            <circle cx="56" cy="98" r="5" fill="#ECFEFF" opacity="0.85"/>
            <circle cx="76" cy="88" r="3.5" fill="#ECFEFF" opacity="0.9"/>
            <circle cx="68" cy="64" r="4" fill="#67E8F9"/>
            <path d="M42 96 L56 62" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
          </svg>
        `),
      },
      {
        id: 'cost-flask-berry',
        name: 'Starberry Magenta',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="fb" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#F472B6"/>
                <stop offset="100%" stop-color="#9333EA"/>
              </linearGradient>
            </defs>
            <ellipse cx="70" cy="124" rx="46" ry="9" fill="#EC4899" opacity="0.35"/>
            <path d="M37 74 Q55 80 70 74 T103 74 L113 106 Q119 119 103 121 L37 121 Q21 119 27 106 Z" fill="url(#fb)"/>
            <path d="M54 22 L86 22 L86 46 L114 106 Q120 120 104 122 L36 122 Q20 120 26 106 L54 46 Z"
              fill="none" stroke="#FBCFE8" stroke-width="4.5" stroke-linejoin="round"/>
            <rect x="48" y="16" width="44" height="9" rx="4.5" fill="#FCE7F3" stroke="#F472B6" stroke-width="3.5"/>
            <circle cx="62" cy="102" r="5.5" fill="#FDF2F8" opacity="0.85"/>
            <circle cx="82" cy="92" r="4" fill="#FDF2F8" opacity="0.85"/>
            <circle cx="72" cy="56" r="4.5" fill="#F472B6"/>
            <path d="M42 96 L56 62" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
          </svg>
        `),
      },
      {
        id: 'cost-flask-solar',
        name: 'Solar Gold Catalyst',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="fs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#FDE047"/>
                <stop offset="100%" stop-color="#EA580C"/>
              </linearGradient>
            </defs>
            <ellipse cx="70" cy="124" rx="46" ry="9" fill="#F59E0B" opacity="0.38"/>
            <path d="M36 72 Q54 66 70 72 T104 72 L113 106 Q119 119 103 121 L37 121 Q21 119 27 106 Z" fill="url(#fs)"/>
            <path d="M54 22 L86 22 L86 46 L114 106 Q120 120 104 122 L36 122 Q20 120 26 106 L54 46 Z"
              fill="none" stroke="#FEF08A" stroke-width="4.5" stroke-linejoin="round"/>
            <rect x="48" y="16" width="44" height="9" rx="4.5" fill="#FEF9C3" stroke="#FBBF24" stroke-width="3.5"/>
            <circle cx="54" cy="98" r="5" fill="#FEFCE8" opacity="0.9"/>
            <circle cx="80" cy="86" r="4.5" fill="#FEFCE8" opacity="0.9"/>
            <polygon points="70,42 73,50 81,50 75,55 77,63 70,58 63,63 65,55 59,50 67,50" fill="#FDE047"/>
            <path d="M42 96 L56 62" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.75"/>
          </svg>
        `),
      },
      {
        id: 'cost-flask-rainbow',
        name: 'Rainbow Supernova Elixir',
        dataUrl: svgToDataUrl(`
          <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="fr" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#22D3EE"/>
                <stop offset="48%" stop-color="#EC4899"/>
                <stop offset="100%" stop-color="#FACC15"/>
              </linearGradient>
            </defs>
            <circle cx="70" cy="82" r="52" fill="#E879F9" opacity="0.22"/>
            <path d="M43 64 Q58 58 70 64 T97 64 L113 106 Q119 119 103 121 L37 121 Q21 119 27 106 Z" fill="url(#fr)"/>
            <path d="M54 22 L86 22 L86 46 L114 106 Q120 120 104 122 L36 122 Q20 120 26 106 L54 46 Z"
              fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linejoin="round"/>
            <rect x="48" y="16" width="44" height="9" rx="4.5" fill="#FFFFFF" stroke="#C084FC" stroke-width="3.5"/>
            <polygon points="70,30 74,40 85,41 77,48 79,59 70,53 61,59 63,48 55,41 66,40" fill="#FEF08A" stroke="#CA8A04" stroke-width="1.5"/>
            <circle cx="52" cy="98" r="5.5" fill="#FFFFFF" opacity="0.9"/>
            <circle cx="84" cy="94" r="5" fill="#FFFFFF" opacity="0.9"/>
            <circle cx="68" cy="78" r="4" fill="#FFFFFF" opacity="0.9"/>
          </svg>
        `),
      },
    ],
    defaultSounds: [BUILTIN_SOUNDS[4], BUILTIN_SOUNDS[0], BUILTIN_SOUNDS[8]],
  },
];

export const BACKDROP_LIBRARY: BackdropModel[] = [
  {
    id: 'bg-candy-kingdom',
    name: 'Gingerbread Snow Kingdom',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="600" viewBox="0 0 640 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1E1B4B"/>
            <stop offset="45%" stop-color="#3B2F7F"/>
            <stop offset="80%" stop-color="#7C5CBF"/>
            <stop offset="100%" stop-color="#FDE2FF"/>
          </linearGradient>
          <linearGradient id="aurora" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stop-color="#38D9A9" stop-opacity="0.38"/>
            <stop offset="50%" stop-color="#74C0FC" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#F783AC" stop-opacity="0.35"/>
          </linearGradient>
        </defs>
        <rect width="640" height="600" fill="url(#sky)"/>
        <path d="M-20 140 Q160 60 320 150 T660 110 L660 230 Q480 180 310 240 T-20 220 Z" fill="url(#aurora)"/>
        <!-- Twinkling stars -->
        <circle cx="80" cy="65" r="2.5" fill="#FFF9DB"/>
        <circle cx="170" cy="95" r="3.5" fill="#FFE066"/>
        <circle cx="290" cy="52" r="2.5" fill="#FFF"/>
        <circle cx="420" cy="82" r="3" fill="#FFF9DB"/>
        <circle cx="545" cy="58" r="3.5" fill="#FFE066"/>
        <circle cx="590" cy="130" r="2" fill="#FFF"/>
        <circle cx="120" cy="165" r="2" fill="#FFF"/>
        <!-- Distant snowy hills -->
        <path d="M0 410 Q160 345 340 400 T640 380 L640 600 L0 600 Z" fill="#E5DBFF"/>
        <!-- Candy cane poles -->
        <g transform="translate(88,330)">
          <path d="M0 95 L0 22 A16 16 0 0 1 32 22 L32 34" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
          <path d="M0 95 L0 22 A16 16 0 0 1 32 22 L32 34" fill="none" stroke="#FF4D6D" stroke-width="12" stroke-dasharray="12 12" stroke-linecap="round"/>
        </g>
        <g transform="translate(532,320) scale(-1,1)">
          <path d="M0 105 L0 22 A16 16 0 0 1 32 22 L32 34" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
          <path d="M0 105 L0 22 A16 16 0 0 1 32 22 L32 34" fill="none" stroke="#FF4D6D" stroke-width="12" stroke-dasharray="12 12" stroke-linecap="round"/>
        </g>
        <!-- Foreground snowy candy ground -->
        <path d="M0 445 Q200 415 380 448 T640 432 L640 600 L0 600 Z" fill="#F8F9FA"/>
        <path d="M0 475 Q220 450 420 482 T640 468 L640 600 L0 600 Z" fill="#EDF2FF"/>
      </svg>
    `),
  },
  {
    id: 'bg-app-light',
    name: 'Clean Mobile App (Light)',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="600" viewBox="0 0 640 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="appl" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#F8FAFC"/>
            <stop offset="50%" stop-color="#EEF2FF"/>
            <stop offset="100%" stop-color="#FDF2F8"/>
          </linearGradient>
        </defs>
        <rect width="640" height="600" fill="url(#appl)"/>
        <circle cx="540" cy="90" r="140" fill="#C7D2FE" opacity="0.35"/>
        <circle cx="90" cy="510" r="160" fill="#FBCFE8" opacity="0.35"/>
      </svg>
    `),
  },
  {
    id: 'bg-app-dark',
    name: 'Sleek App Studio (Dark)',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="600" viewBox="0 0 640 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="appd" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0F172A"/>
            <stop offset="55%" stop-color="#1E1B4B"/>
            <stop offset="100%" stop-color="#172554"/>
          </linearGradient>
        </defs>
        <rect width="640" height="600" fill="url(#appd)"/>
        <circle cx="520" cy="110" r="150" fill="#4F46E5" opacity="0.22"/>
        <circle cx="110" cy="490" r="170" fill="#EC4899" opacity="0.16"/>
      </svg>
    `),
  },
  {
    id: 'bg-sunny-park',
    name: 'Sunny Meadow Park',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="600" viewBox="0 0 640 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38BDF8"/>
            <stop offset="70%" stop-color="#BAE6FD"/>
            <stop offset="100%" stop-color="#E0F2FE"/>
          </linearGradient>
        </defs>
        <rect width="640" height="600" fill="url(#sp)"/>
        <circle cx="520" cy="95" r="42" fill="#FDE047"/>
        <g fill="#FFFFFF" opacity="0.9">
          <ellipse cx="140" cy="110" rx="48" ry="22"/>
          <ellipse cx="168" cy="102" rx="34" ry="20"/>
          <ellipse cx="360" cy="145" rx="52" ry="22"/>
        </g>
        <path d="M0 410 Q180 330 360 400 T640 375 L640 600 L0 600 Z" fill="#74B816"/>
        <path d="M0 455 Q240 415 440 460 T640 445 L640 600 L0 600 Z" fill="#5C940D"/>
      </svg>
    `),
  },
  {
    id: 'bg-space',
    name: 'Starlight Nebula',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="600" viewBox="0 0 640 600" preserveAspectRatio="xMidYMid slice">
        <rect width="640" height="600" fill="#090D16"/>
        <circle cx="190" cy="200" r="160" fill="#4C1D95" opacity="0.35"/>
        <circle cx="470" cy="340" r="180" fill="#1D4ED8" opacity="0.28"/>
        <circle cx="490" cy="130" r="36" fill="#F43F5E"/>
        <ellipse cx="490" cy="130" rx="68" ry="14" fill="none" stroke="#FDA4AF" stroke-width="4" transform="rotate(-18 490 130)"/>
        <circle cx="95" cy="90" r="2" fill="#FFF"/>
        <circle cx="240" cy="70" r="3" fill="#FDE047"/>
        <circle cx="340" cy="160" r="2" fill="#FFF"/>
        <circle cx="130" cy="320" r="2.5" fill="#93C5FD"/>
        <circle cx="560" cy="260" r="2" fill="#FFF"/>
        <circle cx="410" cy="460" r="2.5" fill="#FDE047"/>
      </svg>
    `),
  },
  {
    id: 'bg-cyber-grid',
    name: 'Neon Arcade Grid',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="600" viewBox="0 0 640 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#09001A"/>
            <stop offset="58%" stop-color="#2E1065"/>
            <stop offset="60%" stop-color="#EC4899"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
        </defs>
        <rect width="640" height="600" fill="url(#cg)"/>
        <circle cx="320" cy="330" r="85" fill="#F59E0B" opacity="0.85"/>
        <g stroke="#F472B6" stroke-width="1.5" opacity="0.55">
          <line x1="0" y1="360" x2="640" y2="360"/>
          <line x1="0" y1="395" x2="640" y2="395"/>
          <line x1="0" y1="440" x2="640" y2="440"/>
          <line x1="0" y1="495" x2="640" y2="495"/>
          <line x1="0" y1="560" x2="640" y2="560"/>
          <line x1="320" y1="360" x2="320" y2="600"/>
          <line x1="260" y1="360" x2="80" y2="600"/>
          <line x1="380" y1="360" x2="560" y2="600"/>
          <line x1="200" y1="360" x2="-80" y2="600"/>
          <line x1="440" y1="360" x2="720" y2="600"/>
        </g>
      </svg>
    `),
  },
  {
    id: 'bg-chemist-lab',
    name: 'Star Chemist Lab',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="600" viewBox="0 0 640 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="labwall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0F172A"/>
            <stop offset="65%" stop-color="#1E1B4B"/>
            <stop offset="100%" stop-color="#312E81"/>
          </linearGradient>
          <linearGradient id="bench" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#334155"/>
            <stop offset="18%" stop-color="#1E293B"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
        </defs>
        <rect width="640" height="600" fill="url(#labwall)"/>
        <!-- Subtle hex science pattern -->
        <g stroke="#6366F1" stroke-opacity="0.16" stroke-width="1.5" fill="none">
          <circle cx="110" cy="120" r="42"/>
          <circle cx="530" cy="110" r="54"/>
          <line x1="68" y1="120" x2="152" y2="120"/>
          <line x1="110" y1="78" x2="110" y2="162"/>
        </g>
        <!-- Chalkboard formula -->
        <rect x="205" y="64" width="230" height="108" rx="12" fill="#064E3B" stroke="#92400E" stroke-width="6"/>
        <text x="228" y="104" fill="#A7F3D0" font-family="monospace" font-size="17" font-weight="bold">⚗️ STAR LAB H₂O+</text>
        <text x="228" y="132" fill="#FDE68A" font-family="monospace" font-size="14">Frost + Berry + Solar</text>
        <text x="242" y="154" fill="#FBCFE8" font-family="monospace" font-size="13">= Supernova Elixir ✨</text>
        <!-- Left & Right Reagent Shelves -->
        <rect x="26" y="152" width="146" height="10" rx="5" fill="#475569"/>
        <rect x="468" y="152" width="146" height="10" rx="5" fill="#475569"/>
        <!-- Glowing Reagent Bottles -->
        <rect x="46" y="114" width="24" height="38" rx="6" fill="#22D3EE" opacity="0.85"/>
        <rect x="84" y="106" width="26" height="46" rx="8" fill="#EC4899" opacity="0.85"/>
        <rect x="124" y="118" width="22" height="34" rx="6" fill="#FACC15" opacity="0.85"/>
        <rect x="488" y="112" width="24" height="40" rx="6" fill="#A855F7" opacity="0.85"/>
        <rect x="526" y="104" width="26" height="48" rx="8" fill="#34D399" opacity="0.85"/>
        <rect x="566" y="116" width="22" height="36" rx="6" fill="#FB923C" opacity="0.85"/>
        <!-- Lab Bench Countertop -->
        <rect x="0" y="388" width="640" height="212" fill="url(#bench)"/>
        <rect x="0" y="384" width="640" height="10" fill="#38BDF8" opacity="0.45"/>
        <!-- Bunsen Burner Pad under Flask -->
        <ellipse cx="360" cy="408" rx="56" ry="11" fill="#0EA5E9" opacity="0.28"/>
      </svg>
    `),
  },
  {
    id: 'bg-gingerbread-calc',
    name: 'Gingerbread Cookie Bakery',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="600" viewBox="0 0 640 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="gb_bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#451A03"/>
            <stop offset="48%" stop-color="#78350F"/>
            <stop offset="100%" stop-color="#451A03"/>
          </linearGradient>
          <linearGradient id="gb_card" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#92400E"/>
            <stop offset="100%" stop-color="#5C2808"/>
          </linearGradient>
        </defs>
        <rect width="640" height="600" fill="url(#gb_bg)"/>
        <!-- Warm cookie panel with white royal icing border -->
        <rect x="136" y="16" width="368" height="568" rx="30" fill="url(#gb_card)" stroke="#FFFBEB" stroke-width="5" stroke-dasharray="18 8"/>
        <!-- Decorative icing waves along top -->
        <path d="M148 42 Q175 60 202 42 T256 42 T310 42 T364 42 T418 42 T472 42" fill="none" stroke="#FEF3C7" stroke-width="5" stroke-linecap="round" opacity="0.75"/>
        <!-- Peppermint & gumdrop accents -->
        <circle cx="166" cy="558" r="10" fill="#FB7185" opacity="0.8"/>
        <circle cx="194" cy="558" r="10" fill="#34D399" opacity="0.8"/>
        <circle cx="446" cy="558" r="10" fill="#FBBF24" opacity="0.8"/>
        <circle cx="474" cy="558" r="10" fill="#60A5FA" opacity="0.8"/>
        <!-- Soft sugar sparkles -->
        <circle cx="180" cy="145" r="2.5" fill="#FDE68A" opacity="0.6"/>
        <circle cx="465" cy="155" r="3" fill="#FDE68A" opacity="0.6"/>
        <circle cx="460" cy="390" r="2.5" fill="#FFFBEB" opacity="0.5"/>
      </svg>
    `),
  },
  {
    id: 'bg-xy-grid',
    name: 'Scratch XY Grid',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
        <rect width="480" height="360" fill="#FFFFFF"/>
        <g stroke="#E2E8F0" stroke-width="1">
          <line x1="60" y1="0" x2="60" y2="360"/><line x1="120" y1="0" x2="120" y2="360"/>
          <line x1="180" y1="0" x2="180" y2="360"/><line x1="300" y1="0" x2="300" y2="360"/>
          <line x1="360" y1="0" x2="360" y2="360"/><line x1="420" y1="0" x2="420" y2="360"/>
          <line x1="0" y1="60" x2="480" y2="60"/><line x1="0" y1="120" x2="480" y2="120"/>
          <line x1="0" y1="240" x2="480" y2="240"/><line x1="0" y1="300" x2="480" y2="300"/>
        </g>
        <line x1="0" y1="180" x2="480" y2="180" stroke="#3B82F6" stroke-width="2"/>
        <line x1="240" y1="0" x2="240" y2="360" stroke="#EF4444" stroke-width="2"/>
        <circle cx="240" cy="180" r="4" fill="#1E293B"/>
        <g font-family="sans-serif" font-size="11" fill="#475569" font-weight="600">
          <text x="246" y="174">(0, 0)</text>
          <text x="246" y="16">y: 180</text>
          <text x="246" y="352">y: -180</text>
          <text x="8" y="174">x: -240</text>
          <text x="430" y="174">x: 240</text>
        </g>
      </svg>
    `),
  },
];
