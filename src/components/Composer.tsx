import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, MapPin, Smile, Type, X, Newspaper, Video, Flag, Check } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI } from './ui';
import { fileToDataUrl } from '../lib/media';
import type { Post } from '../lib/types';

export const BACKGROUNDS: Array<{ key: string; label: string }> = [
  { key: 'sunset', label: 'Sunset' },
  { key: 'ocean', label: 'Ocean' },
  { key: 'forest', label: 'Forest' },
  { key: 'plum', label: 'Plum' },
  { key: 'rose', label: 'Rose' },
  { key: 'slate', label: 'Slate' },
];

const FEELINGS = ['🙂 happy', '🔥 motivated', '☕ caffeinated', '😅 grateful', '🎉 excited', '🥲 nostalgic', '🐶 loved'];

export function Composer({
  onClose,
  prefill,
  groupId,
}: {
  onClose: () => void;
  prefill?: { text?: string; media?: string[] };
  groupId?: string;
}) {
  const { createPost, me, user, state, addNotification } = useStore();
  const ui = useUI();
  const [text, setText] = useState(prefill?.text ?? '');
  const [images, setImages] = useState<string[]>(prefill?.media ?? []);
  const [audience, setAudience] = useState<Post['audience']>(groupId ? 'group' : 'public');
  const [background, setBackground] = useState<string | null>(prefill?.text ? 'sunset' : null);
  const [feeling, setFeeling] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);
  const [showFeelingMenu, setShowFeelingMenu] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const group = groupId ? state.groups.find((g) => g.id === groupId) : undefined;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls = await Promise.all(Array.from(files).slice(0, 4).map((f) => fileToDataUrl(f)));
      setImages((prev) => [...prev, ...urls].slice(0, 4));
      setBackground(null);
    } catch (err) {
      ui.toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canPost = (text.trim().length > 0 || images.length > 0) && !busy;

  const submit = () => {
    if (!canPost) return;
    createPost({
      text: text.trim(),
      media: images.length ? { type: 'photo', images, src: images[0] } : undefined,
      audience,
      background: images.length ? undefined : background ?? undefined,
      feeling: feeling ?? undefined,
      location: location.trim() || undefined,
      groupId,
    });
    addNotification({ kind: 'group', userId: 'me', text: 'Your post is live on your feed.' });
    ui.toast('Posted to Junction');
    onClose();
  };

  const remaining = 2800 - text.length;

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal compose-modal">
        <div className="modal-head">
          <h3>Create post</h3>
          <button className="icon-btn plain" onClick={onClose} aria-label="Close composer">
            <X size={20} />
          </button>
        </div>

        <div className="compose-area">
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <img className="avatar" src={me.avatar} alt="" width={44} height={44} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{me.name}</div>
              {group ? (
                <div className="muted" style={{ fontSize: 12.5 }}>Posting in {group.name}</div>
              ) : (
                <button className="row" style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text-2)', gap: 5 }} onClick={() => setShowAudienceMenu((v) => !v)}>
                  <span className="tag" style={{ background: 'var(--surface-2)' }}>
                    {audience === 'public' ? '🌐 Public' : audience === 'friends' ? '👥 Friends' : '🔒 Only me'}
                  </span>
                </button>
              )}
              {showAudienceMenu && (
                <div className="menu" style={{ position: 'absolute', top: 26, left: 0, minWidth: 210 }}>
                  {[
                    { k: 'public', t: 'Public', d: 'Anyone on Junction' },
                    { k: 'friends', t: 'Friends', d: 'Your friends only' },
                    { k: 'only-me', t: 'Only me', d: 'Just you, saved to archive' },
                  ].map((a) => (
                    <button
                      key={a.k}
                      className="menu-item"
                      onClick={() => {
                        setAudience(a.k as Post['audience']);
                        setShowAudienceMenu(false);
                      }}
                    >
                      <span className="mi-label">
                        {a.t}
                        <span className="mi-sub">{a.d}</span>
                      </span>
                      {audience === a.k && <Check size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <textarea
            autoFocus
            placeholder={`What’s on your mind, ${me.name.split(' ')[0]}?`}
            value={text}
            maxLength={2800}
            onChange={(e) => setText(e.target.value)}
            style={background && !images.length ? { minHeight: 90 } : undefined}
          />

          {feeling && (
            <div className="row" style={{ gap: 6, marginTop: -6, flexWrap: 'wrap' }}>
              <span className="tag">Feeling {feeling}</span>
              <button className="icon-btn plain" style={{ width: 22, height: 22 }} onClick={() => setFeeling(null)} aria-label="Remove feeling">
                <X size={13} />
              </button>
            </div>
          )}
          {location && (
            <div className="row" style={{ gap: 6, marginTop: -4 }}>
              <span className="tag"><MapPin size={12} /> {location}</span>
              <button className="icon-btn plain" style={{ width: 22, height: 22 }} onClick={() => setLocation('')} aria-label="Remove location">
                <X size={13} />
              </button>
            </div>
          )}

          {images.length > 0 && (
            <div className="upload-preview">
              <img src={images[0]} alt="Upload preview" />
              <button className="remove" onClick={() => setImages(images.slice(1))} aria-label="Remove photo">
                <X size={16} />
              </button>
              {images.length > 1 && (
                <span className="tag" style={{ position: 'absolute', left: 8, bottom: 8, background: 'rgba(0,0,0,.6)', color: '#fff' }}>
                  +{images.length - 1} more
                </span>
              )}
            </div>
          )}

          {!images.length && (
            <div className="bg-picker">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.key}
                  className={`bg-swatch ${background === b.key ? 'active' : ''}`}
                  style={{
                    background: {
                      sunset: 'linear-gradient(150deg,#c8553d,#e58b4f)',
                      ocean: 'linear-gradient(150deg,#0f4c5c,#1c7c8c)',
                      forest: 'linear-gradient(150deg,#14532d,#2f855a)',
                      plum: 'linear-gradient(150deg,#4c1d95,#7c3aed)',
                      rose: 'linear-gradient(150deg,#9f1239,#e11d48)',
                      slate: 'linear-gradient(150deg,#0f172a,#334155)',
                    }[b.key],
                  }}
                  onClick={() => setBackground(background === b.key ? null : b.key)}
                  aria-label={`${b.label} background`}
                  title={b.label}
                >
                  Aa
                </button>
              ))}
            </div>
          )}

          {background && text.trim() && !images.length && (
            <div
              className="post-text-bg"
              style={{
                marginTop: 10,
                borderRadius: 12,
                minHeight: 190,
                background: {
                  sunset: 'linear-gradient(150deg,#c8553d,#e58b4f 55%,#8a3f2c)',
                  ocean: 'linear-gradient(150deg,#0f4c5c,#1c7c8c 55%,#0b2e3a)',
                  forest: 'linear-gradient(150deg,#14532d,#2f855a 55%,#0f3d24)',
                  plum: 'linear-gradient(150deg,#4c1d95,#7c3aed 55%,#2e1065)',
                  rose: 'linear-gradient(150deg,#9f1239,#e11d48 55%,#6b0f2a)',
                  slate: 'linear-gradient(150deg,#0f172a,#334155 55%,#0b1120)',
                }[background],
              }}
            >
              {text}
            </div>
          )}

          <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <div className="compose-toolbar">
              <button className="tool-btn" onClick={() => photoRef.current?.click()}>
                <ImageIcon size={15} color="var(--green)" /> Photo
              </button>
              <button className="tool-btn" onClick={() => ui.toast('Live video needs a camera in this demo')}>
                <Video size={15} color="var(--red)" /> Live
              </button>
              <button className="tool-btn" onClick={() => setShowFeelingMenu((v) => !v)}>
                <Smile size={15} color="#d69e2e" /> Feeling
              </button>
              <button className="tool-btn" onClick={() => setShowLocationInput(true)}>
                <MapPin size={15} color="#e53e3e" /> Check in
              </button>
              <button className="tool-btn" onClick={() => { setBackground(background ? null : 'sunset'); }} title="Text background">
                <Type size={15} /> Aa
              </button>
              <button className="tool-btn" onClick={() => { setText(text + '\n\n#weekend #junction'); }}>
                <Flag size={15} color="var(--accent)" /> Tag
              </button>
            </div>
          </div>

          {showFeelingMenu && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {FEELINGS.map((f) => (
                <button key={f} className="chip" onClick={() => { setFeeling(f); setShowFeelingMenu(false); }}>
                  {f}
                </button>
              ))}
            </div>
          )}

          {showLocationInput && (
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <input
                autoFocus
                className="input grow"
                placeholder="Where are you? e.g. Portland, OR"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setLocation((e.target as HTMLInputElement).value);
                    setShowLocationInput(false);
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value.trim()) setLocation(e.target.value.trim());
                }}
              />
              <button className="btn btn-soft btn-sm" onClick={() => setShowLocationInput(false)}>Done</button>
            </div>
          )}

          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              onFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Newspaper size={13} /> Demo mode — feeds, friends, and posts live in your browser
            <span className="kbd">{remaining}</span>
          </span>
          <button className="btn btn-brand" disabled={!canPost} style={!canPost ? { opacity: 0.5, cursor: 'default' } : undefined} onClick={submit}>
            {busy ? 'Processing…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
