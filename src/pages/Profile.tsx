import { useMemo, useState } from 'react';
import {
  Briefcase, Camera, Check, GraduationCap, Heart, Home, Lock, MapPin, MessageCircle, MoreHorizontal, Pencil, Plus,
  Rss, Search, UserPlus, Users, X,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI, Avatar, Modal, ModalHead } from '../components/ui';
import { PostCard } from '../components/PostCard';
import { Composer } from '../components/Composer';
import { navigate } from '../lib/router';
import { fullDate, monthDay, nfmt, timeAgo } from '../lib/util';
import type { User } from '../lib/types';

type Tab = 'posts' | 'about' | 'friends' | 'photos' | 'video';

export function ProfilePage({ id }: { id: string }) {
  const { state, user, me, addFriend, removeFriend, addNotification } = useStore();
  const ui = useUI();
  const [tab, setTab] = useState<Tab>('posts');
  const [composer, setComposer] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [allFriends, setAllFriends] = useState(false);

  const profile = user(id);
  const isMe = id === state.meId;
  const isFriend = state.friends.includes(id);
  const isRequest = state.requests.includes(id);

  const posts = useMemo(() => state.posts.filter((p) => p.authorId === id).sort((a, b) => b.at - a.at), [state.posts, id]);
  const photos = useMemo(() => {
    const pics: string[] = [];
    posts.forEach((p) => {
      if (p.media?.type === 'photo') pics.push(...(p.media.images ?? (p.media.src ? [p.media.src] : [])));
      if (p.media?.type === 'video' && p.media.poster) pics.push(p.media.poster);
      if (p.media?.type === 'link' && p.media.src) pics.push(p.media.src);
    });
    return Array.from(new Set(pics));
  }, [posts]);
  const friendsOf = (isMe ? state.friends : [...state.friends.filter((f) => f !== id), ...state.suggestions.slice(0, 3)]).map((f) => user(f));

  return (
    <div className="page-wrap mid">
      <section className="card profile-hero">
        <div className="profile-cover">
          {profile.cover ? <img src={profile.cover} alt="" /> : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(140deg,#c8553d,#7c3aed)' }} />}
          <div className="cover-tint" />
          {isMe && (
            <button className="icon-btn edit-cover" onClick={() => setEditOpen(true)} aria-label="Edit cover">
              <Camera size={18} />
            </button>
          )}
        </div>
        <div className="profile-id">
          <div className="row" style={{ alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
            <span className="profile-avatar">
              <Avatar user={profile} size={128} />
            </span>
            {isMe && (
              <button className="icon-btn" style={{ marginBottom: 8 }} onClick={() => setEditOpen(true)} aria-label="Edit avatar">
                <Camera size={18} />
              </button>
            )}
          </div>
          <div className="profile-name-row">
            <div>
              <h1>{profile.name}</h1>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{profile.handle} · {nfmt(posts.length + 24)} followers</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {isMe ? (
                <>
                  <button className="btn btn-brand" onClick={() => setComposer(true)}>+ Add to story</button>
                  <button className="btn btn-soft" onClick={() => setEditOpen(true)}><Pencil size={15} /> Edit profile</button>
                </>
              ) : (
                <>
                  {isFriend ? (
                    <button className="btn btn-soft" onClick={() => { removeFriend(id); ui.toast(`Removed ${profile.name}`); }}>
                      <Check size={16} /> Friends
                    </button>
                  ) : isRequest ? (
                    <button className="btn btn-soft" onClick={() => ui.toast('Request already sent')}>
                      <Check size={16} /> Requested
                    </button>
                  ) : (
                    <button
                      className="btn btn-brand"
                      onClick={() => {
                        addFriend(id);
                        addNotification({ kind: 'friend', userId: id, text: 'accepted your friend request.' });
                        ui.toast(`Friend request sent to ${profile.name}`);
                      }}
                    >
                      <UserPlus size={16} /> Add friend
                    </button>
                  )}
                  <button className="btn btn-soft" onClick={() => navigate(`/messages/${id}`)}>
                    <MessageCircle size={16} /> Message
                  </button>
                  <button className="icon-btn" onClick={() => ui.toast('Profile actions are stubbed in this demo')} aria-label="More profile options">
                    <MoreHorizontal size={19} />
                  </button>
                </>
              )}
            </div>
          </div>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          <div className="profile-meta">
            {profile.work && <span className="row" style={{ gap: 6 }}><Briefcase size={14} /> {profile.work}</span>}
            {profile.education && <span className="row" style={{ gap: 6 }}><GraduationCap size={14} /> {profile.education}</span>}
            {profile.location && <span className="row" style={{ gap: 6 }}><MapPin size={14} /> {profile.location}</span>}
            {profile.joined && <span className="row" style={{ gap: 6 }}><Heart size={14} /> Joined {profile.joined}</span>}
          </div>
          <div className="row" style={{ gap: 16, marginTop: 12 }}>
            {friendsOf.slice(0, 7).map((f, i) => (
              <img key={f.id} src={f.avatar} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--surface)', marginLeft: i ? -12 : 0 }} />
            ))}
            <span className="hint">{friendsOf.length} friends · {profile.mutuals ?? 12} mutual</span>
          </div>
        </div>
        <div className="profile-tabs" role="tablist">
          {(
            [
              ['posts', 'Posts'],
              ['about', 'About'],
              ['friends', 'Friends'],
              ['photos', 'Photos'],
              ['video', 'Reels'],
            ] as Array<[Tab, string]>
          ).map(([k, label]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {tab === 'posts' && (
        <div className="profile-cols">
          <div className="feed">
            {isMe && (
              <div className="card composer">
                <div className="composer-top">
                  <Avatar user={me} size={40} />
                  <button className="composer-fake" onClick={() => setComposer(true)}>Write something for your profile…</button>
                </div>
              </div>
            )}
            {posts.map((p) => <PostCard key={p.id} post={p} hideGroup />)}
            {posts.length === 0 && (
              <div className="card empty-state">
                <div className="es-icon"><Rss size={26} /></div>
                <h3>No posts yet</h3>
                <p>{isMe ? 'Share a thought, a photo, or a link. It lands here.' : `${profile.name.split(' ')[0]} hasn’t posted publicly yet.`}</p>
              </div>
            )}
          </div>
          <div className="stack" style={{ gap: 16 }} onClick={() => undefined}>
            <div className="card card-pad">
              <div className="section-title">Intro</div>
              <p style={{ marginTop: 8, color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>{profile.bio ?? 'No bio yet.'}</p>
              <div className="divider" />
              <div className="stack" style={{ gap: 8, fontSize: 13.5, color: 'var(--muted)' }}>
                {profile.work && <span className="row" style={{ gap: 8 }}><Briefcase size={15} /> Works at {profile.work}</span>}
                {profile.education && <span className="row" style={{ gap: 8 }}><GraduationCap size={15} /> Studied at {profile.education}</span>}
                {profile.location && <span className="row" style={{ gap: 8 }}><MapPin size={15} /> Lives in {profile.location}</span>}
                {profile.birthday && <span className="row" style={{ gap: 8 }}><Heart size={15} /> Birthday {monthDay(profile.birthday)}</span>}
                <span className="row" style={{ gap: 8 }}><Home size={15} /> Joined Junction in {profile.joined ?? '2020'}</span>
              </div>
            </div>
            <div className="card card-pad">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="section-title">Friends</span>
                <button className="link" style={{ fontSize: 13 }} onClick={() => { setTab('friends'); }}>See all</button>
              </div>
              <div className="pf-grid" style={{ marginTop: 10 }}>
                {friendsOf.slice(0, 9).map((f) => (
                  <button key={f.id} onClick={() => navigate(`/profile/${f.id}`)}>
                    {f.avatar ? <img src={f.avatar} alt={f.name} /> : <span className="ph">{f.name[0]}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="card card-pad">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="section-title">Photos</span>
                <button className="link" style={{ fontSize: 13 }} onClick={() => setTab('photos')}>See all</button>
              </div>
              <div className="photo-grid" style={{ marginTop: 10 }}>
                {photos.slice(0, 6).map((src) => (
                  <div key={src} className="ph" onClick={() => ui.openLightbox(src)}>
                    <img src={src} alt="" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'about' && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h2 className="section-title" style={{ marginBottom: 10 }}>About {profile.name.split(' ')[0]}</h2>
          <div className="about-grid">
            <div className="about-item"><Briefcase size={18} /><span><b>Work</b><br />{profile.work ?? 'Not listed'}</span></div>
            <div className="about-item"><GraduationCap size={18} /><span><b>Education</b><br />{profile.education ?? 'Not listed'}</span></div>
            <div className="about-item"><MapPin size={18} /><span><b>Lives in</b><br />{profile.location ?? 'Not listed'}</span></div>
            <div className="about-item"><Heart size={18} /><span><b>Birthday</b><br />{monthDay(profile.birthday) || 'Not listed'}</span></div>
            <div className="about-item"><Home size={18} /><span><b>Joined</b><br />{profile.joined ?? '2020'}</span></div>
            <div className="about-item"><Lock size={18} /><span><b>Privacy</b><br />Public — anyone can follow</span></div>
          </div>
          <div className="divider" />
          <p className="hint">Profile information in this demo is static seed data. Edit your own profile from the Edit profile button.</p>
        </div>
      )}

      {tab === 'friends' && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 className="section-title">Friends ({friendsOf.length})</h2>
            <div className="searchbox" style={{ width: 240 }}>
              <span className="search-icon"><Search size={15} /></span>
              <input placeholder="Search friends" />
            </div>
          </div>
          <div className="friend-grid">
            {friendsOf.map((f) => (
              <div key={f.id} className="card people-card">
                {f.avatar ? <img className="pc-img" src={f.avatar} alt="" style={{ cursor: 'pointer' }} onClick={() => navigate(`/profile/${f.id}`)} /> : (
                  <div className="pc-img" style={{ display: 'grid', placeItems: 'center', fontSize: 36, color: '#fff', background: '#7c3aed' }}>{f.name[0]}</div>
                )}
                <button className="pc-name" onClick={() => navigate(`/profile/${f.id}`)}>{f.name}</button>
                <div className="pc-sub truncate">{f.work ?? f.location}</div>
                <button className="btn btn-sm btn-soft btn-block" onClick={() => navigate(`/profile/${f.id}`)}>View profile</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'photos' && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h2 className="section-title" style={{ marginBottom: 14 }}>Photos</h2>
          {photos.length ? (
            <div className="photo-grid">
              {photos.map((src) => (
                <div key={src} className="ph" onClick={() => ui.openLightbox(src)}>
                  <img src={src} alt="" loading="lazy" />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><p>No photos yet.</p></div>
          )}
        </div>
      )}

      {tab === 'video' && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h2 className="section-title" style={{ marginBottom: 14 }}>Reels and videos</h2>
          <div className="grid-3">
            {state.videos.filter((v) => v.authorId === id || isMe).map((v) => (
              <a key={v.id} href="#/watch" className="card watch-card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
                <div className="wc-thumb"><img src={v.poster} alt="" /><span className="wc-len">{v.length}</span></div>
              </a>
            ))}
            {state.videos.filter((v) => v.authorId === id || isMe).length === 0 && (
              <p className="hint">No reels yet — the Watch tab has the full catalogue.</p>
            )}
          </div>
        </div>
      )}

      {composer && <Composer onClose={() => setComposer(false)} />}
      {editOpen && <EditProfileModal onClose={() => setEditOpen(false)} />}
      {allFriends && <Modal onClose={() => setAllFriends(false)}><ModalHead title="Friends" onClose={() => setAllFriends(false)} /><div className="modal-body" /></Modal>}
    </div>
  );
}

function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { me, setState } = useStore();
  const ui = useUI();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio ?? '');
  const [location, setLocation] = useState(me.location ?? '');
  const [work, setWork] = useState(me.work ?? '');

  const save = () => {
    setState((s) => ({
      ...s,
      users: { ...s.users, [s.meId]: { ...s.users[s.meId], name: name.trim() || me.name, bio, location, work } },
    }));
    ui.toast('Profile updated');
    onClose();
  };

  return (
    <Modal onClose={onClose} label="Edit profile">
      <ModalHead title="Edit profile" onClose={onClose} right={<button className="btn btn-sm btn-brand" onClick={save}>Save</button>} />
      <div className="modal-body">
        <div className="field"><label>Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Bio</label><textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Say something about yourself" /></div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field grow"><label>Lives in</label><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="field grow"><label>Work</label><input className="input" value={work} onChange={(e) => setWork(e.target.value)} /></div>
        </div>
        <p className="hint">Profile photos are part of the demo seed. Text fields save to your browser via localStorage. Last updated {timeAgo(Date.now())} ago.</p>
      </div>
    </Modal>
  );
}

export type { User };
