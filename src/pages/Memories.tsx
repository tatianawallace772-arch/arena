import { useState } from 'react';
import { Clock3, Share2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI } from '../components/ui';

const MEMORIES = [
  { id: 'm1', years: 1, title: 'Ridge hike with Daniel', img: '/assets/photos/hike.jpg', caption: 'A year ago today you were above the treeline.' },
  { id: 'm2', years: 2, title: 'The midnight bread experiment', img: '/assets/photos/bread.jpg', caption: 'Two years ago: the starter that finally worked.' },
  { id: 'm3', years: 3, title: 'First pottery class', img: '/assets/photos/pottery.jpg', caption: 'Three years ago, before the mugs got round.' },
  { id: 'm4', years: 1, title: 'Lena’s library reading', img: '/assets/photos/books.jpg', caption: 'A year ago at the reading room.' },
  { id: 'm5', years: 4, title: 'Road trip, day two', img: '/assets/photos/coast.jpg', caption: 'Four years ago: three podcasts and a wrong turn.' },
  { id: 'm6', years: 2, title: 'Market Saturday', img: '/assets/photos/market.jpg', caption: 'Two years ago, tomatoes that ruWell everything.' },
];

export function MemoriesPage() {
  const ui = useUI();
  const [i, setI] = useState(0);
  const m = MEMORIES[i];

  return (
    <div className="page-wrap mid">
      <div className="page-head">
        <div>
          <h1>Memories</h1>
          <p>Things you shared on this day, once upon a time.</p>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden', padding: 0, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
          <div style={{ position: 'relative', minHeight: 340 }}>
            <img src={m.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            <div className="cover-tint" />
            <span className="tag" style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,.55)', color: '#fff' }}>
              <Clock3 size={12} /> {m.years} year{m.years > 1 ? 's' : ''} ago
            </span>
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="hint" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>
              On this day
            </div>
            <h2 style={{ fontSize: 26, letterSpacing: '-.035em', marginTop: 6 }}>{m.title}</h2>
            <p style={{ color: 'var(--text-2)', marginTop: 8, lineHeight: 1.6 }}>{m.caption}</p>
            <div className="row" style={{ gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              <button className="btn btn-brand" onClick={() => ui.toast('Shared to your story')}>
                <Share2 size={16} /> Share to story
              </button>
              <button className="btn btn-soft" onClick={() => setI((i + 1) % MEMORIES.length)}>Next memory</button>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 18 }}>
              {MEMORIES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setI(idx)}
                  aria-label={`Memory ${idx + 1}`}
                  style={{ width: idx === i ? 22 : 8, height: 8, borderRadius: 99, background: idx === i ? 'var(--brand)' : 'var(--line-strong)', transition: 'all .2s' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <h2 className="section-title" style={{ marginBottom: 12 }}>More from your archive</h2>
      <div className="grid-4">
        {MEMORIES.map((mem) => (
          <button key={mem.id} className="card memory-card" onClick={() => setI(MEMORIES.indexOf(mem))}>
            <img src={mem.img} alt="" loading="lazy" />
            <div className="mem-label">
              <b>{mem.title}</b>
              <span>{mem.years} year{mem.years > 1 ? 's' : ''} ago</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
