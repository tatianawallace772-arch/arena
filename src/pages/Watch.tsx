import { useRef, useState } from 'react';
import { Play, Search, Volume2, VolumeX, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { Avatar, useUI } from '../components/ui';
import { nfmt, timeAgo } from '../lib/util';
import type { Video } from '../lib/types';

export function WatchPage() {
  const { state, user } = useStore();
  const ui = useUI();
  const [q, setQ] = useState('');
  const [active, setActive] = useState<Video | null>(null);

  const videos = state.videos.filter((v) => !q || v.title.toLowerCase().includes(q.toLowerCase()));
  const featured = videos[0];

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <h1>Watch</h1>
          <p>Short things worth the four minutes.</p>
        </div>
        <div className="searchbox" style={{ width: 280 }}>
          <span className="search-icon"><Search size={16} /></span>
          <input placeholder="Search videos" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {featured && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 20, padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)' }}>
            <button style={{ position: 'relative', background: '#000', display: 'block', aspectRatio: '16/9' }} onClick={() => setActive(featured)}>
              <img src={featured.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.95 }} />
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,0,0,.5)', color: '#fff', display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}>
                  <Play size={26} fill="currentColor" />
                </span>
              </span>
              <span className="tag" style={{ position: 'absolute', top: 12, left: 12, background: 'var(--brand)', color: '#fff', fontWeight: 700 }}>
                Featured
              </span>
            </button>
            <div style={{ padding: 20 }}>
              <h2 style={{ fontSize: 21, lineHeight: 1.25, letterSpacing: '-.025em' }}>{featured.title}</h2>
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <Avatar user={user(featured.authorId)} size={30} />
                <span style={{ fontWeight: 650, fontSize: 14 }}>{user(featured.authorId).name}</span>
              </div>
              <div className="hint" style={{ marginTop: 8 }}>
                {nfmt(featured.views)} views · {timeAgo(featured.at)} ago · {featured.length}
              </div>
              <p className="muted" style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.6 }}>
                Filmed on the ridge above Durango. Trailbound leads sunrise hikes every Saturday through October — six spots per trip.
              </p>
              <button className="btn btn-brand" style={{ marginTop: 16 }} onClick={() => setActive(featured)}>
                <Play size={16} /> Watch now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        {['All', 'Live', 'Hikes', 'Food', 'Design', 'Music'].map((c, i) => (
          <button key={c} className={`chip ${i === 0 ? 'active' : ''}`} onClick={() => ui.toast(`Filtered to ${c} (demo)`)}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid-4">
        {videos.map((v) => (
          <article key={v.id} className="card watch-card" onClick={() => setActive(v)}>
            <div className="wc-thumb">
              <img src={v.poster} alt="" loading="lazy" />
              <div className="play-badge">
                <span><Play size={20} fill="currentColor" /></span>
              </div>
              <span className="wc-len">{v.length}</span>
            </div>
            <div className="wc-body">
              <div className="wc-title clamp-2">{v.title}</div>
              <div className="wc-sub">
                <span>{user(v.authorId).name}</span>
                <span>·</span>
                <span>{nfmt(v.views)} views</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {active && <VideoOverlay video={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function VideoOverlay({ video, onClose }: { video: Video; onClose: () => void }) {
  const { user, state } = useStore();
  const [muted, setMuted] = useState(true);
  const ref = useRef<HTMLVideoElement>(null);
  const related = state.videos.filter((v) => v.id !== video.id);

  return (
    <div className="scrim" style={{ padding: 24, placeItems: 'center' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 980, width: '100%', gap: 14 }}>
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', boxShadow: 'var(--shadow-lg)' }}>
          <video
            ref={ref}
            src={video.src}
            poster={video.poster}
            autoPlay
            loop
            playsInline
            controls
            muted={muted}
            style={{ width: '100%', maxHeight: '68vh', display: 'block' }}
          />
          <button className="lb-close" style={{ top: 12, right: 12 }} onClick={onClose} aria-label="Close video">
            <X size={20} />
          </button>
          <button
            className="icon-btn"
            style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(0,0,0,.5)', color: '#fff' }}
            onClick={() => {
              if (ref.current) ref.current.muted = !ref.current.muted;
              setMuted((m) => !m);
            }}
            aria-label="Toggle sound"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 16 }}>
          <h3 style={{ fontSize: 18, marginBottom: 6 }}>{video.title}</h3>
          <div className="row" style={{ gap: 8 }}>
            <Avatar user={user(video.authorId)} size={32} />
            <span style={{ fontWeight: 650 }}>{user(video.authorId).name}</span>
            <span className="hint">· {nfmt(video.views)} views · {timeAgo(video.at)} ago</span>
          </div>
          <div className="divider" />
          <div className="row" style={{ gap: 8, overflowX: 'auto' }}>
            {related.map((v) => (
              <img key={v.id} src={v.poster} alt="" style={{ width: 130, height: 76, objectFit: 'cover', borderRadius: 8, flex: 'none', cursor: 'pointer' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
