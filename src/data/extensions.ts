import { type BlocklyBlockNode, getTopBlocks } from '../blockly/astTypes';
import type { ExtensionId, ProjectModel } from '../types/studio';

export interface ScratchExtensionMeta {
  id: ExtensionId;
  name: string;
  toolboxName: string;
  group: 'Official Scratch' | 'App & Cloud' | 'Games & Physics';
  tagline: string;
  accentColor: string;
  bannerGradient: string;
  emoji: string;
  badge?: string;
  blockPrefixes: string[];
  featuredBlocks: string[];
}

export const SCRATCH_EXTENSIONS: ScratchExtensionMeta[] = [
  {
    id: 'music',
    name: 'Music',
    toolboxName: 'Music',
    group: 'Official Scratch',
    tagline: 'Play drums, 8 musical instruments, melodies, rests, and live tempo.',
    accentColor: '#0FBD8C',
    bannerGradient: 'linear-gradient(135deg, #0FBD8C 0%, #0CA678 55%, #087F5B 100%)',
    emoji: '🎵',
    badge: 'Scratch Classic',
    blockPrefixes: ['music_'],
    featuredBlocks: ['play drum (Snare) for 0.25 beats', 'set instrument to (Piano)', 'play note (60) for 0.5 beats'],
  },
  {
    id: 'pen',
    name: 'Pen',
    toolboxName: 'Pen',
    group: 'Official Scratch',
    tagline: 'Draw geometric trails with your sprites, stamp costumes, and cycle rainbow hues.',
    accentColor: '#0FBD8C',
    bannerGradient: 'linear-gradient(135deg, #10B981 0%, #059669 60%, #047857 100%)',
    emoji: '✏️',
    badge: 'Scratch Classic',
    blockPrefixes: ['pen_'],
    featuredBlocks: ['pen down', 'stamp', 'change pen hue by (10)', 'set pen transparency to (50)%'],
  },
  {
    id: 'tts',
    name: 'Text to Speech',
    toolboxName: 'Speech',
    group: 'Official Scratch',
    tagline: 'Make your sprites talk aloud with Alto, Tenor, Squeak, Giant, or Kitten ("meow!") voices.',
    accentColor: '#0FBD8C',
    bannerGradient: 'linear-gradient(135deg, #14B8A6 0%, #0EA5E9 100%)',
    emoji: '🗣️',
    badge: 'Voice Synth',
    blockPrefixes: ['tts_'],
    featuredBlocks: ['speak "Hello!"', 'set voice to (kitten)', 'set language to (Japanese)'],
  },
  {
    id: 'translate',
    name: 'Translate',
    toolboxName: 'Translate',
    group: 'Official Scratch',
    tagline: 'Translate words and phrases into Spanish, French, Japanese, Korean, German & Emoji.',
    accentColor: '#0FBD8C',
    bannerGradient: 'linear-gradient(135deg, #06B6D4 0%, #2563EB 100%)',
    emoji: '🌍',
    badge: '8 Languages',
    blockPrefixes: ['translate_'],
    featuredBlocks: ['translate "Hello friend!" to (Japanese)', 'viewer language'],
  },
  {
    id: 'video',
    name: 'Video Sensing',
    toolboxName: 'Video',
    group: 'Official Scratch',
    tagline: 'Sense real-time webcam motion on the stage (with smart wave simulation fallback).',
    accentColor: '#0FBD8C',
    bannerGradient: 'linear-gradient(135deg, #22C55E 0%, #0D9488 100%)',
    emoji: '📹',
    badge: 'Camera Sensor',
    blockPrefixes: ['video_'],
    featuredBlocks: ['when video motion > (20)', 'turn video (on)', 'video motion on stage'],
  },
  {
    id: 'appui',
    name: 'App UI Maker',
    toolboxName: 'App UI',
    group: 'App & Cloud',
    tagline: 'Build mobile & web apps with interactive buttons, inputs, sliders, and toast notifications.',
    accentColor: '#FF6680',
    bannerGradient: 'linear-gradient(135deg, #FF6680 0%, #EC4899 55%, #DB2777 100%)',
    emoji: '📱',
    badge: 'App Builder',
    blockPrefixes: ['appui_'],
    featuredBlocks: ['when UI button clicked', 'UI widget value', 'show app notification'],
  },
  {
    id: 'storage',
    name: 'Cloud & Local Save',
    toolboxName: 'Storage',
    group: 'App & Cloud',
    tagline: 'Save high scores, coins, player names, and app settings permanently in browser storage.',
    accentColor: '#F59E0B',
    bannerGradient: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)',
    emoji: '💾',
    badge: 'Persistent Data',
    blockPrefixes: ['storage_'],
    featuredBlocks: ['save "high_score" = (100)', 'load "high_score" default (0)', 'storage has key?'],
  },
  {
    id: 'physics',
    name: '2D Physics Engine',
    toolboxName: 'Physics',
    group: 'Games & Physics',
    tagline: 'Add real 60 FPS gravity, jumping velocity, bounciness, friction, and solid platforms.',
    accentColor: '#3B82F6',
    bannerGradient: 'linear-gradient(135deg, #3B82F6 0%, #4F46E5 100%)',
    emoji: '🧲',
    badge: '60 FPS Gravity',
    blockPrefixes: ['physics_'],
    featuredBlocks: ['set physics mode (dynamic)', 'jump with power (11)', 'on ground?'],
  },
  {
    id: 'gamepad',
    name: 'Gamepad & Arcade Pad',
    toolboxName: 'Gamepad',
    group: 'Games & Physics',
    tagline: 'Support USB/Bluetooth controllers plus an on-screen touch D-Pad + A/B arcade overlay.',
    accentColor: '#EC4899',
    bannerGradient: 'linear-gradient(135deg, #EC4899 0%, #9333EA 100%)',
    emoji: '🎮',
    badge: 'Controller + Touch',
    blockPrefixes: ['gamepad_'],
    featuredBlocks: ['show on-screen arcade pad', 'when gamepad (A) pressed', 'gamepad button pressed?'],
  },
  {
    id: 'fx',
    name: 'Juice, Camera & FX',
    toolboxName: 'Juice FX',
    group: 'Games & Physics',
    tagline: 'Trigger star/confetti bursts, screen shake, and smooth stage camera zoom & pan.',
    accentColor: '#7C3AED',
    bannerGradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 55%, #4C1D95 100%)',
    emoji: '✨',
    badge: 'Particles + Cam',
    blockPrefixes: ['fx_'],
    featuredBlocks: ['burst (magic stars) count: 20', 'screen shake power (8)', 'set camera zoom (130)%'],
  },
];

export const DEFAULT_ENABLED_EXTENSIONS: ExtensionId[] = ['appui', 'fx', 'pen'];

function collectBlockTypes(node: BlocklyBlockNode | undefined, out: Set<string>): void {
  if (!node) return;
  out.add(node.type);
  if (node.inputs) {
    for (const slot of Object.values(node.inputs)) {
      if (slot.block) collectBlockTypes(slot.block, out);
      if (slot.shadow) collectBlockTypes(slot.shadow, out);
    }
  }
  if (node.next?.block) {
    collectBlockTypes(node.next.block, out);
  }
}

export function detectProjectExtensions(project: ProjectModel): ExtensionId[] {
  const enabled = new Set<ExtensionId>(project.enabledExtensions ?? DEFAULT_ENABLED_EXTENSIONS);
  const blockTypes = new Set<string>();
  for (const sp of project.sprites) {
    for (const top of getTopBlocks(sp.workspaceState)) {
      collectBlockTypes(top, blockTypes);
    }
  }
  for (const ext of SCRATCH_EXTENSIONS) {
    for (const t of blockTypes) {
      if (ext.blockPrefixes.some((prefix) => t.startsWith(prefix))) {
        enabled.add(ext.id);
      }
    }
  }
  return Array.from(enabled);
}

// ---------- OFFLINE MULTI-LANGUAGE SCRATCH TRANSLATOR ----------
const DICTIONARY: Record<string, Record<string, string>> = {
  es: {
    hello: 'hola',
    hi: 'hola',
    friend: 'amigo',
    friends: 'amigos',
    welcome: 'bienvenido',
    magic: 'magia',
    star: 'estrella',
    stars: 'estrellas',
    score: 'puntuación',
    points: 'puntos',
    winner: 'ganador',
    win: 'ganar',
    jump: 'saltar',
    play: 'jugar',
    yes: 'sí',
    no: 'no',
    good: 'bueno',
    job: 'trabajo',
    thanks: 'gracias',
    'thank you': 'muchas gracias',
    'game over': 'fin del juego',
    'good job': '¡buen trabajo!',
    'hello friend': '¡hola amigo!',
    cat: 'gato',
    cookie: 'galleta',
    love: 'amor',
    music: 'música',
    app: 'aplicación',
    world: 'mundo',
    'hello world': '¡hola mundo!',
  },
  fr: {
    hello: 'bonjour',
    hi: 'salut',
    friend: 'ami',
    friends: 'amis',
    welcome: 'bienvenue',
    magic: 'magie',
    star: 'étoile',
    stars: 'étoiles',
    score: 'score',
    points: 'points',
    winner: 'gagnant',
    win: 'gagner',
    jump: 'sauter',
    play: 'jouer',
    yes: 'oui',
    no: 'non',
    good: 'bon',
    job: 'travail',
    thanks: 'merci',
    'thank you': 'merci beaucoup',
    'game over': 'partie terminée',
    'good job': 'bravo !',
    'hello friend': 'bonjour mon ami !',
    cat: 'chat',
    cookie: 'biscuit',
    love: 'amour',
    music: 'musique',
    app: 'appli',
    world: 'monde',
    'hello world': 'bonjour le monde !',
  },
  ja: {
    hello: 'こんにちは',
    hi: 'やあ',
    friend: 'ともだち',
    welcome: 'ようこそ',
    magic: 'まほう',
    star: 'ほし',
    stars: 'ほし',
    score: 'スコア',
    points: 'ポイント',
    winner: 'しょうしゃ',
    win: 'かち',
    jump: 'ジャンプ',
    play: 'あそぶ',
    yes: 'はい',
    no: 'いいえ',
    thanks: 'ありがとう',
    'thank you': 'ありがとうございます',
    'game over': 'ゲームオーバー',
    'good job': 'すごいね！',
    'hello friend': 'こんにちは、ともだち！',
    cat: 'ねこ',
    cookie: 'クッキー',
    love: 'だいすき',
    music: 'おんがく',
    app: 'アプリ',
    world: 'せかい',
    'hello world': 'ハロー・ワールド！',
  },
  ko: {
    hello: '안녕하세요',
    hi: '안녕',
    friend: '친구',
    welcome: '환영합니다',
    magic: '마법',
    star: '별',
    stars: '별들',
    score: '점수',
    winner: '우승자',
    jump: '점프',
    play: '플레이',
    yes: '네',
    no: '아니요',
    thanks: '고마워요',
    'thank you': '감사합니다',
    'game over': '게임 오버',
    'good job': '참 잘했어요!',
    'hello friend': '안녕 친구!',
    cat: '고양이',
    cookie: '쿠키',
    love: '사랑',
    music: '음악',
    world: '세계',
    'hello world': '안녕 세상!',
  },
  de: {
    hello: 'hallo',
    hi: 'hi',
    friend: 'Freund',
    welcome: 'willkommen',
    magic: 'Magie',
    star: 'Stern',
    stars: 'Sterne',
    score: 'Punktestand',
    winner: 'Gewinner',
    jump: 'springen',
    play: 'spielen',
    yes: 'ja',
    no: 'nein',
    thanks: 'danke',
    'thank you': 'vielen Dank',
    'game over': 'Spiel vorbei',
    'good job': 'gut gemacht!',
    'hello friend': 'Hallo Freund!',
    cat: 'Katze',
    cookie: 'Keks',
    love: 'Liebe',
    music: 'Musik',
    world: 'Welt',
    'hello world': 'Hallo Welt!',
  },
  it: {
    hello: 'ciao',
    hi: 'ciao',
    friend: 'amico',
    welcome: 'benvenuto',
    magic: 'magia',
    star: 'stella',
    stars: 'stelle',
    score: 'punteggio',
    winner: 'vincitore',
    jump: 'saltare',
    play: 'giocare',
    yes: 'sì',
    no: 'no',
    thanks: 'grazie',
    'thank you': 'grazie mille',
    'game over': 'fine partita',
    'good job': 'ottimo lavoro!',
    'hello friend': 'ciao amico!',
    cat: 'gatto',
    cookie: 'biscotto',
    love: 'amore',
    music: 'musica',
    world: 'mondo',
    'hello world': 'ciao mondo!',
  },
  pt: {
    hello: 'olá',
    hi: 'oi',
    friend: 'amigo',
    welcome: 'bem-vindo',
    magic: 'magia',
    star: 'estrela',
    stars: 'estrelas',
    score: 'pontuação',
    winner: 'vencedor',
    jump: 'pular',
    play: 'jogar',
    yes: 'sim',
    no: 'não',
    thanks: 'obrigado',
    'thank you': 'muito obrigado',
    'game over': 'fim de jogo',
    'good job': 'bom trabalho!',
    'hello friend': 'olá amigo!',
    cat: 'gato',
    cookie: 'biscoito',
    love: 'amor',
    music: 'música',
    world: 'mundo',
    'hello world': 'olá mundo!',
  },
  emoji: {
    hello: '👋😊',
    hi: '👋',
    friend: '🧑‍🤝‍🧑',
    welcome: '🎉🤗',
    magic: '✨🪄',
    star: '⭐',
    stars: '🌟✨',
    score: '🏆🔢',
    winner: '🥇👑',
    win: '🏆',
    jump: '🦘⬆️',
    play: '🎮',
    yes: '✅',
    no: '❌',
    thanks: '🙏💛',
    'thank you': '🙏✨',
    'game over': '💀🎮',
    'good job': '👏🌟',
    'hello friend': '👋😊🧑‍🤝‍🧑',
    cat: '🐱',
    cookie: '🍪',
    love: '💖',
    music: '🎵🎶',
    app: '📱',
    world: '🌍',
    'hello world': '👋🌍✨',
  },
};

export function translateScratchText(rawText: string, lang: string): string {
  const dict = DICTIONARY[lang];
  if (!dict) return rawText;
  const trimmed = rawText.trim();
  const normalized = trimmed.toLowerCase().replace(/[!?.]+$/g, '');
  if (dict[normalized]) {
    return dict[normalized];
  }
  // Word-by-word translation preserving punctuation
  return trimmed.replace(/[A-Za-z]+/g, (word) => {
    const mapped = dict[word.toLowerCase()];
    if (!mapped) return word;
    if (word[0] === word[0].toUpperCase() && mapped[0]) {
      return mapped[0].toUpperCase() + mapped.slice(1);
    }
    return mapped;
  });
}
