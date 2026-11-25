import { Github, Import, Shield, Sparkles, Zap } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="page-wrap mid">
      <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ position: 'relative', padding: '38px 30px', background: 'linear-gradient(140deg,#b8452f, #c8553d 40%, #7c3aed)' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <span className="tag" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', backdropFilter: 'blur(4px)' }}>
              <Sparkles size={12} /> Demo build
            </span>
            <h1 style={{ color: '#fff', fontSize: 38, letterSpacing: '-.045em', marginTop: 10, lineHeight: 1.05 }}>
              Junction
            </h1>
            <p style={{ color: 'rgba(255,255,255,.9)', maxWidth: 560, marginTop: 8, fontSize: 15.5, lineHeight: 1.6 }}>
              A fully functional social network front end: feed, stories, reactions, comments, messenger, groups, watch,
              marketplace, events, memories, and an importer that turns public Facebook pages into live Junction pages.
            </p>
          </div>
          <div style={{ position: 'absolute', right: -30, bottom: -50, fontSize: 220, fontWeight: 800, color: 'rgba(255,255,255,.08)', fontFamily: 'var(--display)', lineHeight: 1 }}>
            j
          </div>
        </div>
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18 }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <Zap size={18} color="var(--brand)" style={{ marginTop: 2 }} />
            <div>
              <b>Everything works</b>
              <p className="hint">Posts, reactions, comments, friends, messages, and saves persist in localStorage.</p>
            </div>
          </div>
          <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <Import size={18} color="var(--brand)" style={{ marginTop: 2 }} />
            <div>
              <b>Real import path</b>
              <p className="hint">
                <code>tools/fb_import.py</code> wraps <code>facebook-scraper</code> and emits a JSON bundle that the Import page turns
                into a page account plus posts.
              </p>
            </div>
          </div>
          <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <Shield size={18} color="var(--brand)" style={{ marginTop: 2 }} />
            <div>
              <b>No backend, no tracking</b>
              <p className="hint">No accounts, no servers, no cookies beyond your own browser storage.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Scraper → Junction pipeline</h3>
          <ol style={{ margin: '0 0 0 18px', color: 'var(--text-2)', fontSize: 14, lineHeight: 1.8 }}>
            <li><code>pip install facebook-scraper</code></li>
            <li><code>python tools/fb_import.py --page &lt;handle&gt; --out bundle.json</code></li>
            <li>Import → load the bundle → posts appear in the feed and on the page.</li>
          </ol>
          <a className="btn btn-soft btn-sm" href="#/import" style={{ marginTop: 12 }}><Import size={14} /> Open the importer</a>
        </div>
        <div className="card card-pad">
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Stack</h3>
          <div className="filter-bar" style={{ margin: 0 }}>
            {['React 19', 'TypeScript', 'Vite 6', 'lucide-react', 'Hash routing', 'localStorage', 'Python 3', 'facebook-scraper'].map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            All imagery is AI-generated for this demo. Junction is not affiliated with Meta Platforms, and the scraper
            should only be used on public data you have permission to collect.
          </p>
          <a className="btn btn-sm btn-ghost" href="https://github.com/kevinzg/facebook-scraper" target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
            <Github size={14} /> facebook-scraper on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
