/**
 * Themes. Tokens are referenced by name everywhere in the TUI so that the same
 * component code renders in dark / light / ansi palettes.
 *
 * Colour values: '#rrggbb' truecolour, a number = 256-colour index (used by the
 * "ansi" theme so it follows the user's own terminal palette).
 */

const DARK = {
  name: 'dark',
  label: 'Dark (default)',
  xterm: {
    background: '#1F1E1D',
    foreground: '#F0EEE6',
    cursor: '#D97757',
    cursorAccent: '#1F1E1D',
    selectionBackground: '#3B3733',
    black: '#1F1E1D',
    red: '#D16D6D',
    green: '#7CB97F',
    yellow: '#D9A15B',
    blue: '#6A9BD5',
    magenta: '#B58FD1',
    cyan: '#6FB5B5',
    white: '#C9C5BC',
    brightBlack: '#6E6A64',
    brightRed: '#E58A8A',
    brightGreen: '#9BD39E',
    brightYellow: '#EFC07A',
    brightBlue: '#8FB8E8',
    brightMagenta: '#CDA9E4',
    brightCyan: '#96D2D2',
    brightWhite: '#F0EEE6',
  },
  c: {
    bg: '#1F1E1D',
    fg: '#F0EEE6',
    dim: '#98938A',
    faint: '#6E6A64',
    accent: '#D97757',
    accentSoft: '#E5A183',
    panel: '#262523',
    panelAlt: '#2C2A28',
    border: '#403C37',
    borderFocus: '#8A6B57',
    green: '#7CB97F',
    red: '#D16D6D',
    yellow: '#D9A15B',
    blue: '#6A9BD5',
    magenta: '#B58FD1',
    cyan: '#6FB5B5',
    diffAdd: '#7CB97F',
    diffDel: '#D16D6D',
    diffAddBg: '#22301E',
    diffDelBg: '#33201C',
    codeBg: '#262523',
    kw: '#C586C0',
    str: '#CE9178',
    num: '#B5CEA8',
    com: '#6A955B',
    fn: '#DCDCAA',
    type: '#4EC9B0',
    punc: '#A8A49C',
    prop: '#9CDCFE',
    meta: '#569CD6',
    tag: '#569CD6',
    link: '#6A9BD5',
  },
};

const LIGHT = {
  name: 'light',
  label: 'Light',
  xterm: {
    background: '#FAF9F5',
    foreground: '#1F1E1D',
    cursor: '#C15F3C',
    cursorAccent: '#FAF9F5',
    selectionBackground: '#E3DFD3',
    black: '#1F1E1D',
    red: '#B03A3A',
    green: '#3D7A45',
    yellow: '#96692A',
    blue: '#2A5FA8',
    magenta: '#7B3F96',
    cyan: '#2A7272',
    white: '#D8D4CB',
    brightBlack: '#8A857C',
    brightRed: '#C15F5F',
    brightGreen: '#5A9560',
    brightYellow: '#B0863F',
    brightBlue: '#4E7FBF',
    brightMagenta: '#9A63B4',
    brightCyan: '#4E9A9A',
    brightWhite: '#F5F3EE',
  },
  c: {
    bg: '#FAF9F5',
    fg: '#1F1E1D',
    dim: '#6E6A64',
    faint: '#9A958C',
    accent: '#C15F3C',
    accentSoft: '#B7563A',
    panel: '#F0EEE6',
    panelAlt: '#EAE7DD',
    border: '#D0CBBF',
    borderFocus: '#C15F3C',
    green: '#3D7A45',
    red: '#B03A3A',
    yellow: '#96692A',
    blue: '#2A5FA8',
    magenta: '#7B3F96',
    cyan: '#2A7272',
    diffAdd: '#3D7A45',
    diffDel: '#B03A3A',
    diffAddBg: '#E4F1DE',
    diffDelBg: '#FBE3DE',
    codeBg: '#F0EEE6',
    kw: '#8B2E9B',
    str: '#A3401F',
    num: '#1A6B4F',
    com: '#5A8A4A',
    fn: '#6A4C10',
    type: '#0F6E68',
    punc: '#6E6A64',
    prop: '#204060',
    meta: '#2A5FA8',
    tag: '#2A5FA8',
    link: '#2A5FA8',
  },
};

// Follows the terminal's own palette: semantic colours map to ANSI indices.
const ANSI = {
  name: 'ansi',
  label: 'ANSI 16-colour',
  xterm: null, // keep the user's palette
  c: {
    bg: null,
    fg: null,
    dim: 8,
    faint: 8,
    accent: 1,
    accentSoft: 9,
    panel: null,
    panelAlt: null,
    border: 8,
    borderFocus: 1,
    green: 2,
    red: 1,
    yellow: 3,
    blue: 4,
    magenta: 5,
    cyan: 6,
    diffAdd: 2,
    diffDel: 1,
    diffAddBg: null,
    diffDelBg: null,
    codeBg: null,
    kw: 5,
    str: 3,
    num: 2,
    com: 8,
    fn: 4,
    type: 6,
    punc: 8,
    prop: 7,
    meta: 4,
    tag: 4,
    link: 4,
  },
};

export const THEMES = { dark: DARK, light: LIGHT, ansi: ANSI };
export const THEME_ORDER = ['dark', 'light', 'ansi'];

export class Theme {
  constructor(def = DARK) {
    this.def = def;
    this.name = def.name;
    this.label = def.label;
    this.colors = def.c;
    this.cache = new Map();
  }

  color(token) {
    return this.colors[token] ?? null;
  }

  /**
   * Resolve a token name (or several layered ones) into a style object for Screen.
   * @param {string} token
   * @param {{bold?:boolean,dim?:boolean,italic?:boolean,underline?:boolean,inverse?:boolean}} [extra]
   */
  style(token, extra) {
    const key = token + (extra ? JSON.stringify(extra) : '');
    let hit = this.cache.get(key);
    if (hit) return hit;
    const c = this.colors;
    const style = { ...(extra || {}) };
    switch (token) {
      case 'text':
        break;
      case 'dim':
        style.fg = c.dim;
        break;
      case 'faint':
        style.fg = c.faint;
        break;
      case 'accent':
        style.fg = c.accent;
        break;
      case 'bold':
        style.bold = true;
        break;
      case 'border':
        style.fg = c.border;
        break;
      case 'borderFocus':
        style.fg = c.borderFocus;
        break;
      case 'panel':
        style.bg = c.panel;
        break;
      case 'panelAlt':
        style.bg = c.panelAlt;
        break;
      case 'inverse':
        style.inverse = true;
        break;
      case 'code':
        style.fg = c.fg;
        style.bg = c.codeBg;
        break;
      default:
        if (c[token] !== undefined) style.fg = c[token];
    }
    // drop null colours (inherit)
    if (style.fg === null) delete style.fg;
    if (style.bg === null) delete style.bg;
    hit = style;
    this.cache.set(key, hit);
    return hit;
  }

  /** xterm.js theme payload (null → leave the default palette alone). */
  xtermTheme() {
    return this.def.xterm;
  }
}

export function themeByName(name) {
  return new Theme(THEMES[name] || DARK);
}
