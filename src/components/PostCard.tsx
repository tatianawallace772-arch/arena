import { useMemo, useRef, useState } from 'react';
import {
  Bookmark, Globe2, Lock, MessageCircle, MoreHorizontal, Send, Share2, ThumbsUp, Users, Volume2, VolumeX, Maximize2,
  Trash2, Archive, Link2, Flag, EyeOff, BellOff, Check, UserMinus, BookmarkX, Copy, Pencil,
} from 'lucide-react';
import type { Post, ReactionKey } from '../lib/types';
import { useStore } from '../lib/store';
import { Avatar, Verified, useUI } from './ui';
import { REACTIONS, REACTION_ORDER, clampText, clockTime, nfmt, timeAgo, topReactions, totalReactions } from '../lib/util';
import { navigate } from '../lib/router';

function AudienceIcon({ audience }: { audience?: Post['audience'] }) {
  if (audience === 'friends') return <Users size={12} aria-label="Friends" />;
  if (audience === 'only-me') return <Lock size={12} aria-label="Only me" />;
  return <Globe2 size={12} aria-label="Public" />;
}

export function AudienceLabel({ audience }: { audience?: Post['audience'] }) {
  const Icon = audience === 'friends' ? Users : audience === 'only-me' ? Lock : Globe2;
  const text = audience === 'friends' ? 'Friends' : audience === 'only-me' ? 'Only me' : 'Public';
  return (
    <span className="row" style={{ gap: 4 }}>
      <Icon size={12} /> {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Link preview                                                        */
/* ------------------------------------------------------------------ */
function LinkCard({ media }: { media: NonNullable<Post['media']> }) {
  const ui = useUI();
  return (
    <div
      className="link-card"
      onClick={() =>
        ui.toast(`Opening ${media.domain ?? 'link'} in a new tab isn’t available in this demo`)
      }
    >
      {media.src && <img src={media.src} alt="" loading="lazy" />}
      <div className="lc-body">
        <div className="lc-domain">{media.domain}</div>
        <div className="lc-title">{media.title}</div>
        {media.desc && <div className="lc-desc">{media.desc}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */
function PostMedia({ post }: { post: Post }) {
  const media = post.media!;
  const ui = useUI();
  const [muted, setMuted] = useState(true);

  if (media.type === 'link') return <LinkCard media={media} />;

  if (media.type === 'video') {
    return (
      <div className="post-media">
        <video
          src={media.src}
          poster={media.poster}
          playsInline
          loop
          controls
          muted={muted}
          onMouseEnter={(e) => {
            e.currentTarget.play().catch(() => undefined);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
          }}
        />
        <button
          className="mute-tag"
          onClick={(e) => {
            const v = e.currentTarget.parentElement?.querySelector('video');
            if (v) v.muted = !v.muted;
            setMuted((m) => !m);
          }}
        >
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />} {muted ? 'Tap for sound' : 'Sound on'}
        </button>
      </div>
    );
  }

  const images = media.images?.length ? media.images : media.src ? [media.src] : [];
  if (!images.length) return null;

  if (images.length === 1) {
    return (
      <div className="post-media single">
        <img src={images[0]} alt="" loading="lazy" onClick={() => ui.openLightbox(images[0])} />
        <span className="expand">
          <Maximize2 size={15} />
        </span>
      </div>
    );
  }

  return (
    <div className="post-media" style={{ display: 'grid', gridTemplateColumns: images.length === 2 ? '1fr 1fr' : '2fr 1fr', gap: 2, maxHeight: 520 }}>
      {images.slice(0, 3).map((src, i) => (
        <div
          key={src + i}
          style={{ overflow: 'hidden', gridRow: images.length === 3 && i === 0 ? 'span 2' : undefined, cursor: 'zoom-in' }}
          onClick={() => ui.openLightbox(src)}
        >
          <img src={src} alt="" loading="lazy" style={{ height: '100%', minHeight: images.length === 3 ? 200 : 260, maxHeight: 520, objectFit: 'cover' }} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quoted (shared) post                                                */
/* ------------------------------------------------------------------ */
function QuotedPost({ id }: { id: string }) {
  const { state, user } = useStore();
  const post = state.posts.find((p) => p.id === id);
  if (!post) return null;
  const author = user(post.authorId);
  const img = post.media?.type === 'photo' ? (post.media.images?.[0] ?? post.media.src) : post.media?.poster;
  return (
    <div className="quoted">
      <div className="quoted-head">
        <div className="row">
          <Avatar user={author} size={30} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{author.name}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>
              {timeAgo(post.at)} ago
            </div>
          </div>
        </div>
      </div>
      {post.text && <div className="q-text">{clampText(post.text, 220).text}</div>}
      {img && <img src={img} alt="" loading="lazy" />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reaction picker                                                     */
/* ------------------------------------------------------------------ */
export function ReactionPicker({ current, onPick }: { current?: ReactionKey | null; onPick: (k: ReactionKey) => void }) {
  return (
    <div className="reaction-pop" role="menu" aria-label="Choose a reaction">
      {REACTION_ORDER.map((k) => (
        <button
          key={k}
          onClick={(e) => {
            e.stopPropagation();
            onPick(k);
          }}
          title={REACTIONS[k].label}
          aria-label={REACTIONS[k].label}
          style={current === k ? { background: 'var(--brand-soft)' } : undefined}
        >
          {REACTIONS[k].emoji}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Share modal                                                         */
/* ------------------------------------------------------------------ */
function ShareModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { user, sharePost, me } = useStore();
  const ui = useUI();
  const author = user(post.authorId);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}${window.location.pathname}#/post/${post.id}`;

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <h3>Share post</h3>
          <button className="icon-btn plain" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <Avatar user={me} size={40} />
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{me.name}</div>
              <textarea
                className="input"
                style={{ marginTop: 8, width: '100%', minHeight: 86 }}
                placeholder="Say something about this…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <QuotedPost id={post.id} />
          </div>
        </div>
        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn btn-soft"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
              } catch {
                /* clipboard blocked */
              }
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? <Check size={16} /> : <Link2 size={16} />} {copied ? 'Link copied' : 'Copy link'}
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-brand"
              onClick={() => {
                sharePost(post.id, text.trim() || `Shared ${author.name}’s post`);
                ui.toast('Shared to your feed');
                onClose();
              }}
            >
              Share now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */
function PostMenu({ post, onClose }: { post: Post; onClose: () => void }) {
  const { user, me, deletePost, archivePost, toggleSaved, removeFriend, addFriend, state } = useStore();
  const ui = useUI();
  const author = user(post.authorId);
  const mine = post.authorId === 'me';
  const isFriend = state.friends.includes(post.authorId);
  return (
    <div
      className="scrim"
      style={{ background: 'transparent', placeItems: 'start center', paddingTop: 90 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="menu" style={{ width: 320 }}>
        <div className="menu-note">
          Post by <b>{author.name}</b> · {timeAgo(post.at)} ago
        </div>
        {mine ? (
          <>
            <button className="menu-item" onClick={() => { toggleSaved(post.id); ui.toast(post.saved ? 'Removed from saved' : 'Saved for later'); onClose(); }}>
              <span className="mi-icon"><Bookmark size={17} /></span>
              <span className="mi-label">{post.saved ? 'Unsave post' : 'Save post'}</span>
            </button>
            <button className="menu-item" onClick={() => { archivePost(post.id); deletePost(post.id); ui.toast('Moved to your archive'); onClose(); }}>
              <span className="mi-icon"><Archive size={17} /></span>
              <span className="mi-label">Move to archive</span>
            </button>
            <button className="menu-item danger" onClick={() => { deletePost(post.id); ui.toast('Post deleted'); onClose(); }}>
              <span className="mi-icon" style={{ color: 'var(--red)' }}><Trash2 size={17} /></span>
              <span className="mi-label">Delete post</span>
            </button>
          </>
        ) : (
          <>
            <button className="menu-item" onClick={() => { toggleSaved(post.id); ui.toast(post.saved ? 'Removed from saved' : 'Saved for later'); onClose(); }}>
              <span className="mi-icon"><Bookmark size={17} /></span>
              <span className="mi-label">{post.saved ? 'Unsave post' : 'Save post'}</span>
            </button>
            <button className="menu-item" onClick={() => { ui.toast(`Following ${author.name}`); onClose(); }}>
              <span className="mi-icon"><BellOff size={17} /></span>
              <span className="mi-label">Follow {author.name.split(' ')[0]}</span>
            </button>
            <button className="menu-item" onClick={() => { ui.toast(post.authorId === me.id ? 'You can’t snooze yourself' : `Snoozed ${author.name.split(' ')[0]} for 30 days`); onClose(); }}>
              <span className="mi-icon"><EyeOff size={17} /></span>
              <span className="mi-label">Snooze for 30 days</span>
            </button>
            <button className="menu-item" onClick={() => { ui.toast('Report submitted. Our team will take a look.'); onClose(); }}>
              <span className="mi-icon"><Flag size={17} /></span>
              <span className="mi-label">Report post</span>
            </button>
            <div className="divider" style={{ margin: '5px 10px' }} />
            {isFriend ? (
              <button className="menu-item danger" onClick={() => { removeFriend(post.authorId); ui.toast(`Removed ${author.name} from friends`); onClose(); }}>
                <span className="mi-icon" style={{ color: 'var(--red)' }}><UserMinus size={17} /></span>
                <span className="mi-label">Unfollow / remove friend</span>
              </button>
            ) : (
              <button className="menu-item" onClick={() => { addFriend(post.authorId); ui.toast(`Friend request sent to ${author.name}`); onClose(); }}>
                <span className="mi-icon"><Users size={17} /></span>
                <span className="mi-label">Add {author.name.split(' ')[0]} as friend</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PostCard                                                            */
/* ------------------------------------------------------------------ */
export function PostCard({ post, hideGroup, compact }: { post: Post; hideGroup?: boolean; compact?: boolean }) {
  const { user, state, toggleReaction, addComment, likeComment, toggleSaved } = useStore();
  const ui = useUI();
  const author = user(post.authorId);
  const [showComments, setShowComments] = useState(false);
  const [allComments, setAllComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hoverTimer = useRef<number | undefined>(undefined);
  const [showPicker, setShowPicker] = useState(false);

  const group = post.groupId ? state.groups.find((g) => g.id === post.groupId) : undefined;
  const { text, truncated } = useMemo(() => clampText(post.text, compact ? 220 : 460), [post.text, compact]);
  const reactions = totalReactions(post.reactions);
  const tops = topReactions(post.reactions);
  const myReaction = post.myReaction ?? null;
  const visibleComments = allComments ? post.comments : post.comments.slice(-2);

  const react = (k: ReactionKey) => {
    toggleReaction(post.id, k);
    setShowPicker(false);
  };

  const onLikeButton = () => {
    if (myReaction) toggleReaction(post.id, myReaction);
    else react('like');
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    addComment(post.id, commentText.trim());
    setCommentText('');
    setShowComments(true);
  };

  return (
    <article className="post" aria-label={`Post by ${author.name}`}>
      <header className="post-head">
        <button onClick={() => navigate(`/profile/${author.id}`)} aria-label={`Open ${author.name}’s profile`}>
          <Avatar user={author} size={42} online={author.online} />
        </button>
        <div className="post-who">
          <div className="row" style={{ gap: 6 }}>
            <button className="post-name" onClick={() => navigate(`/profile/${author.id}`)}>
              {author.name}
              {author.page && <Verified />}
            </button>
            {group && !hideGroup && (
              <span className="muted" style={{ fontSize: 12.5 }}>
                › <button className="link" onClick={() => navigate(`/groups/${group.id}`)}>{group.name}</button>
              </span>
            )}
          </div>
          <div className="post-meta">
            <span>{timeAgo(post.at)} ago</span>
            <span className="dot" />
            <AudienceIcon audience={post.audience} />
            {post.feeling && (
              <>
                <span className="dot" />
                <span>feeling {post.feeling.toLowerCase()}</span>
              </>
            )}
            {post.location && (
              <>
                <span>·</span>
                <button className="link" onClick={() => ui.toast(post.location!)} style={{ fontSize: 12.5 }}>
                  {post.location}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="row" style={{ gap: 0 }}>
          {post.live && (
            <span className="tag" style={{ background: '#fde8e4', color: '#b91c1c', fontWeight: 800, letterSpacing: '.04em' }}>
              <span className="alert-dot" /> LIVE
            </span>
          )}
          <button className="icon-btn plain" onClick={() => setMenuOpen(true)} aria-label="Post options">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      {post.background ? (
        <div style={{ padding: '10px 0 2px' }}>
          <div className={`post-text-bg bg-${post.background}`} style={bgStyle(post.background)}>
            {text}
          </div>
        </div>
      ) : (
        post.text && (
          <div className="post-text">
            {expanded ? post.text : text}
            {truncated && !expanded && (
              <button className="see-more" onClick={() => setExpanded(true)}>
                See more
              </button>
            )}
          </div>
        )
      )}

      {post.sharedPostId && <QuotedPost id={post.sharedPostId} />}

      {post.media && <PostMedia post={post} />}

      <div className="post-stats">
        <div className="reaction-stack">
          {reactions > 0 && (
            <>
              <div className="bubbles">
                {tops.map((k) => (
                  <span key={k} title={REACTIONS[k].label}>
                    {REACTIONS[k].emoji}
                  </span>
                ))}
              </div>
              <button onClick={() => ui.toast(post.reactions ? 'These are demo reactions' : '')} style={{ color: 'var(--muted)' }}>
                {nfmt(reactions)}
              </button>
            </>
          )}
        </div>
        <div className="right" style={{ color: 'var(--muted)' }}>
          <button onClick={() => setShowComments((v) => !v)}>
            <span className="comments-count">{nfmt(post.comments.length)} comments</span>
          </button>
          <button onClick={() => setShareOpen(true)}>{nfmt(post.shares)} shares</button>
        </div>
      </div>

      <div className="post-actions">
        <div className="post-action" style={{ position: 'relative' }}>
          <button
            className={`post-action ${myReaction ? 'reacted' : ''}`}
            style={{ gap: 7, width: '100%' }}
            onClick={onLikeButton}
            onMouseEnter={() => {
              hoverTimer.current = window.setTimeout(() => setShowPicker(true), 260);
            }}
            onMouseLeave={() => {
              window.clearTimeout(hoverTimer.current);
            }}
            aria-label="React"
          >
            {myReaction ? (
              <>
                <span style={{ fontSize: 17, lineHeight: 1 }}>{REACTIONS[myReaction].emoji}</span>
                <span style={{ color: REACTIONS[myReaction].color }}>{REACTIONS[myReaction].label}</span>
              </>
            ) : (
              <>
                <ThumbsUp size={18} /> <span>Like</span>
              </>
            )}
          </button>
          {showPicker && (
            <ReactionPicker
              current={myReaction}
              onPick={(k) => {
                react(k);
              }}
            />
          )}
        </div>
        <button className="post-action" onClick={() => { setShowComments((v) => !v); }} >
          <MessageCircle size={18} /> <span>Comment</span>
        </button>
        <button className="post-action" onClick={() => setShareOpen(true)}>
          <Share2 size={17} /> <span>Share</span>
        </button>
      </div>

      {(showComments || post.comments.length > 0) && (
        <div className="comments">
          {post.comments.length > 2 && !allComments && (
            <button className="view-more-comments" onClick={() => { setAllComments(true); setShowComments(true); }}>
              View all {post.comments.length} comments
            </button>
          )}
          {showComments && !allComments && post.comments.length <= 2 && post.comments.length > 0 && null}
          {visibleComments.map((c) => {
            const cu = user(c.authorId);
            return (
              <div className="comment" key={c.id}>
                <button onClick={() => navigate(`/profile/${cu.id}`)}>
                  <Avatar user={cu} size={32} />
                </button>
                <div style={{ minWidth: 0 }}>
                  <div className="comment-bubble">
                    <div className="c-name">{cu.name}</div>
                    <div className="c-text">{c.text}</div>
                  </div>
                  <div className="comment-foot">
                    <span>{timeAgo(c.at)}</span>
                    <button style={c.liked ? { color: 'var(--brand)' } : undefined} onClick={() => likeComment(post.id, c.id)}>
                      {c.liked ? 'Liked' : 'Like'}
                    </button>
                    <span>{c.likes > 0 ? nfmt(c.likes) : ''}</span>
                    <button onClick={() => ui.toast('Replies open in the full post view')}>Reply</button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="comment-input-row">
            <Avatar user={user('me')} size={32} />
            <div className="comment-input">
              <input
                placeholder="Write a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onFocus={() => setShowComments(true)}
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                aria-label="Write a comment"
              />
              <button className="comment-send" disabled={!commentText.trim()} onClick={submitComment} aria-label="Send comment">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showComments && post.comments.length === 0 && (
        <div style={{ padding: '0 16px 12px' }}>
          <div className="comment-input-row">
            <Avatar user={user('me')} size={32} />
            <div className="comment-input">
              <input
                placeholder="Be the first to comment"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
              />
              <button className="comment-send" disabled={!commentText.trim()} onClick={submitComment} aria-label="Send comment">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {shareOpen && <ShareModal post={post} onClose={() => setShareOpen(false)} />}
      {menuOpen && <PostMenu post={post} onClose={() => setMenuOpen(false)} />}
    </article>
  );
}

function bgStyle(key: string): React.CSSProperties {
  const map: Record<string, string> = {
    sunset: 'linear-gradient(150deg,#c8553d,#e58b4f 55%,#8a3f2c)',
    ocean: 'linear-gradient(150deg,#0f4c5c,#1c7c8c 55%,#0b2e3a)',
    forest: 'linear-gradient(150deg,#14532d,#2f855a 55%,#0f3d24)',
    plum: 'linear-gradient(150deg,#4c1d95,#7c3aed 55%,#2e1065)',
    slate: 'linear-gradient(150deg,#0f172a,#334155 55%,#0b1120)',
    rose: 'linear-gradient(150deg,#9f1239,#e11d48 55%,#6b0f2a)',
  };
  return { background: map[key] ?? map.sunset };
}
