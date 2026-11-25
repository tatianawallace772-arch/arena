import { useMemo, useState } from 'react';
import { Check, MessageCircle, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { Avatar, useUI } from '../components/ui';
import { navigate } from '../lib/router';

type Tab = 'friends' | 'requests' | 'suggestions' | 'birthdays';

export function FriendsPage({ initialTab }: { initialTab?: Tab }) {
  const { state, user, acceptRequest, declineRequest, addFriend, removeFriend } = useStore();
  const ui = useUI();
  const [tab, setTab] = useState<Tab>(initialTab ?? 'friends');
  const [q, setQ] = useState('');

  const friends = state.friends.map((id) => user(id)).filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()));
  const suggestions = state.suggestions.map((id) => user(id));
  const requests = state.requests.map((id) => user(id));
  const birthdays = state.friends.map((id) => user(id)).filter((u) => u.birthday);

  const counts = useMemo(
    () => ({
      friends: state.friends.length,
      requests: state.requests.length,
      suggestions: state.suggestions.length,
      birthdays: birthdays.length,
    }),
    [state.friends.length, state.requests.length, state.suggestions.length, birthdays.length],
  );

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <h1>Friends</h1>
          <p>Everyone you’ve crossed paths with on Junction.</p>
        </div>
      </div>

      <div className="seg" style={{ maxWidth: 620, marginBottom: 18 }}>
        {(
          [
            ['friends', `All friends (${counts.friends})`],
            ['requests', `Requests (${counts.requests})`],
            ['suggestions', `Suggestions (${counts.suggestions})`],
            ['birthdays', `Birthdays (${counts.birthdays})`],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <>
          <div className="searchbox" style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}>
            <span className="search-icon"><Search size={16} /></span>
            <input placeholder="Search your friends" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid-4">
            {friends.map((u) => (
              <div key={u.id} className="card people-card">
                <img className="pc-img" src={u.avatar} alt="" style={{ cursor: 'pointer' }} onClick={() => navigate(`/profile/${u.id}`)} />
                <div>
                  <button className="pc-name" onClick={() => navigate(`/profile/${u.id}`)}>{u.name}</button>
                  <div className="pc-sub truncate">{u.work ?? u.location ?? 'On Junction'}</div>
                </div>
                <div className="pc-actions">
                  <button className="btn btn-sm btn-brand btn-block" onClick={() => { const conv = `messages/${u.id}`; navigate(conv); }}>
                    <MessageCircle size={15} /> Message
                  </button>
                  <button className="btn btn-sm btn-soft btn-block" onClick={() => { removeFriend(u.id); ui.toast(`Removed ${u.name}`); }}>
                    <UserMinus size={15} /> Unfriend
                  </button>
                </div>
              </div>
            ))}
          </div>
          {friends.length === 0 && (
            <div className="card empty-state">
              <div className="es-icon"><Users size={26} /></div>
              <h3>No friends match that search</h3>
              <p>Try a shorter name, or head to suggestions to meet someone new.</p>
            </div>
          )}
        </>
      )}

      {tab === 'requests' && (
        <div className="grid-3">
          {requests.map((u) => (
            <div key={u.id} className="card people-card">
              <img className="pc-img" src={u.avatar} alt="" />
              <div>
                <div className="pc-name">{u.name}</div>
                <div className="pc-sub">{u.bio ?? 'Wants to connect'}</div>
              </div>
              <div className="pc-actions">
                <button className="btn btn-sm btn-brand btn-block" onClick={() => { acceptRequest(u.id); ui.toast(`You and ${u.name} are now friends`); }}>
                  <Check size={15} /> Confirm
                </button>
                <button className="btn btn-sm btn-soft btn-block" onClick={() => { declineRequest(u.id); ui.toast('Request deleted'); }}>
                  <X size={15} /> Delete
                </button>
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="es-icon"><UserPlus size={26} /></div>
              <h3>No pending requests</h3>
              <p>When someone asks to connect, it’ll show up here.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'suggestions' && (
        <div className="grid-3">
          {suggestions.map((u) => (
            <div key={u.id} className="card people-card">
              {u.avatar ? (
                <img className="pc-img" src={u.avatar} alt="" />
              ) : (
                <div className="pc-img" style={{ display: 'grid', placeItems: 'center', fontSize: 44, fontWeight: 700, color: '#fff', background: `linear-gradient(140deg, ${'#c8553d'}, ${'#7c3aed'})` }}>
                  {u.name[0]}
                </div>
              )}
              <div>
                <div className="pc-name">{u.name}</div>
                <div className="pc-sub clamp-2">{u.bio ?? u.location}</div>
                <div className="pc-sub" style={{ color: 'var(--brand)', fontWeight: 600, marginTop: 4 }}>
                  {u.mutuals ?? 3} mutual friends
                </div>
              </div>
              <div className="pc-actions">
                <button className="btn btn-sm btn-brand btn-block" onClick={() => { addFriend(u.id); ui.toast(`Friend request sent to ${u.name}`); }}>
                  <UserPlus size={15} /> Add friend
                </button>
                <button className="btn btn-sm btn-soft btn-block" onClick={() => ui.toast('Removed from suggestions')}>Remove</button>
              </div>
            </div>
          ))}
          {suggestions.length === 0 && (
            <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
              <h3>You’ve added everyone</h3>
              <p>That’s the whole suggestion list. Impressive.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'birthdays' && (
        <div className="grid-3">
          {birthdays.map((u) => {
            const [m, dd] = (u.birthday ?? '').split('-').map(Number);
            return (
              <div key={u.id} className="card people-card">
                <div className="row">
                  <Avatar user={u} size={56} />
                  <div>
                    <div className="pc-name">{u.name}</div>
                    <div className="pc-sub">🎂 {new Date(2000, m - 1, dd).toLocaleDateString([], { month: 'long', day: 'numeric' })}</div>
                  </div>
                </div>
                <button className="btn btn-sm btn-brand btn-block" onClick={() => ui.toast(`We’ll remind you on ${u.name.split(' ')[0]}’s birthday`)}>Set reminder</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
