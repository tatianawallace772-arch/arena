import { useState } from 'react';
import { Bell, BellOff, Check, UserPlus } from 'lucide-react';
import { useStore } from '../lib/store';
import { Avatar, useUI } from '../components/ui';
import { navigate } from '../lib/router';
import { timeAgo } from '../lib/util';
import type { NotifKind } from '../lib/types';

const ICON: Record<NotifKind, string> = {
  reaction: '👍', comment: '💬', friend: '👥', birthday: '🎂', group: '🏔️',
  mention: '📣', event: '📅', live: '🔴', tag: '🏷️',
};

const FILTERS = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['friend', 'Friend requests'],
  ['mentions', 'Mentions'],
] as const;

export function NotificationsPage() {
  const { state, user, markNotificationsRead, acceptRequest, declineRequest } = useStore();
  const ui = useUI();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);

  let list = state.notifications;
  if (filter === 'unread' || onlyUnread) list = list.filter((n) => !n.read);
  if (filter === 'friend') list = list.filter((n) => n.kind === 'friend');
  if (filter === 'mentions') list = list.filter((n) => n.kind === 'mention' || n.kind === 'tag');

  return (
    <div className="page-wrap narrow" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>{state.notifications.filter((n) => !n.read).length} unread · everything that happened while you were away</p>
        </div>
        <button className="btn btn-soft btn-sm" onClick={() => { markNotificationsRead(); ui.toast('All caught up'); }}>
          <Check size={15} /> Mark all read
        </button>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        <button className={`chip ${onlyUnread ? 'active' : ''}`} onClick={() => setOnlyUnread((v) => !v)}>
          {onlyUnread ? <Bell size={14} /> : <BellOff size={14} />} {onlyUnread ? 'Unread only' : 'Show all'}
        </button>
      </div>

      <div className="card" style={{ padding: 6 }}>
        {list.map((n) => {
          const u = n.userId ? user(n.userId) : null;
          return (
            <div key={n.id} className={`notif-row ${n.read ? '' : 'unread'}`}>
              <button className="n-av" onClick={() => (n.userId ? navigate(`/profile/${n.userId}`) : undefined)} aria-label="Open profile">
                {u ? <Avatar user={u} size={50} /> : <span className="avatar-letter" style={{ width: 50, height: 50, background: 'var(--brand)' }}>j</span>}
                <span className="n-icon" style={{ fontSize: 12 }}>{ICON[n.kind]}</span>
              </button>
              <button className="grow" style={{ textAlign: 'left' }} onClick={() => {
                if (n.kind === 'friend') navigate('/friends/requests');
                else if (n.userId) navigate(`/profile/${n.userId}`);
              }}>
                <span className="n-text" style={{ display: 'block' }}>
                  {u && <b>{u.name} </b>}{n.text}
                </span>
                <span className="n-time" style={{ display: 'block' }}>{timeAgo(n.at)} ago</span>
              </button>
              {n.kind === 'friend' && state.requests.includes(n.userId ?? '') ? (
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="btn btn-sm btn-brand"
                    onClick={() => { acceptRequest(n.userId!); ui.toast('Friend request accepted'); }}
                  >
                    <UserPlus size={14} /> Accept
                  </button>
                  <button className="btn btn-sm btn-soft" onClick={() => { declineRequest(n.userId!); ui.toast('Request deleted'); }}>
                    Delete
                  </button>
                </div>
              ) : n.thumb ? (
                <img src={n.thumb} alt="" style={{ width: 54, height: 54, borderRadius: 8, objectFit: 'cover' }} />
              ) : null}
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="empty-state">
            <div className="es-icon"><Bell size={26} /></div>
            <h3>Nothing new</h3>
            <p>You’re all caught up. We’ll ping you when something happens.</p>
          </div>
        )}
      </div>
    </div>
  );
}
