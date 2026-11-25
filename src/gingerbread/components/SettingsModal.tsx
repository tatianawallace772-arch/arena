import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Music2, Pause, Play, RotateCcw, Trash2, Upload, Volume2, VolumeX, X } from 'lucide-react';
import type { AudioMood, Settings } from '../lib/types';
import { bakeryAudio, type SfxName } from '../lib/audio';
import { ART_STICKERS, GLYPH_STICKERS, ALL_STICKERS } from '../lib/data';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  eventCount: number;
  stickerCount: number;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
  onClearAll: () => void;
  /** Custom soundtrack panel, rendered inside the sound section. */
  trackPanel?: ReactNode;
}

export default function SettingsModal({
  settings,
  onChange,
  onClose,
  eventCount,
  stickerCount,
  onReset,
  onExport,
  onImport,
  onClearAll,
  trackPanel,
}: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [draftVolumes, setDraftVolumes] = useState({
    sfx: settings.sfxVolume,
    music: settings.musicVolume,
  });
  const previewTimer = useRef<number | null>(null);

  useEffect(() => {
    setDraftVolumes({ sfx: settings.sfxVolume, music: settings.musicVolume });
  }, [settings.sfxVolume, settings.musicVolume]);

  const preview = (name: SfxName) => {
    bakeryAudio.setSfxVolume(draftVolumes.sfx);
    bakeryAudio.play(name);
  };

  const onSfxSlide = (v: number) => {
    setDraftVolumes((d) => ({ ...d, sfx: v }));
    bakeryAudio.setSfxVolume(v);
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => bakeryAudio.play('place'), 120);
  };

  const onMusicSlide = (v: number) => {
    setDraftVolumes((d) => ({ ...d, music: v }));
    bakeryAudio.setMusicVolume(v);
  };

  const MOODS: { id: AudioMood; label: string; blurb: string }[] = [
    { id: 'gingerbread', label: 'Gingerbread', blurb: 'Cozy 3/4 waltz, warm celesta' },
    { id: 'frost', label: 'Frost', blurb: 'Slower, airier, more sleigh bells' },
    { id: 'quiet', label: 'Quiet Bakery', blurb: 'Barely-there music-box hum' },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="modal-head">
          <span aria-hidden style={{ fontSize: 20 }}>⚙️</span>
          <h2>Bakery settings</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Week starts on</label>
            <div className="viewswitch" style={{ width: 'fit-content' }}>
              {([0, 1] as const).map((v) => (
                <button
                  key={v}
                  className={settings.weekStartsOn === v ? 'active' : ''}
                  onClick={() => onChange({ weekStartsOn: v })}
                >
                  {v === 0 ? 'Sunday' : 'Monday'}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Density</label>
            <div className="viewswitch" style={{ width: 'fit-content' }}>
              {(['cozy', 'compact'] as const).map((v) => (
                <button key={v} className={settings.density === v ? 'active' : ''} onClick={() => onChange({ density: v })}>
                  {v === 'cozy' ? 'Cozy' : 'Compact'}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.showHolidays}
              onChange={(e) => onChange({ showHolidays: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: 'var(--pine)' }}
            />
            Show holiday cookies 🎄
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={settings.celebration}
              onChange={(e) => onChange({ celebration: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: 'var(--pine)' }}
            />
            Sprinkle confetti on save
          </label>

          {/* ---------------- Web Audio ---------------- */}
          <div className="card" style={{ boxShadow: 'none' }}>
            <div className="card-head">
              <span aria-hidden>🔊</span>
              <span className="card-title">Sound &amp; music</span>
              <span className="spacer" />
              <span className="smallcaps">Web Audio</span>
            </div>
            <div className="card-body" style={{ display: 'grid', gap: 13 }}>
              <div className="audio-row">
                <button
                  className={`icon-btn ${settings.soundOn ? 'is-on' : ''}`}
                  aria-pressed={settings.soundOn}
                  aria-label={settings.soundOn ? 'Mute interface sounds' : 'Unmute interface sounds'}
                  onClick={() => {
                    onChange({ soundOn: !settings.soundOn });
                    if (!settings.soundOn) window.setTimeout(() => preview('tap'), 40);
                  }}
                >
                  {settings.soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <div className="audio-row-body">
                  <div className="audio-row-title">Interface sounds</div>
                  <div className="audio-row-sub">Candy-cane pops, cookie presses, sprinkle snips</div>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={100}
                    value={Math.round(draftVolumes.sfx * 100)}
                    aria-label="Sound effect volume"
                    disabled={!settings.soundOn}
                    onChange={(e) => onSfxSlide(Number(e.target.value) / 100)}
                    onPointerUp={() => onChange({ sfxVolume: draftVolumes.sfx })}
                    onKeyUp={() => onChange({ sfxVolume: draftVolumes.sfx })}
                  />
                </div>
                <span className="vol-read">{Math.round(draftVolumes.sfx * 100)}</span>
              </div>

              <div className="audio-row">
                <button
                  className={`icon-btn ${settings.musicOn ? 'is-on' : ''}`}
                  aria-pressed={settings.musicOn}
                  aria-label={settings.musicOn ? 'Pause soundtrack' : 'Play soundtrack'}
                  onClick={() => onChange({ musicOn: !settings.musicOn })}
                >
                  {settings.musicOn ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <div className="audio-row-body">
                  <div className="audio-row-title">
                    Gingerbread soundtrack
                    {settings.musicOn && (
                      <span className="eq inline" aria-hidden>
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>
                  <div className="audio-row-sub">
                    {settings.trackMode === 'custom'
                      ? `Your uploaded track${settings.trackLibrary.length === 1 ? '' : 's'} (${settings.trackLibrary.length})`
                      : 'Generative music-box loop — no audio files, all synthesised'}
                  </div>
                  <input
                    type="range"
                    className="slider"
                    min={0}
                    max={100}
                    value={Math.round(draftVolumes.music * 100)}
                    aria-label="Music volume"
                    disabled={!settings.musicOn}
                    onChange={(e) => onMusicSlide(Number(e.target.value) / 100)}
                    onPointerUp={() => onChange({ musicVolume: draftVolumes.music })}
                    onKeyUp={() => onChange({ musicVolume: draftVolumes.music })}
                  />
                </div>
                <span className="vol-read">{Math.round(draftVolumes.music * 100)}</span>
              </div>

              <div className="field">
                <label>Soundtrack mood</label>
                <div className="mood-row">
                  {MOODS.map((m) => (
                    <button
                      key={m.id}
                      className={`mood ${settings.mood === m.id ? 'active' : ''}`}
                      onClick={() => onChange({ mood: m.id })}
                      title={m.blurb}
                    >
                      <Music2 size={13} />
                      <b>{m.label}</b>
                      <span>{m.blurb}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Try the sounds</label>
                <div className="sfx-grid">
                  {(
                    [
                      ['tap', 'Tap', '👆'],
                      ['save', 'Save', '✅'],
                      ['place', 'Sticker', '🍪'],
                      ['delete', 'Delete', '🧹'],
                      ['open', 'Open', '📂'],
                      ['close', 'Close', '📁'],
                      ['error', 'Oops', '⚠️'],
                      ['celebrate', 'Party', '🎉'],
                    ] as [SfxName, string, string][]
                  ).map(([id, label, glyph]) => (
                    <button key={id} className="sfx-btn" onClick={() => preview(id)} disabled={!settings.soundOn}>
                      <span aria-hidden>{glyph}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {trackPanel}

          <div className="card" style={{ boxShadow: 'none' }}>
            <div className="card-head">
              <span aria-hidden>🏷️</span>
              <span className="card-title">Your sticker library</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ALL_STICKERS.map((s) => (
                  <span
                    key={s.id}
                    title={s.name}
                    style={{
                      width: 34,
                      height: 34,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 9,
                      border: '1.5px solid var(--cookie-200)',
                      background: '#fffdf8',
                      fontSize: 17,
                      overflow: 'hidden',
                    }}
                  >
                    {s.kind === 'art' ? <img src={s.src} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : s.glyph}
                  </span>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 11.5, marginBottom: 0 }}>
                {ART_STICKERS.length} art stickers · {GLYPH_STICKERS.length} cookie stickers · {eventCount} events ·{' '}
                {stickerCount} placed on the calendar.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={onExport}>
              <Download size={13} /> Export JSON
            </button>
            <button className="btn btn-sm" onClick={onImport}>
              <Upload size={13} /> Import JSON
            </button>
            <button className="btn btn-sm" onClick={onReset}>
              <RotateCcw size={13} /> Restore sample plans
            </button>
            {confirmReset ? (
              <button className="btn btn-sm btn-primary" onClick={onClearAll}>
                <Trash2 size={13} /> Yes, delete everything
              </button>
            ) : (
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmReset(true)}>
                <Trash2 size={13} /> Delete all data
              </button>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <span className="muted" style={{ fontSize: 11.5 }}>
            Everything is stored locally in your browser.
          </span>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
