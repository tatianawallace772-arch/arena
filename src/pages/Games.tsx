import { useState } from 'react';
import { Gamepad2, Play, Trophy } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI } from '../components/ui';
import { nfmt } from '../lib/util';

const GAMES = [
  { id: 'g1', name: 'Word Round', players: 84210, color: '#4f46e5', cover: '/assets/photos/desk.jpg', desc: 'A four-letter word game that resets at midnight.' },
  { id: 'g2', name: 'Trail Trivia', players: 21908, color: '#0f766e', cover: '/assets/photos/hike.jpg', desc: 'State parks, mile markers, and the best diners on I-80.' },
  { id: 'g3', name: 'Pattern', players: 54002, color: '#be123c', cover: '/assets/photos/pottery.jpg', desc: 'Rotate tiles until the grid clicks. Gentle, infinite.' },
];

export function GamesPage() {
  const { state, user } = useStore();
  const ui = useUI();
  const [tab, setTab] = useState<'play' | 'leaderboard'>('play');

  return (
    <div className="page-wrap mid">
      <div className="page-head">
        <div>
          <h1>Games</h1>
          <p>A small arcade for the five minutes between meetings.</p>
        </div>
        <div className="seg" style={{ width: 260 }}>
          <button className={tab === 'play' ? 'active' : ''} onClick={() => setTab('play')}><Play size={14} /> Play</button>
          <button className={tab === 'leaderboard' ? 'active' : ''} onClick={() => setTab('leaderboard')}><Trophy size={14} /> Leaderboard</button>
        </div>
      </div>

      {tab === 'play' ? (
        <div className="grid-3">
          {GAMES.map((g) => (
            <article key={g.id} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ position: 'relative', aspectRatio: '1.8' }}>
                <img src={g.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(.85)' }} />
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(150deg, ${g.color}cc, ${g.color}55)` }} />
                <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, color: '#fff' }}>
                  <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.03em' }}>{g.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>{nfmt(g.players)} playing this week</div>
                </div>
              </div>
              <div style={{ padding: 14 }}>
                <p className="hint">{g.desc}</p>
                <button className="btn btn-brand btn-block" style={{ marginTop: 12 }} onClick={() => ui.toast(`${g.name} launches in a full build — this is the demo lobby`)}>
                  <Gamepad2 size={16} /> Play
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="widget-head"><span><Trophy size={16} /> This week’s leaders</span></div>
          <div className="widget-body">
            {[
              { uid: 'daniel', score: 18420, game: 'Trail Trivia' },
              { uid: 'lena', score: 17980, game: 'Word Round' },
              { uid: 'priya', score: 17110, game: 'Pattern' },
              { uid: 'hannah', score: 15950, game: 'Word Round' },
              { uid: 'omar', score: 14870, game: 'Pattern' },
              { uid: 'jonah', score: 14210, game: 'Trail Trivia' },
              { uid: 'maya', score: 13890, game: 'Word Round' },
            ].map((row, i) => {
              const u = user(row.uid);
              return (
                <div key={row.uid} className="list-row">
                  <span style={{ width: 26, fontWeight: 800, color: i < 3 ? 'var(--brand)' : 'var(--faint)', fontSize: 16 }}>{i + 1}</span>
                  <img src={u.avatar} alt="" className="avatar" width={38} height={38} />
                  <div className="grow">
                    <div className="lr-title">{u.name}</div>
                    <div className="lr-sub">{row.game}</div>
                  </div>
                  <span style={{ fontWeight: 750, fontFamily: 'var(--display)' }}>{row.score.toLocaleString()}</span>
                </div>
              );
            })}
            <p className="hint" style={{ padding: 10 }}>{state.friends.length + 1} of your friends are on the board.</p>
          </div>
        </div>
      )}
    </div>
  );
}
