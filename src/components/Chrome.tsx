import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, Bookmark, CalendarDays, ChevronDown, ChevronRight, Clapperboard, Clock3, Flag, Gamepad2, Grid2x2, HeartHandshake,
  Home, LogOut, MessageCircle, Moon, Newspaper, Plus, Search, Settings, ShoppingBag, Store, Sun, Users, UsersRound, Video, Zap,
} from 'lucide-react';
import { useStore } from '../lib/store';
import type { NotifKind } from '../lib/types';
import { timeAgo, birthdayIsToday } from '../lib/util';
import { Avatar, useUI } from './ui';
import { navigate, useRoute } from '../lib/router';

const NOTIF_ICON: Record<NotifKind, string> = {
  reaction: '👍',
  comment: '💬',
  friend: '👥',
  birthday: '🎂',
  group: '🏔️',
  mention: '📣',
  event: '📅',
  live: '🔴',
  tag: '🏷️',
};

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */
export function Topbar() {
  const { state, me, user, setTheme, markNotificationsRead } = useStore();
  const ui = useUI();
  const route = useRoute();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) setNotifOpen(false);
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const unread = state.notifications.filter((n) => !n.read).length;
  const unreadMsgs = state.conversations.reduce((n, c) => n + (c.unread ?? 0), 0);
  const requests = state.requests.length;
  const pendingFriendNotifs = state.notifications.filter((n) => n.kind === 'friend' && !n.read).length;

  const path = route.path;
  const isActive = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/friends', icon: UsersRound, label: 'Friends' },
    { to: '/watch', icon: Clapperboard, label: 'Watch' },
    { to: '/marketplace', icon: Store, label: 'Marketplace' },
    { to: '/groups', icon: Users, label: 'Groups' },
  ];

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="row" style={{ gap: 10 }}>
          <button className="brand" onClick={() => navigate('/')} aria-label="Junction home">
            <span className="brand-mark">j</span>
            <span className="brand-name">junction</span>
          </button>
          <div
            className="searchbox"
            role="button"
            tabIndex={0}
            style={{ cursor: 'text' }}
            onClick={ui.openSearch}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ui.openSearch()}
            aria-label="Search Junction"
          >
            <span className="search-icon">
              <Search size={17} />
            </span>
            <input
              placeholder="Search Junction"
              readOnly
              aria-label="Search Junction"
              tabIndex={-1}
              style={{ cursor: 'text' }}
            />
            <span className="kbd" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>⌘K</span>
          </div>
          <button className="icon-btn plain search-open-mobile" onClick={ui.openSearch} aria-label="Search">
            <Search size={20} />
          </button>
        </div>

        <nav className="topnav" aria-label="Primary">
          {navItems.map(({ to, icon: Icon, label }) => (
            <a
              key={to}
              href={`#${to}`}
              className={isActive(to) ? 'active' : ''}
              aria-label={label}
              title={label}
            >
              <Icon size={25} strokeWidth={isActive(to) ? 2.5 : 2} />
            </a>
          ))}
        </nav>

        <div className="topbar-right">
          <button className="icon-btn hide-mobile" onClick={() => ui.openCompose()} aria-label="Create post" title="Create post">
            <Plus size={21} />
          </button>
          <button className="icon-btn hide-mobile" onClick={() => navigate('/messages')} aria-label="Messages" title="Messenger">
            <MessageCircle size={20} />
            {unreadMsgs > 0 && <span className="badge-count">{unreadMsgs}</span>}
          </button>
          <button className="icon-btn hide-mobile" onClick={() => navigate('/friends/requests')} aria-label="Friend requests" title="Friend requests">
            <UsersRound size={20} />
            {requests > 0 && <span className="badge-count">{pendingFriendNotifs || requests}</span>}
          </button>
          <div className="popover-anchor" ref={anchorRef}>
            <button
              className={`icon-btn ${notifOpen ? 'active' : ''}`}
              onClick={() => {
                setNotifOpen((v) => !v);
                if (!notifOpen) markNotificationsRead();
              }}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              title="Notifications"
            >
              <Bell size={20} />
              {unread > 0 && <span className="badge-count">{unread}</span>}
            </button>
            {notifOpen && (
              <div className="popover" role="dialog" aria-label="Notifications">
                <div className="popover-head">
                  <h3>Notifications</h3>
                  <button className="btn btn-sm btn-brand" onClick={() => navigate('/notifications')}>See all</button>
                </div>
                <div className="popover-scroll">
                  {state.notifications.slice(0, 7).map((n) => {
                    const u = n.userId ? user(n.userId) : null;
                    return (
                      <button
                        key={n.id}
                        className={`notif-row ${n.read ? '' : 'unread'}`}
                        onClick={() => {
                          setNotifOpen(false);
                          if (n.kind === 'friend') navigate('/friends/requests');
                          else if (n.userId) navigate(`/profile/${n.userId}`);
                        }}
                      >
                        <span className="n-av">
                          {u ? <Avatar user={u} size={42} /> : <span className="avatar-letter" style={{ width: 42, height: 42, background: 'var(--brand)' }}>j</span>}
                          <span className="n-icon" style={{ fontSize: 11 }}>{NOTIF_ICON[n.kind]}</span>
                        </span>
                        <span className="grow">
                          <span className="n-text" style={{ display: 'block' }}>
                            {u && <b>{u.name} </b>}
                            {n.text}
                          </span>
                          <span className="n-time" style={{ display: 'block' }}>{timeAgo(n.at)} ago</span>
                        </span>
                        {n.thumb && <img src={n.thumb} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }} />}
                      </button>
                    );
                  })}
                </div>
                <div className="popover-foot">
                  <button onClick={() => { setNotifOpen(false); navigate('/notifications'); }}>View all notifications</button>
                </div>
              </div>
            )}
          </div>

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button className="avatar-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu" aria-expanded={menuOpen}>
              <Avatar user={me} size={36} />
            </button>
            {menuOpen && (
              <div className="menu menu-pop" style={{ position: 'absolute', top: 48, right: 0, left: 'auto' }}>
                <button className="menu-profile" onClick={() => { setMenuOpen(false); navigate(`/profile/${me.id}`); }}>
                  <Avatar user={me} size={42} />
                  <span>
                    <b>{me.name}</b>
                    <span>See your profile</span>
                  </span>
                </button>
                <button className="menu-item" onClick={() => { setMenuOpen(false); setTheme(state.theme === 'dark' ? 'light' : 'dark'); }}>
                  <span className="mi-icon">{state.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</span>
                  <span className="mi-label">Switch appearance<span className="mi-sub">{state.theme === 'dark' ? 'Dark' : 'Light'} mode</span></span>
                </button>
                <button className="menu-item" onClick={() => { setMenuOpen(false); navigate('/saved'); }}>
                  <span className="mi-icon"><Bookmark size={17} /></span>
                  <span className="mi-label">Saved</span>
                </button>
                <button className="menu-item" onClick={() => { setMenuOpen(false); navigate('/memories'); }}>
                  <span className="mi-icon"><Clock3 size={17} /></span>
                  <span className="mi-label">Memories</span>
                </button>
                <button className="menu-item" onClick={() => { setMenuOpen(false); navigate('/events'); }}>
                  <span className="mi-icon"><CalendarDays size={17} /></span>
                  <span className="mi-label">Events</span>
                </button>
                <button className="menu-item" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>
                  <span className="mi-icon"><Settings size={17} /></span>
                  <span className="mi-label">Settings & privacy</span>
                </button>
                <div className="divider" style={{ margin: '5px 10px' }} />
                <button className="menu-item" onClick={() => { setMenuOpen(false); navigate('/about'); }}>
                  <span className="mi-icon"><Flag size={17} /></span>
                  <span className="mi-label">About Junction</span>
                </button>
                <button className="menu-item danger" onClick={() => { setMenuOpen(false); ui.toast('This demo keeps you signed in'); }}>
                  <span className="mi-icon"><LogOut size={17} /></span>
                  <span className="mi-label">Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Left rail                                                           */
/* ------------------------------------------------------------------ */
const SHORTCUTS = [
  { label: 'Design Crit', color: '#4f46e5', to: '/groups/g2', icon: Users },
  { label: 'Trailbound', color: '#0f766e', to: '/groups/g1', icon: Flag },
  { label: 'Juniper Kitchen', color: '#b45309', to: '/profile/juniper', icon: Store },
  { label: 'Events', color: '#be123c', to: '/events', icon: CalendarDays },
  { label: 'Watch', color: '#7c3aed', to: '/watch', icon: Video },
  { label: 'Marketplace', color: '#0369a1', to: '/marketplace', icon: ShoppingBag },
  { label: 'Games', color: '#15803d', to: '/games', icon: Gamepad2 },
];

export function LeftRail() {
  const { state, me, user } = useStore();
  const route = useRoute();
  const ui = useUI();
  const path = route.path;
  const requestCount = state.requests.length;
  const savedCount = state.saved.length;
  const birthdayCount = state.friends.filter((id) => birthdayIsToday(user(id).birthday)).length;

  const item = (to: string, icon: React.ReactNode, label: string, badge?: number) => (
    <a href={`#${to}`} className={`nav-item ${path === to || (to !== '/' && path.startsWith(to)) ? 'active' : ''}`}>
      <span className="ni-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {badge ? <span className="ni-badge">{badge}</span> : null}
    </a>
  );

  return (
    <aside className="left-rail" aria-label="Main navigation">
      <a href={`#/profile/${me.id}`} className="rail-profile">
        <Avatar user={me} size={38} />
        <div>
          <div className="name">{me.name}</div>
          <div className="sub">{me.handle} · {me.location}</div>
        </div>
      </a>
      <div className="rail-sep" />
      <nav className="stack" style={{ gap: 2 }}>
        {item('/', <Home size={19} />, 'Home')}
        {item('/friends', <UsersRound size={19} />, 'Friends', requestCount)}
        {item('/memories', <Clock3 size={19} />, 'Memories', birthdayCount)}
        {item('/messages', <MessageCircle size={19} />, 'Messenger', state.conversations.reduce((n, c) => n + (c.unread ?? 0), 0))}
        {item('/groups', <Users size={19} />, 'Groups')}
        {item('/watch', <Clapperboard size={19} />, 'Watch')}
        {item('/marketplace', <Store size={19} />, 'Marketplace')}
        {item('/saved', <Bookmark size={19} />, 'Saved', savedCount)}
        {item('/events', <CalendarDays size={19} />, 'Events')}
        {item('/notifications', <Bell size={19} />, 'Notifications')}
      </nav>
      <div className="rail-sep" />
      <div className="rail-head">
        <span>Your shortcuts</span>
        <button className="icon-btn plain" style={{ width: 26, height: 26 }} onClick={() => navigate('/groups')} aria-label="Edit shortcuts">
          <ChevronRight size={16} />
        </button>
      </div>
      {SHORTCUTS.map((s) => (
        <a key={s.label} href={`#${s.to}`} className="shortcut">
          <span className="sq" style={{ background: s.color }}>
            <s.icon size={16} />
          </span>
          <span>{s.label}</span>
        </a>
      ))}
      <button className="shortcut" onClick={() => ui.openCompose()}>
        <span className="sq" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
          <Plus size={16} />
        </span>
        <span>Create post</span>
      </button>
      <div className="rail-foot">
        Junction · Demo build<br />
        Privacy · Terms · Cookies · Ad choices<br />
        © {new Date().getFullYear()} Junction (not affiliated with Meta)
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Right rail                                                          */
/* ------------------------------------------------------------------ */
export function RightRail() {
  const { state, user, addFriend } = useStore();
  const ui = useUI();
  const route = useRoute();

  if (route.path.startsWith('/messages')) return null;

  const birthdays = state.friends
    .map((id) => user(id))
    .filter((u) => birthdayIsToday(u.birthday))
    .slice(0, 2);
  const upcoming = state.friends
    .map((id) => user(id))
    .filter((u) => !birthdayIsToday(u.birthday))
    .slice(0, 3);
  const online = state.friends.map((id) => user(id)).filter((u) => u.online);

  return (
    <aside className="right-rail" aria-label="Sidebar">
      <div className="widget">
        <div className="widget-head">
          <span>Birthdays</span>
        </div>
        <div className="widget-body">
          {[...birthdays, ...upcoming].slice(0, 3).map((u) => (
            <button key={u.id} className="bday-row" onClick={() => navigate(`/profile/${u.id}`)}>
              <span className="cake">🎂</span>
              <span>
                <b>{u.name}</b>
                <span>{birthdayIsToday(u.birthday) ? 'Today is their birthday — say hi!' : 'Birthday coming up'}</span>
              </span>
            </button>
          ))}
        </div>
        <a href="#/events" className="bday-row" style={{ padding: '4px 16px 14px', color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>
          <CalendarDays size={16} /> See all events <ChevronRight size={14} />
        </a>
      </div>

      <div className="widget">
        <div className="widget-head">
          <span>Contacts</span>
          <button className="more" onClick={ui.openSearch}><Search size={16} /></button>
        </div>
        <div className="widget-body">
          {online.slice(0, 4).map((u) => (
            <button key={u.id} className="contact" onClick={() => { const id = u.id; navigate(`/messages/${id}`); }}>
              <Avatar user={u} size={34} online />
              <span className="grow truncate">{u.name}</span>
            </button>
          ))}
          {online.length === 0 && <div className="hint" style={{ padding: 8 }}>No one online right now.</div>}
        </div>
      </div>

      <div className="widget">
        <div className="widget-head">
          <span>Suggested for you</span>
          <a className="more" href="#/friends">See all</a>
        </div>
        <div className="widget-body">
          {state.suggestions.slice(0, 3).map((id) => {
            const u = user(id);
            return (
              <div key={id} className="list-row" style={{ padding: 8 }}>
                <Avatar user={u} size={38} />
                <div className="grow">
                  <div className="lr-title truncate">{u.name}</div>
                  <div className="lr-sub truncate">{u.work ?? 'New to Junction'}</div>
                </div>
                <button className="btn btn-sm btn-brand" onClick={() => { addFriend(id); ui.toast(`Friend request sent to ${u.name}`); }}>
                  Add
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="widget">
        <div className="widget-head">
          <span>Sponsored</span>
        </div>
        <div className="sponsor">
          <img className="sp-img" src="/assets/photos/desk.jpg" alt="" loading="lazy" />
          <div className="sp-title">Cartlane — checkout that respects your time</div>
          <div className="sp-domain">cartlane.com</div>
        </div>
        <div className="divider" style={{ margin: '0 12px' }} />
        <div className="sponsor">
          <img className="sp-img" src="/assets/photos/pottery.jpg" alt="" loading="lazy" />
          <div className="sp-title">Slow Studio — six-week wheel throwing class</div>
          <div className="sp-domain">slowstudio.co · 12 mi away</div>
        </div>
      </div>

      <div className="widget">
        <div className="widget-head">
          <span>Your groups</span>
          <a className="more" href="#/groups">All</a>
        </div>
        <div className="widget-body">
          {state.groups.filter((g) => g.joined).slice(0, 3).map((g) => (
            <a key={g.id} href={`#/groups/${g.id}`} className="list-row" style={{ padding: 8 }}>
              <img src={g.cover} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover' }} />
              <div className="grow">
                <div className="lr-title truncate">{g.name}</div>
                <div className="lr-sub">{g.members.toLocaleString()} members</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="rail-foot" style={{ padding: '0 8px' }}>
        Junction demo · Everything you post stays in this browser.<br />
        Not affiliated with Meta Platforms.
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile bottom nav                                                   */
/* ------------------------------------------------------------------ */
export function MobileNav() {
  const route = useRoute();
  const ui = useUI();
  const path = route.path;
  const isActive = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <a href="#/" className={isActive('/') ? 'active' : ''} aria-label="Home"><Home size={23} /></a>
      <a href="#/watch" className={isActive('/watch') ? 'active' : ''} aria-label="Watch"><Clapperboard size={23} /></a>
      <a href="#/friends" className={isActive('/friends') ? 'active' : ''} aria-label="Friends"><UsersRound size={23} /></a>
      <a href="#/notifications" className={isActive('/notifications') ? 'active' : ''} aria-label="Notifications"><Bell size={23} /></a>
      <a href="#/messages" className={isActive('/messages') ? 'active' : ''} aria-label="Messages"><MessageCircle size={23} /></a>
    </nav>
  );
}

