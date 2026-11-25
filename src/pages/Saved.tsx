import { useState } from 'react';
import { Bookmark, Clock3, Heart, Tag } from 'lucide-react';
import { useStore } from '../lib/store';
import { PostCard } from '../components/PostCard';
import { navigate } from '../lib/router';
import { useUI } from '../components/ui';

export function SavedPage() {
  const { state } = useStore();
  const [tab, setTab] = useState<'posts' | 'listings' | 'collections'>('posts');
  const posts = state.posts.filter((p) => p.saved);
  const listings = state.listings.filter((l) => l.saved);

  return (
    <div className="page-wrap narrow">
      <div className="page-head">
        <div>
          <h1>Saved</h1>
          <p>{posts.length} posts · {listings.length} listings · {state.recentSearches.length} recent searches</p>
        </div>
      </div>
      <div className="seg" style={{ maxWidth: 440, marginBottom: 18 }}>
        <button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}><Bookmark size={15} /> Posts</button>
        <button className={tab === 'listings' ? 'active' : ''} onClick={() => setTab('listings')}><Tag size={15} /> Listings</button>
        <button className={tab === 'collections' ? 'active' : ''} onClick={() => setTab('collections')}><Heart size={15} /> Collections</button>
      </div>
      {tab === 'posts' && (
        <div className="feed">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
          {posts.length === 0 && (
            <div className="card empty-state">
              <div className="es-icon"><Bookmark size={26} /></div>
              <h3>Nothing saved yet</h3>
              <p>Use the ••• menu on a post and choose Save post to keep it here.</p>
            </div>
          )}
        </div>
      )}
      {tab === 'listings' && (
        <div className="market-grid">
          {listings.map((l) => (
            <button key={l.id} className="card market-card" onClick={() => navigate(`/marketplace/${l.id}`)} style={{ textAlign: 'left' }}>
              <div className="mc-img"><img src={l.image} alt="" /></div>
              <div className="mc-body">
                <div className="mc-price">${l.price}</div>
                <div className="mc-title clamp-2">{l.title}</div>
                <div className="mc-place">{l.place}</div>
              </div>
            </button>
          ))}
          {listings.length === 0 && (
            <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
              <h3>No saved listings</h3>
              <p>Tap the bookmark on any Marketplace item to keep it around.</p>
            </div>
          )}
        </div>
      )}
      {tab === 'collections' && <CollectionsTab />}
    </div>
  );
}

function CollectionsTab() {
  const { state } = useStore();
  const ui = useUI();
  return (
    <div className="grid-2">
      <div className="card card-pad">
        <h3 style={{ fontSize: 16 }}>Weekend plans</h3>
        <p className="hint" style={{ marginTop: 4 }}>Trail routes, coffee spots, that bakery.</p>
        <div className="photo-grid" style={{ marginTop: 10 }}>
          <div className="ph"><img src="/assets/photos/hike.jpg" alt="" /></div>
          <div className="ph"><img src="/assets/photos/cafe.jpg" alt="" /></div>
          <div className="ph"><img src="/assets/photos/bread.jpg" alt="" /></div>
        </div>
      </div>
      <div className="card card-pad">
        <h3 style={{ fontSize: 16 }}>Reading list</h3>
        <p className="hint" style={{ marginTop: 4 }}>Lena’s recs and the long article I keep postponing.</p>
        <div className="stack" style={{ gap: 8, marginTop: 12 }}>
          {['The Phantom Tollbooth', 'Why We Stopped Taking the Fast Road', 'Design systems after the rebrand'].map((t) => (
            <button key={t} className="list-row" style={{ padding: 8 }} onClick={() => ui.toast('Collections are visual demos here')}>
              <Clock3 size={16} className="muted" /> <span className="lr-title">{t}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="card card-pad" style={{ gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: 16 }}>Recent searches</h3>
        <div className="filter-bar" style={{ marginTop: 10 }}>
          {state.recentSearches.map((s) => (
            <span key={s} className="chip">{s}</span>
          ))}
          {state.recentSearches.length === 0 && <span className="hint">No searches yet.</span>}
        </div>
      </div>
    </div>
  );
}
