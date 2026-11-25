import { useState } from 'react';
import { Check, Globe2, Lock, Plus, Search, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI, Avatar } from '../components/ui';
import { PostCard } from '../components/PostCard';
import { Composer } from '../components/Composer';
import { navigate } from '../lib/router';
import { nfmt } from '../lib/util';

export function GroupsPage() {
  const { state, joinGroup, user } = useStore();
  const ui = useUI();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'joined' | 'discover'>('all');

  const list = state.groups.filter(
    (g) =>
      (!q || g.name.toLowerCase().includes(q.toLowerCase())) &&
      (filter === 'all' || (filter === 'joined' ? g.joined : !g.joined)),
  );

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <h1>Groups</h1>
          <p>Small rooms for the things you keep coming back to.</p>
        </div>
        <button className="btn btn-brand" onClick={() => ui.toast('Group creation is stubbed in this demo — join one of the groups below')}>
          <Plus size={17} /> Create group
        </button>
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="searchbox" style={{ width: 320 }}>
          <span className="search-icon"><Search size={16} /></span>
          <input placeholder="Search groups" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg" style={{ width: 320 }}>
          {(['all', 'joined', 'discover'] as const).map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'joined' ? 'Your groups' : 'Discover'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-3">
        {list.map((g) => (
          <article key={g.id} className="card group-card">
            <a href={`#/groups/${g.id}`} className="gc-cover tile-cover" style={{ borderRadius: 0, display: 'block' }}>
              <img src={g.cover} alt="" loading="lazy" />
              <div className="cover-tint" />
              <span className="tag" style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,.55)', color: '#fff' }}>
                {g.privacy === 'Public' ? <Globe2 size={11} /> : <Lock size={11} />} {g.privacy}
              </span>
            </a>
            <div className="gc-body">
              <a href={`#/groups/${g.id}`} className="gc-name" style={{ display: 'block' }}>{g.name}</a>
              <div className="gc-meta">{nfmt(g.members)} members · {g.desc.split('.')[0]}.</div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                <div className="row" style={{ gap: 0 }}>
                  {['priya', 'hannah', 'omar'].map((u, i) => (
                    <img key={u} src={user(u).avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--surface)', marginLeft: i ? -7 : 0 }} />
                  ))}
                  <span className="hint" style={{ marginLeft: 7 }}>+{nfmt(Math.max(0, g.members - 3))}</span>
                </div>
                <button
                  className={`btn btn-sm ${g.joined ? 'btn-soft' : 'btn-brand'}`}
                  onClick={() => {
                    joinGroup(g.id);
                    ui.toast(g.joined ? `Left ${g.name}` : `Joined ${g.name}`);
                  }}
                >
                  {g.joined ? <><Check size={14} /> Joined</> : <><Plus size={14} /> Join</>}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {list.length === 0 && (
        <div className="card empty-state">
          <div className="es-icon"><Users size={26} /></div>
          <h3>No groups found</h3>
          <p>Try a different search or browse all groups.</p>
        </div>
      )}
    </div>
  );
}

export function GroupDetailPage({ id }: { id: string }) {
  const { state, joinGroup, user } = useStore();
  const ui = useUI();
  const [composerOpen, setComposerOpen] = useState(false);
  const group = state.groups.find((g) => g.id === id);

  if (!group) {
    return (
      <div className="page-wrap narrow">
        <div className="card empty-state">
          <h3>Group not found</h3>
          <p>That group may have been archived. <a className="link" href="#/groups">Browse groups</a></p>
        </div>
      </div>
    );
  }

  const groupPosts = state.posts.filter((p) => p.groupId === group.id).sort((a, b) => b.at - a.at);
  const members = state.friends.slice(0, 6).map((x) => user(x));

  return (
    <div className="page-wrap mid">
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ position: 'relative', height: 230 }}>
          <img src={group.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div className="cover-tint" />
        </div>
        <div style={{ padding: '0 22px 18px' }}>
          <h1 style={{ fontSize: 30, letterSpacing: '-.04em', marginTop: -18, position: 'relative', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.4)' }}>
            {group.name}
          </h1>
          <div className="profile-meta" style={{ marginTop: 8 }}>
            <span className="row" style={{ gap: 5 }}>
              {group.privacy === 'Public' ? <Globe2 size={14} /> : <Lock size={14} />} {group.privacy} group
            </span>
            <span>·</span>
            <span>{nfmt(group.members)} members</span>
            <span>·</span>
            <span>Created {group.joined ? 'by a friend' : 'recently'}</span>
          </div>
          <p style={{ marginTop: 10, color: 'var(--text-2)', fontSize: 14.5, maxWidth: 620 }}>{group.desc}</p>
          <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className={`btn ${group.joined ? 'btn-soft' : 'btn-brand'}`} onClick={() => { joinGroup(group.id); ui.toast(group.joined ? `Left ${group.name}` : `Joined ${group.name}`); }}>
              {group.joined ? <><Check size={16} /> Joined</> : <><Plus size={16} /> Join group</>}
            </button>
            <button className="btn btn-soft" onClick={() => ui.openCompose({ text: `Posting to ${group.name}\n\n` })}>Create post</button>
            <button className="btn btn-soft" onClick={() => ui.toast('Invite link copied (demo)')}>Invite</button>
          </div>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'flex-start', gap: 18, marginTop: 18, flexWrap: 'wrap' }}>
        <div className="feed grow" style={{ flexBasis: 480 }}>
          <div className="card composer">
            <div className="composer-top">
              <button className="composer-fake" onClick={() => setComposerOpen(true)}>Write something to {group.name.split('—')[0].trim()}…</button>
            </div>
          </div>
          {groupPosts.map((p) => (
            <PostCard key={p.id} post={p} hideGroup />
          ))}
          {groupPosts.length === 0 && (
            <div className="card empty-state">
              <div className="es-icon"><Users size={26} /></div>
              <h3>Be the first to post here</h3>
              <p>Group posts you write are saved locally so you can see exactly how it flows.</p>
              <button className="btn btn-brand" style={{ marginTop: 14 }} onClick={() => setComposerOpen(true)}>Write a post</button>
            </div>
          )}
        </div>
        <div className="widget" style={{ flexBasis: 280, flexGrow: 1 }}>
          <div className="widget-head"><span>Members</span><span className="more">{nfmt(group.members)}</span></div>
          <div className="widget-body">
            {members.map((u) => (
              <button key={u.id} className="list-row" style={{ padding: 8, width: '100%' }} onClick={() => navigate(`/profile/${u.id}`)}>
                <Avatar user={u} size={34} />
                <div className="grow">
                  <div className="lr-title truncate">{u.name}</div>
                  <div className="lr-sub">Friend</div>
                </div>
              </button>
            ))}
          </div>
          <div className="widget-head" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <span>Group rules</span>
          </div>
          <div className="widget-body" style={{ fontSize: 13, color: 'var(--muted)', padding: '0 16px 14px', lineHeight: 1.6 }}>
            Be generous with context. Give credit. No drive-by self-promo. If it’s not for the group, it’s not for the group.
          </div>
        </div>
      </div>
      {composerOpen && <Composer onClose={() => setComposerOpen(false)} groupId={group.id} />}
    </div>
  );
}
