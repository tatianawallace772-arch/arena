import { useEffect, useState, type ChangeEvent } from 'react';
import { RotateCcw, Upload } from 'lucide-react';

type FontChoice = 'inter' | 'manrope' | 'roboto-flex' | 'custom';
type FontFormat = 'woff2' | 'woff' | 'truetype' | 'opentype';

interface CustomFont {
  name: string;
  dataUrl: string;
  format: FontFormat;
}

const FONT_CHOICE_KEY = 'interstate:font-family';
const CUSTOM_FONT_KEY = 'interstate:custom-font';
const MAX_FONT_BYTES = 1_000_000;

const FONT_STACKS: Record<Exclude<FontChoice, 'custom'>, string> = {
  inter: "'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  manrope: "'Manrope Variable', Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  'roboto-flex': "'Roboto Flex Variable', 'Roboto Flex', Arial, sans-serif",
};

const FORMATS: Record<string, FontFormat> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
};

function readCustomFont(): CustomFont | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem(CUSTOM_FONT_KEY) ?? 'null') as Partial<CustomFont> | null;
    if (
      value &&
      typeof value.name === 'string' &&
      typeof value.dataUrl === 'string' &&
      ['woff2', 'woff', 'truetype', 'opentype'].includes(value.format ?? '')
    ) {
      return value as CustomFont;
    }
  } catch {
    // Ignore stale or malformed custom-font preferences.
  }
  return null;
}

function initialChoice(customFont: CustomFont | null): FontChoice {
  if (typeof localStorage === 'undefined') return 'inter';
  const saved = localStorage.getItem(FONT_CHOICE_KEY);
  if (saved === 'manrope' || saved === 'roboto-flex') return saved;
  if (saved === 'custom' && customFont) return 'custom';
  return 'inter';
}

export default function FontPicker() {
  const [customFont, setCustomFont] = useState<CustomFont | null>(() => readCustomFont());
  const [choice, setChoice] = useState<FontChoice>(() => initialChoice(readCustomFont()));
  const [message, setMessage] = useState('');

  useEffect(() => {
    const customStyleId = 'interstate-custom-font-face';
    const previousStyle = document.getElementById(customStyleId);
    if (choice === 'custom' && customFont) {
      const style = (previousStyle as HTMLStyleElement | null) ?? document.createElement('style');
      style.id = customStyleId;
      style.textContent = `@font-face { font-family: 'Interstate Custom'; src: url("${customFont.dataUrl}") format("${customFont.format}"); font-style: normal; font-weight: 100 900; font-display: swap; }`;
      if (!style.parentElement) document.head.appendChild(style);
      document.documentElement.style.setProperty('--font', "'Interstate Custom', Inter, sans-serif");
    } else {
      previousStyle?.remove();
      document.documentElement.style.setProperty('--font', FONT_STACKS[choice === 'custom' ? 'inter' : choice]);
    }

    try {
      localStorage.setItem(FONT_CHOICE_KEY, choice);
    } catch {
      // Font selection still applies for this session if storage is unavailable.
    }
  }, [choice, customFont]);

  function handleFontUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const format = FORMATS[extension];
    if (!format) {
      setMessage('Choose a WOFF2, WOFF, TTF, or OTF font file.');
      return;
    }
    if (file.size > MAX_FONT_BYTES) {
      setMessage('Font files must be 1 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setMessage('Could not read that font file.');
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setMessage('Could not read that font file.');
        return;
      }
      const font = { name: file.name.replace(/\.[^.]+$/, ''), dataUrl: reader.result, format };
      try {
        localStorage.setItem(CUSTOM_FONT_KEY, JSON.stringify(font));
      } catch {
        setMessage('Not enough browser storage for this font. Try a smaller file.');
        return;
      }
      setCustomFont(font);
      setChoice('custom');
      setMessage('Custom font saved in this browser.');
    };
    reader.readAsDataURL(file);
  }

  function removeCustomFont() {
    localStorage.removeItem(CUSTOM_FONT_KEY);
    setCustomFont(null);
    setChoice('inter');
    setMessage('Custom font removed.');
  }

  return (
    <div className="font-picker">
      <div className="font-picker-row">
        <label className="font-select-label">
          <span className="sr-only">Interface font</span>
          <select value={choice} onChange={(event) => setChoice(event.target.value as FontChoice)} aria-label="Interface font">
            <option value="inter">Inter · Google Font</option>
            <option value="manrope">Manrope · Google Font</option>
            <option value="roboto-flex">Roboto Flex · Google Font</option>
            {customFont && <option value="custom">{customFont.name} · Custom</option>}
          </select>
        </label>
        <label className="font-upload-btn" title="Upload a custom font file">
          <Upload size={14} />
          <span>Custom</span>
          <input type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" onChange={handleFontUpload} />
        </label>
        {customFont && (
          <button type="button" className="font-reset-btn" onClick={removeCustomFont} title="Remove custom font" aria-label="Remove custom font">
            <RotateCcw size={14} />
          </button>
        )}
      </div>
      <div className="font-picker-help" aria-live="polite">
        {message || 'Google Fonts are bundled locally; custom fonts stay in this browser.'}
      </div>
    </div>
  );
}
