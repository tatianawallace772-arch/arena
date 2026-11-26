import React, { useRef, useState } from 'react';
import { Music, Play, Plus, Trash2, Upload, Volume2 } from 'lucide-react';
import { BUILTIN_SOUNDS } from '../data/assets';
import { audioEngine } from '../engine/audio';
import type { SoundAsset, SpriteModel } from '../types/studio';

interface SoundStudioProps {
  sprite: SpriteModel;
  onAddSound: (sound: SoundAsset) => void;
  onUpdateSound: (soundId: string, patch: Partial<SoundAsset>) => void;
  onDeleteSound: (soundId: string) => void;
}

export const SoundStudio: React.FC<SoundStudioProps> = ({
  sprite,
  onAddSound,
  onUpdateSound,
  onDeleteSound,
}) => {
  const [selectedId, setSelectedId] = useState<string>(sprite.sounds[0]?.id ?? '');
  const [synthWave, setSynthWave] = useState<OscillatorType>('triangle');
  const [synthFreq, setSynthFreq] = useState(520);
  const [synthDur, setSynthDur] = useState(0.32);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeSound =
    sprite.sounds.find((s) => s.id === selectedId) ?? sprite.sounds[0] ?? null;

  const handleCreateSynth = () => {
    const newSnd: SoundAsset = {
      id: `snd_${Date.now()}`,
      name: `Synth ${synthWave} ${synthFreq}Hz`,
      preset: 'custom',
      pitch: 1,
      speed: 1,
      waveform: synthWave,
      baseFreq: synthFreq,
      duration: synthDur,
    };
    onAddSound(newSnd);
    setSelectedId(newSnd.id);
    void audioEngine.playAsset(newSnd);
  };

  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const uploaded: SoundAsset = {
          id: `snd_${Date.now()}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          preset: 'custom',
          pitch: 1,
          speed: 1,
          customDataUrl: reader.result,
        };
        onAddSound(uploaded);
        setSelectedId(uploaded.id);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="sound-studio">
      <aside className="costume-sidebar">
        <div className="sidebar-head">Sprite Sounds ({sprite.sounds.length})</div>
        <div className="costume-list">
          {sprite.sounds.map((s, idx) => (
            <div
              key={s.id}
              className={`sound-card ${activeSound?.id === s.id ? 'active' : ''}`}
              onClick={() => setSelectedId(s.id)}
            >
              <div className="sound-card-icon">
                <Volume2 size={18} />
              </div>
              <div className="sound-card-meta">
                <strong>
                  {idx + 1}. {s.name}
                </strong>
                <span>
                  Pitch {s.pitch.toFixed(1)}× · Speed {s.speed.toFixed(1)}×
                </span>
              </div>
              {sprite.sounds.length > 1 && (
                <button
                  type="button"
                  className="icon-ghost"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onDeleteSound(s.id);
                  }}
                  title="Delete sound"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="costume-add-stack">
          <button
            type="button"
            className="studio-btn"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} /> Upload Audio
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={handleUploadAudio}
          />
        </div>
      </aside>

      <div className="sound-main">
        {activeSound && (
          <div className="sound-inspector-card">
            <div className="sound-header-row">
              <input
                type="text"
                className="costume-title-input"
                value={activeSound.name}
                onChange={(e) => onUpdateSound(activeSound.id, { name: e.target.value })}
              />
              <button
                type="button"
                className="studio-btn primary"
                onClick={() => void audioEngine.playAsset(activeSound)}
              >
                <Play size={15} /> Play Sound
              </button>
            </div>

            {/* Decorative Waveform Visualizer */}
            <div className="waveform-display">
              {Array.from({ length: 36 }).map((_, i) => {
                const h = Math.round(
                  18 +
                    Math.abs(
                      Math.sin(i * 0.45 * activeSound.pitch) *
                        Math.cos(i * 0.14) *
                        64
                    )
                );
                return <span key={i} style={{ height: `${h}%` }} />;
              })}
            </div>

            <div className="sound-sliders-grid">
              <label>
                <span>Pitch Shift ({activeSound.pitch.toFixed(2)}×)</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={activeSound.pitch}
                  onChange={(e) =>
                    onUpdateSound(activeSound.id, { pitch: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                <span>Playback Speed ({activeSound.speed.toFixed(2)}×)</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={activeSound.speed}
                  onChange={(e) =>
                    onUpdateSound(activeSound.id, { speed: Number(e.target.value) })
                  }
                />
              </label>
            </div>
          </div>
        )}

        <div className="sound-bottom-panels">
          <div className="sound-panel-box">
            <h4>
              <Music size={15} /> Web Audio Synth Lab
            </h4>
            <p className="muted-caption">
              Synthesize custom retro 8-bit &amp; arcade sound effects for your Blockly blocks.
            </p>
            <div className="synth-controls">
              <label>
                <span>Waveform</span>
                <select
                  value={synthWave}
                  onChange={(e) => setSynthWave(e.target.value as OscillatorType)}
                >
                  <option value="triangle">Triangle (Warm)</option>
                  <option value="square">Square (8-Bit Retro)</option>
                  <option value="sine">Sine (Pure Bell)</option>
                  <option value="sawtooth">Sawtooth (Laser)</option>
                </select>
              </label>
              <label>
                <span>Frequency: {synthFreq} Hz</span>
                <input
                  type="range"
                  min={110}
                  max={1320}
                  value={synthFreq}
                  onChange={(e) => setSynthFreq(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Length: {synthDur.toFixed(2)}s</span>
                <input
                  type="range"
                  min={0.08}
                  max={1.0}
                  step={0.04}
                  value={synthDur}
                  onChange={(e) => setSynthDur(Number(e.target.value))}
                />
              </label>
            </div>
            <button type="button" className="studio-btn primary" onClick={handleCreateSynth}>
              <Plus size={14} /> Add Custom Synth SFX
            </button>
          </div>

          <div className="sound-panel-box">
            <h4>Preset SFX Library</h4>
            <div className="preset-sfx-grid">
              {BUILTIN_SOUNDS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset-chip-btn"
                  onClick={() => {
                    void audioEngine.playAsset(preset);
                    if (!sprite.sounds.some((s) => s.name === preset.name)) {
                      onAddSound({ ...preset, id: `snd_${Date.now()}` });
                    }
                  }}
                >
                  <Play size={12} /> {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
