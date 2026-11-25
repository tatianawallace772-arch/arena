import { useMemo, useState } from 'react';
import { CalendarDays, Flag, Store, Video } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI, Avatar } from '../components/ui';
import { StoryTray } from '../components/Stories';
import { PostCard } from '../components/PostCard';
import { LeftRail, RightRail } from '../components/Chrome';
import { navigate } from '../lib/router';
import { birthdayIsToday } from '../lib/util';
import { EVENT_LIST } from './Events';

const TABS = [
  { key: 'foryou', label: 'For you' },
  { key: 'friends', label: 'Friends' },
  { key: 'groups', label: 'Groups' },
  { key: 'saved', label: 'Saved' },
] as const;

export function HomePage() {
  const { state, me, user, addFriend } = useStore();
  const ui = useUI();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('foryou');

  const posts = useMemo(() => {
    let list = state.posts.filter((p) => !(state.archived ?? []).includes(p.id));
    if (tab === 'friends') list = list.filter((p) => state.friends.includes(p.authorId) || p.authorId === 'me');
    if (tab === 'groups') list = list.filter((p) => !!p.groupId);
    if (tab === 'saved') list = list.filter((p) => p.saved);
    return [...list].sort((a, b) => b.at - a.at);
  }, [state.posts, state.friends, state.archived, tab]);

  const birthdayFriends = state.friends.map((id) => user(id)).filter((u) => birthdayIsToday(u.birthday));
  const upNext = EVENT_LIST.find((e) => e.upcoming) ?? EVENT_LIST[0];

  return (
    <div className="layout">
      <LeftRail />
      <div className="feed">
        <div className="filter-bar">
          {TABS.map((t) => (
            <button key={t.key} className={`chip ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <StoryTray />

        {birthdayFriends.length > 0 && (
          <button
            className="card"
            style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left' }}
            onClick={() => navigate(`/profile/${birthdayFriends[0].id}`)}
          >
            <span style={{ fontSize: 26 }}>🎂</span>
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{birthdayFriends[0].name} has a birthday today</div>
              <div className="muted" style={{ fontSize: 13 }}>Send them a note — it takes 10 seconds and they’ll remember it.</div>
            </div>
            <span className="btn btn-sm btn-brand">Say happy birthday</span>
          </button>
        )}

        <div className="composer card">
          <div className="composer-top">
            <button onClick={() => navigate(`/profile/${me.id}`)}>
              <Avatar user={me} size={40} />
            </button>
            <button className="composer-fake" onClick={() => ui.openCompose()}>
              What’s on your mind, {me.name.split(' ')[0]}?
            </button>
          </div>
          <div className="composer-actions">
            <button className="composer-action" onClick={() => ui.openCompose()}>
              <Video size={20} color="var(--red)" /> <span>Live video</span>
            </button>
            <button className="composer-action" onClick={() => ui.openCompose()}>
              <Flag size={20} color="var(--accent)" /> <span>Photo / event</span>
            </button>
            <button className="composer-action" onClick={() => navigate('/marketplace')}>
              <Store size={19} color="#b45309" /> <span>Marketplace</span>
            </button>
          </div>
        </div>

        <section className="card" style={{ padding: '12px 0', overflow: 'hidden' }}>
          <div className="widget-head" style={{ padding: '0 16px 6px' }}>
            <span>Up next for you</span>
            <a className="more" href="#/events">See all events</a>
          </div>
          <button className="list-row" style={{ margin: '0 8px', width: 'calc(100% - 16px)' }} onClick={() => navigate(`/events/${upNext.id}`)}>
            <div className="event-cal">
              <div className="m">{upNext.month}</div>
              <div className="d">{upNext.day}</div>
            </div>
            <div className="grow">
              <div className="lr-title">{upNext.title}</div>
              <div className="lr-sub">
                {upNext.when} · {upNext.where} · {upNext.going} going
              </div>
            </div>
            <CalendarDays size={18} className="muted" />
          </button>
        </section>

        {posts.length === 0 && (
          <div className="card empty-state">
            <div className="es-icon"><Flag size={26} /></div>
            <h3>Nothing here yet</h3>
            <p>{tab === 'saved' ? 'Tap the ••• menu on any post and choose “Save post” to keep it for later.' : 'Follow more people or start a conversation to fill your feed.'}</p>
          </div>
        )}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="section-title">People you may know</span>
            <a className="link" href="#/friends" style={{ fontSize: 13.5 }}>See all</a>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            {state.suggestions.slice(0, 4).map((id) => {
              const u = user(id);
              return (
                <div key={id} className="list-row">
                  <button onClick={() => navigate(`/profile/${id}`)}>
                    <Avatar user={u} size={42} />
                  </button>
                  <div className="grow">
                    <div className="lr-title truncate">{u.name}</div>
                    <div className="lr-sub truncate">{u.bio ?? 'New to Junction'}</div>
                  </div>
                  <button className="btn btn-sm btn-soft" onClick={() => { addFriend(id); ui.toast(`Friend request sent to ${u.name}`); }}>
                    Add friend
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="muted" style={{ textAlign: 'center', fontSize: 12.5, padding: '14px 0 0' }}>
          You’re all caught up · {posts.length} posts
        </div>
      </div>
      <RightRail />
    </div>
  );
}
