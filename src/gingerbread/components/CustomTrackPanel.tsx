import { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  SkipBack,
  SkipForward,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { ACCEPTED_AUDIO, MAX_TRACK_BYTES, formatBytes, formatDuration } from '../lib/tracks';
import type { TrackMeta } from '../lib/tracks';
import type { Settings } from '../lib/types';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  playing: boolean;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  currentTime: number;
  duration: number;
  loadedTrack: TrackMeta | null;
  onToggle: () => void;
  onStop: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (ratio: number) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onPlayTrack: (id: string) => void;
  onRemoveTrack: (id: string) => void;
  onMoveTrack: (id: string, delta: number) => void;
}

export default function CustomTrackPanel({
  settings,
  onChange,
  playing,
  status,
  currentTime,
  duration,
  loadedTrack,
  onToggle,
  onStop,
  onPrevious,
  onNext,
  onSeek,
  onAddFiles,
  onPlayTrack,
  onRemoveTrack,
  onMoveTrack,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [open, setOpen] = useState(true);
  const library = settings.trackLibrary;

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div className="card" style={{ boxShadow: 'none' }}>
      <div className="card-head">
        <span aria-hidden>🎧</span>
        <span className="card-title">Custom soundtrack</span>
        <span className="spacer" />
        <span className="smallcaps">{library.length} file{library.length === 1 ? '' : 's'}</span>
        <button className="btn btn-sm btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {open && (
        <div className="card-body" style={{ display: 'grid', gap: 12 }}>
          {/* source switch */}
          <div className="field">
            <label>Soundtrack source</label>
            <div className="viewswitch" style={{ width: 'fit-content' }}>
              <button
                className={settings.trackMode === 'synth' ? 'active' : ''}
                onClick={() => onChange({ trackMode: 'synth' })}
              >
                🎼 Synth loop
              </button>
              <button
                className={settings.trackMode === 'custom' ? 'active' : ''}
                onClick={() => onChange({ trackMode: 'custom' })}
                disabled={library.length === 0}
                title={library.length === 0 ? 'Upload a track first' : 'Play your uploaded music'}
              >
                <ListMusic size={12} /> My music
              </button>
            </div>
            <span className="muted" style={{ fontSize: 11 }}>
              {settings.trackMode === 'custom'
                ? 'Your uploaded files play instead of the synthesised loop.'
                : 'A generative music-box loop, synthesised in the browser.'}
            </span>
          </div>

          {/* drop zone / upload */}
          <div
            className={`dropzone ${dragOver ? 'over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) onAddFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <Upload size={18} />
            <div>
              <b>Drop an audio file, or click to browse</b>
              <span>
                MP3 · M4A · AAC · OGG · Opus · WAV · FLAC · WebM — up to {formatBytes(MAX_TRACK_BYTES)} each
              </span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_AUDIO}
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) onAddFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {/* now playing */}
          {loadedTrack && (
            <div className="now-playing">
              <div className="np-art" aria-hidden>
                <span className={`np-disc ${playing ? 'spin' : ''}`}>🎵</span>
              </div>
              <div className="np-body">
                <div className="np-title" title={loadedTrack.name}>
                  {loadedTrack.name}
                </div>
                <div className="np-sub">
                  {formatDuration(currentTime)} / {formatDuration(duration || loadedTrack.duration)} ·{' '}
                  {formatBytes(loadedTrack.size)}
                  {status === 'loading' && ' · loading…'}
                  {status === 'error' && <span style={{ color: 'var(--peppermint-deep)' }}> · cannot play</span>}
                </div>
                <input
                  type="range"
                  className="slider"
                  min={0}
                  max={1000}
                  value={Math.round(progress * 1000)}
                  aria-label="Track position"
                  onChange={(e) => onSeek(Number(e.target.value) / 1000)}
                />
                <div className="np-controls">
                  <button className="btn btn-sm" onClick={onPrevious} aria-label="Previous track" title="Previous track">
                    <SkipBack size={12} />
                  </button>
                  <button className="btn btn-sm btn-pine" onClick={onToggle} aria-label={playing ? 'Pause track' : 'Play track'}>
                    {playing ? <Pause size={13} /> : <Play size={13} />}
                    {playing ? 'Pause' : 'Play'}
                  </button>
                  <button className="btn btn-sm" onClick={onNext} aria-label="Next track" title="Next track">
                    <SkipForward size={12} />
                  </button>
                  <button className="btn btn-sm" onClick={onStop} aria-label="Stop track">
                    <Square size={12} />
                  </button>
                  <button
                    className={`btn btn-sm ${settings.shuffleTracks ? 'btn-pine' : ''}`}
                    onClick={() => onChange({ shuffleTracks: !settings.shuffleTracks })}
                    aria-pressed={settings.shuffleTracks}
                    title="Shuffle the library"
                  >
                    <Shuffle size={12} />
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      onChange({
                        repeatTracks:
                          settings.repeatTracks === 'off' ? 'all' : settings.repeatTracks === 'all' ? 'one' : 'off',
                      })
                    }
                    title={`Repeat: ${settings.repeatTracks}`}
                  >
                    {settings.repeatTracks === 'one' ? <Repeat1 size={12} /> : <Repeat size={12} />}
                    <span style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {settings.repeatTracks}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* library */}
          {library.length === 0 ? (
            <div className="empty" style={{ padding: 18 }}>
              <span className="big">🎵</span>
              No custom tracks yet. Add a file above and it will loop with the calendar.
            </div>
          ) : (
            <div className="track-list">
              {library.map((t, i) => {
                const isCurrent = loadedTrack?.id === t.id;
                return (
                  <div key={t.id} className={`track-row ${isCurrent ? 'current' : ''}`}>
                    <button
                      className="track-play"
                      onClick={() => onPlayTrack(t.id)}
                      aria-label={`Play ${t.name}`}
                      title={`Play ${t.name}`}
                    >
                      {isCurrent && playing ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <div className="track-meta">
                      <div className="track-name" title={t.name}>
                        {t.name}
                      </div>
                      <div className="track-sub">
                        {formatDuration(t.duration)} · {formatBytes(t.size)} · {t.type.replace('audio/', '').toUpperCase()}
                      </div>
                    </div>
                    <div className="track-tools">
                      <button
                        className="btn btn-sm btn-ghost"
                        disabled={i === 0}
                        onClick={() => onMoveTrack(t.id, -1)}
                        aria-label="Move up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        disabled={i === library.length - 1}
                        onClick={() => onMoveTrack(t.id, 1)}
                        aria-label="Move down"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => onRemoveTrack(t.id)}
                        aria-label={`Remove ${t.name}`}
                        style={{ color: 'var(--peppermint-deep)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="muted" style={{ fontSize: 11, margin: 0, lineHeight: 1.5 }}>
            Files stay in this browser (IndexedDB) — nothing is uploaded anywhere. The music volume slider and dialog
            ducking apply to your tracks too.
          </p>
        </div>
      )}
    </div>
  );
}
