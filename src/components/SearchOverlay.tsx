import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI, Avatar } from './ui';
import { navigate } from '../lib/router';
import { nfmt } from '../lib/util';

type Item =
  | { kind: 'person'; id: string; title: string; sub: string; avatar?: string }
  | { kind: 'group'; id: string; title: string; sub: string; img?: string }
  | { kind: 'post'; id: string; title: string; sub: string }
  | { kind: 'listing'; id: string; title: string; sub: string; img?: string }
  | { kind: 'video'; id: string; title: string; sub: string; img?: string }
  | { kind: 'page'; id: string; title: string; sub: string; avatar?: string };

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { state, user, addRecentSearch } = useStore();
  const ui = useUI();
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = useMemo<Item[]>(() => {
    const term = q.trim().toLowerCase();
    const out: Item[] = [];
    const people = Object.values(state.users).filter((u) => !term || u.name.toLowerCase().includes(term) || u.handle.toLowerCase().includes(term));
    people.slice(0, term ? 5 : 4).forEach((u) =>
      out.push({ kind: (u.page ? 'page' : 'person') as 'page' | 'person', id: u.id, title: u.name, sub: u.work ?? u.location ?? u.handle, avatar: u.avatar }),
    );
    state.groups
      .filter((g) => !term || g.name.toLowerCase().includes(term))
      .slice(0, term ? 3 : 2)
      .forEach((g) => out.push({ kind: 'group', id: g.id, title: g.name, sub: `${nfmt(g.members)} members · ${g.privacy}`, img: g.cover }));
    state.posts
      .filter((p) => term && p.text.toLowerCase().includes(term))
      .slice(0, 3)
      .forEach((p) => out.push({ kind: 'post', id: p.id, title: p.text.slice(0, 80), sub: `Post by ${user(p.authorId).name}` }));
    state.listings
      .filter((l) => term && l.title.toLowerCase().includes(term))
      .slice(0, 3)
      .forEach((l) => out.push({ kind: 'listing', id: l.id, title: l.title, sub: `$${l.price} · ${l.place}`, img: l.image }));
    state.videos
      .filter((v) => term && v.title.toLowerCase().includes(term))
      .slice(0, 2)
      .forEach((v) => out.push({ kind: 'video', id: v.id, title: v.title, sub: `${nfmt(v.views)} views`, img: v.poster }));
    // page shortcuts
    if (term) {
      const pages: Array<[string, string, string]> = [
        ['/friends', 'Friends', 'People you know'],
        ['/messages', 'Messenger', 'Your conversations'],
        ['/watch', 'Watch', 'Videos and reels'],
        ['/marketplace', 'Marketplace', 'Buy and sell nearby'],
        ['/events', 'Events', 'What’s coming up'],
        ['/saved', 'Saved', 'Your saved posts'],
        ['/import', 'Import from Facebook', 'Bring public page data in'],
      ];
      pages
        .filter(([path, title]) => title.toLowerCase().includes(term) || path.includes(term))
        .slice(0, 3)
        .forEach(([path, title, sub]) => out.push({ kind: 'page', id: path, title, sub }));
    }
    return out;
  }, [q, state.users, state.groups, state.posts, state.listings, state.videos, user]);

  const open = (item: Item) => {
    addRecentSearch(item.title);
    switch (item.kind) {
      case 'person':
      case 'page':
        navigate(item.id.startsWith('/') ? item.id : `/profile/${item.id}`);
        break;
      case 'group':
        navigate(`/groups/${item.id}`);
        break;
      case 'post':
        navigate(`/post/${item.id}`);
        break;
      case 'listing':
        navigate(`/marketplace/${item.id}`);
        break;
      case 'video':
        navigate('/watch');
        break;
    }
    onClose();
  };

  return (
    <div className="search-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-panel" role="dialog" aria-label="Search Junction">
        <div className="search-input-wrap">
          <Search size={21} style={{ color: 'var(--muted)' }} />
          <input
            ref={inputRef}
            placeholder="Search people, groups, posts, Marketplace…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setHl(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(items.length - 1, h + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(0, h - 1)); }
              if (e.key === 'Enter' && items[hl]) open(items[hl]);
            }}
          />
          <button className="icon-btn plain" onClick={onClose} aria-label="Close search"><X size={19} /></button>
        </div>

        <div className="search-body">
          {!q && state.recentSearches.length > 0 && (
            <>
              <div className="search-group-title">Recent searches</div>
              {state.recentSearches.map((s) => (
                <button key={s} className="search-result" onClick={() => setQ(s)}>
                  <span className="thumb"><Search size={17} /></span>
                  <span className="grow"><span className="sr-title">{s}</span></span>
                  <CornerDownLeft size={15} style={{ color: 'var(--faint)' }} />
                </button>
              ))}
            </>
          )}

          {items.length > 0 && (
            <div className="search-group-title">{q ? 'Top results' : 'People and places'}</div>
          )}
          {items.map((item, i) => (
            <button key={`${item.kind}-${item.id}`} className={`search-result ${hl === i ? 'hl' : ''}`} onClick={() => open(item)} onMouseEnter={() => setHl(i)}>
              {item.kind === 'person' || item.kind === 'page' ? (
                <Avatar user={user(item.id)} size={42} />
              ) : 'img' in item && item.img ? (
                <img src={item.img} alt="" />
              ) : (
                <span className="thumb">{item.kind === 'post' ? '📝' : item.kind === 'group' ? '👥' : '🔎'}</span>
              )}
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="sr-title" style={{ display: 'block' }}>{item.title}</span>
                <span className="sr-sub">{item.sub} · {item.kind === 'person' ? 'Person' : item.kind === 'page' ? 'Page' : item.kind === 'group' ? 'Group' : item.kind === 'post' ? 'Post' : item.kind === 'listing' ? 'Marketplace' : item.kind === 'video' ? 'Video' : 'Shortcut'}</span>
              </span>
              <CornerDownLeft size={15} style={{ color: 'var(--faint)' }} />
            </button>
          ))}

          {q && items.length === 0 && (
            <div className="empty-state">
              <div className="es-icon"><Search size={24} /></div>
              <h3>No results for “{q}”</h3>
              <p>Try a person’s name, a group, or a post topic. Junction search covers this demo’s local data.</p>
            </div>
          )}
        </div>
        <div style={{ borderTop: '1px solid var(--line)', padding: '8px 14px', display: 'flex', gap: 14, color: 'var(--faint)', fontSize: 12 }}>
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> navigate</span>
          <span><span className="kbd">↵</span> open</span>
          <span><span className="kbd">esc</span> close</span>
          <button style={{ marginLeft: 'auto', color: 'var(--brand)', fontWeight: 650 }} onClick={() => { ui.toast('Search is local to this demo'); }}>
            Search tips
          </button>
        </div>
      </div>
    </div>
  );
}
