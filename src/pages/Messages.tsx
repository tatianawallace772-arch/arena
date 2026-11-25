import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Info, MessageCircle, MoreHorizontal, Phone, Plus, Search, Send, Smile, Video } from 'lucide-react';
import { useStore } from '../lib/store';
import { Avatar, useUI } from '../components/ui';
import { navigate } from '../lib/router';
import { clockTime, dayLabel, timeAgo } from '../lib/util';
import type { Conversation, Message } from '../lib/types';

const REACTION_SET = ['❤️', '😆', '😮', '😢', '👍'];

export function MessagesPage({ id }: { id?: string }) {
  const { state, user, me, markConversationRead, sendMessage, reactToMessage, startConversation } = useStore();
  const ui = useUI();
  const [q, setQ] = useState('');
  const [activeId, setActiveId] = useState<string | undefined>(id);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  // /messages/:id accepts either a conversation id (cv…) or a user id
  useEffect(() => {
    if (!id) {
      setActiveId(undefined);
      return;
    }
    if (state.conversations.some((c) => c.id === id)) {
      setActiveId(id);
      return;
    }
    const convId = startConversation(id);
    setActiveId(convId);
    navigate(`/messages/${convId}`, { replace: true, scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const conversations = useMemo(() => {
    const list = [...state.conversations].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    if (!q) return list;
    return list.filter((c) => {
      const name = c.name ?? user(c.userIds[0])?.name ?? '';
      return name.toLowerCase().includes(q.toLowerCase());
    });
  }, [state.conversations, q, user]);

  const active = state.conversations.find((c) => c.id === activeId) ?? undefined;
  const partner = active && active.userIds.length === 1 ? user(active.userIds[0]) : null;
  const title = active?.name ?? partner?.name ?? 'Conversation';

  useEffect(() => {
    if (active) markConversationRead(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [active?.messages.length, active?.id]);

  const send = () => {
    if (!active || !draft.trim()) return;
    sendMessage(active.id, draft.trim());
    setDraft('');
  };

  return (
    <div className="page-wrap" style={{ maxWidth: 1320, padding: '16px 16px 40px' }}>
      <div className={`messenger ${active ? 'show-thread' : ''}`}>
        <div className="mes-list">
          <div className="mes-list-head">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2>Messenger</h2>
              <button className="icon-btn" onClick={() => setNewChatOpen((v) => !v)} aria-label="New message">
                <Plus size={19} />
              </button>
            </div>
          </div>
          <div className="mes-search">
            <Search size={16} />
            <input placeholder="Search Messenger" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {newChatOpen && (
            <div style={{ padding: '0 12px 10px' }}>
              <div className="card" style={{ padding: 8, boxShadow: 'none', border: '1px solid var(--line)', maxHeight: 220, overflowY: 'auto' }}>
                {state.friends.map((id) => user(id)).filter((u) => !state.conversations.some((c) => c.userIds.length === 1 && c.userIds[0] === u.id)).slice(0, 8).map((u) => (
                  <button key={u.id} className="list-row" style={{ padding: 6 }} onClick={() => { const cid = startConversation(u.id); setActiveId(cid); setNewChatOpen(false); navigate(`/messages/${cid}`, { replace: true }); }}>
                    <Avatar user={u} size={30} />
                    <span className="lr-title">{u.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mes-scroll">
            {conversations.map((c) => {
              const other = c.userIds.length === 1 ? user(c.userIds[0]) : null;
              const last = c.messages[c.messages.length - 1];
              const name = c.name ?? other?.name ?? 'Chat';
              return (
                <button
                  key={c.id}
                  className={`conv-row ${c.id === active?.id ? 'active' : ''}`}
                  onClick={() => { setActiveId(c.id); navigate(`/messages/${c.id}`, { replace: true, scroll: false }); }}
                >
                  <span className="avatar-wrap">
                    {other ? (
                      <Avatar user={other} size={46} online={other.online} />
                    ) : (
                      <span className="avatar-letter" style={{ width: 46, height: 46, background: 'var(--brand)', fontSize: 17 }}>
                        {name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="cv-name truncate">{name}</span>
                      <span className="cv-time">{last ? timeAgo(last.at) : ''}</span>
                    </span>
                    <span className={`cv-preview truncate ${c.unread ? 'unread' : ''}`} style={{ display: 'block' }}>
                      {last ? `${last.from === 'me' ? 'You: ' : ''}${last.text}` : 'Say hello 👋'}
                    </span>
                  </span>
                  {c.unread ? <span className="pill-count" style={{ minWidth: 18, height: 18, fontSize: 11 }}>{c.unread}</span> : null}
                </button>
              );
            })}
            {conversations.length === 0 && (
              <div className="empty-state">
                <div className="es-icon"><MessageCircle size={24} /></div>
                <h3>No chats found</h3>
                <p>Start a conversation from a friend’s profile.</p>
              </div>
            )}
          </div>
        </div>

        {active && (
          <div className="mes-thread">
            <div className="thread-head">
              <button className="icon-btn plain mobile-only" onClick={() => { setActiveId(undefined); navigate('/messages', { replace: true }); }} aria-label="Back to conversations">
                <ArrowLeft size={19} />
              </button>
              <button onClick={() => partner && navigate(`/profile/${partner.id}`)} style={{ display: 'flex' }}>
                {partner ? <Avatar user={partner} size={38} online={partner.online} /> : (
                  <span className="avatar-letter" style={{ width: 38, height: 38, background: 'var(--brand)' }}>{title.slice(0, 2).toUpperCase()}</span>
                )}
              </button>
              <div className="grow">
                <div className="th-name">{title}</div>
                <div className="th-sub">
                  {partner ? (partner.online ? 'Active now' : 'Active ' + timeAgo(active.messages[active.messages.length - 1]?.at ?? Date.now()) + ' ago') : `${active.userIds.length + 1} members`}
                </div>
              </div>
              <button className="icon-btn plain" onClick={() => ui.toast('Calls are disabled in this demo')} aria-label="Voice call"><Phone size={19} /></button>
              <button className="icon-btn plain" onClick={() => ui.toast('Video calls are disabled in this demo')} aria-label="Video call"><Video size={20} /></button>
              <button className="icon-btn plain" onClick={() => ui.toast('Conversation details are stubbed')} aria-label="Conversation details"><Info size={20} /></button>
            </div>

            <div className="thread-scroll">
              {partner && (
                <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
                  <Avatar user={partner} size={64} online={partner.online} />
                  <div style={{ fontWeight: 700, marginTop: 8 }}>{partner.name}</div>
                  <div className="hint">{partner.work ?? partner.location} · You’re friends on Junction</div>
                </div>
              )}
              {active.messages.map((m, i) => {
                const prev = active.messages[i - 1];
                const showDay = !prev || dayLabel(prev.at) !== dayLabel(m.at);
                return (
                  <div key={m.id}>
                    {showDay && <div className="thread-date-sep">{dayLabel(m.at)}</div>}
                    <MessageBubble
                      message={m}
                      conv={active}
                      showAvatar={!prev || prev.from !== m.from}
                      partnerName={partner?.name}
                      onReact={(emoji) => reactToMessage(active.id, m.id, emoji)}
                    />
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="thread-composer">
              <button className="icon-btn plain" onClick={() => ui.toast('Attachments are stubbed in this demo')} aria-label="Attach"><Plus size={20} /></button>
              <div className="ti">
                <input
                  placeholder={`Message ${title.split(' ')[0]}…`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                />
                <button className="icon-btn plain" onClick={() => ui.toast('Emoji picker is stubbed')} aria-label="Emoji"><Smile size={19} /></button>
              </div>
              <button className="icon-btn" style={{ background: 'var(--brand)', color: '#fff' }} onClick={send} aria-label="Send message">
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="hint" style={{ textAlign: 'center', marginTop: 14 }}>
        Demo messenger · messages persist locally. Automated replies are generated for one-to-one chats.
      </p>
    </div>
  );
}

function MessageBubble({
  message,
  conv,
  showAvatar,
  partnerName,
  onReact,
}: {
  message: Message;
  conv: Conversation;
  showAvatar: boolean;
  partnerName?: string;
  onReact: (emoji: string) => void;
}) {
  const { user, me } = useStore();
  const mine = message.from === 'me';
  const author = mine ? me : user(message.from);
  const [picker, setPicker] = useState(false);
  void conv;
  return (
    <div className={`bubble-row ${mine ? 'me' : ''}`} style={{ alignItems: 'flex-end' }}>
      {!mine && (showAvatar ? <Avatar user={author} size={28} /> : <span style={{ width: 28, flex: 'none' }} />)}
      <div style={{ position: 'relative', minWidth: 0 }}>
        <div className="bubble">{message.text}</div>
        {!!message.reactions?.length && (
          <span className="bubble-reactions">{message.reactions.join(' ')}</span>
        )}
        <div className="bubble-time" style={{ textAlign: mine ? 'right' : 'left' }}>
          {clockTime(message.at)} · {mine ? 'Sent' : 'Delivered'}
        </div>
      </div>
      <button className="reaction-add icon-btn plain" style={{ width: 26, height: 26 }} onClick={() => setPicker((v) => !v)} aria-label="React to message">
        <Smile size={15} />
      </button>
      {picker && (
        <div
          className="menu"
          style={{ position: 'absolute', bottom: 34, [mine ? 'right' : 'left']: 0, minWidth: 'auto', display: 'flex', gap: 2, padding: 5, zIndex: 50 } as React.CSSProperties}
          onMouseLeave={() => setPicker(false)}
        >
          {REACTION_SET.map((e) => (
            <button key={e} style={{ fontSize: 22, padding: 4 }} onClick={() => { onReact(e); setPicker(false); }} aria-label={`React ${e}`}>
              {e}
            </button>
          ))}
        </div>
      )}
      {!mine && partnerName && null}
    </div>
  );
}
