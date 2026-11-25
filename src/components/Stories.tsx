import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Send, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI, Avatar } from './ui';
import { fileToDataUrl } from '../lib/media';
import { timeAgo } from '../lib/util';
import type { Story } from '../lib/types';

export function StoryTray() {
  const { state, me, user, addStory } = useStore();
  const ui = useUI();
  const fileRef = useRef<HTMLInputElement>(null);

  const myStory = state.stories.find((s) => s.userId === state.meId);
  const ordered = useMemo(() => {
    const mine = myStory ? [myStory] : [];
    return [...mine, ...state.stories.filter((s) => s.userId !== state.meId)];
  }, [state.stories, myStory]);

  const create = async (file: File) => {
    try {
      const src = await fileToDataUrl(file, 1200, 0.8);
      addStory([{ type: 'photo', src, caption: 'Shared to your story' }]);
      ui.toast('Added to your story');
    } catch (err) {
      ui.toast((err as Error).message);
    }
  };

  return (
    <section aria-label="Stories">
      <div className="stories">
        <div className="story-card create" onClick={() => !myStory && fileRef.current?.click()}>
          {myStory ? (
            <>
              <img className="story-bg" src={myStory.items[0]?.src} alt="" />
              <Avatar user={me} size={38} className="story-av" />
              <div className="story-name">Your story</div>
              <button
                className="plus"
                style={{ background: 'var(--surface)', color: 'var(--brand)', border: '2px solid var(--line)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
                aria-label="Add to story"
              >
                <Plus size={18} strokeWidth={2.6} />
              </button>
            </>
          ) : (
            <>
              <img className="create-img" src={me.avatar} alt="" />
              <div className="plus">
                <Plus size={18} strokeWidth={2.6} />
              </div>
              <div className="create-foot">Create story</div>
            </>
          )}
        </div>

        {ordered
          .filter((s) => !(s.userId === state.meId && false))
          .map((story, i) => {
            const owner = user(story.userId);
            const idxInUi = ui.stories.findIndex((s) => s.id === story.id);
            return (
              <div
                key={story.id}
                className={`story-card ${story.seen ? 'seen' : ''}`}
                onClick={() => ui.openStory(idxInUi >= 0 ? idxInUi : i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && ui.openStory(idxInUi >= 0 ? idxInUi : i)}
              >
                <img className="story-bg" src={story.items[0]?.src} alt="" loading="lazy" />
                <img className="story-av" src={owner.avatar} alt="" loading="lazy" />
                <div className="story-name">{owner.name}</div>
              </div>
            );
          })}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) create(f);
          e.currentTarget.value = '';
        }}
      />
    </section>
  );
}

export function StoryViewer({ index, onClose }: { index: number; onClose: () => void }) {
  const { user, viewStory } = useStore();
  const ui = useUI();
  const stories = ui.stories;
  const [cur, setCur] = useState(index);
  const [item, setItem] = useState(0);
  const [reply, setReply] = useState('');
  const story = stories[cur];
  const owner = story ? user(story.userId) : null;
  const total = story?.items.length ?? 0;

  useEffect(() => {
    if (story) viewStory(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

  const next = () => {
    if (item < total - 1) setItem(item + 1);
    else if (cur < stories.length - 1) {
      setCur(cur + 1);
      setItem(0);
    } else onClose();
  };
  const prev = () => {
    if (item > 0) setItem(item - 1);
    else if (cur > 0) {
      setCur(cur - 1);
      setItem(0);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(next, 6000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, item]);

  if (!story || !owner) return null;
  const media = story.items[item];

  return (
    <div className="story-viewer" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="story-frame">
        <div className="story-progress">
          {story.items.map((_, i) => (
            <i key={i} className={i < item ? 'on' : i === item ? 'now' : ''} />
          ))}
        </div>
        <div className="story-head">
          <Avatar user={owner} size={34} />
          <div>
            <div className="nm">{owner.name}</div>
            <div className="tm">{timeAgo(story.at)} ago</div>
          </div>
        </div>
        <button className="story-close icon-btn" onClick={onClose} aria-label="Close story">
          <X size={18} />
        </button>
        <img key={media.src} src={media.src} alt="" onClick={next} />
        {media.caption && <div className="story-caption">{media.caption}</div>}
        <div className="story-reply">
          <input
            placeholder={`Reply to ${owner.name.split(' ')[0]}…`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && reply.trim()) {
                ui.toast(`Reply sent to ${owner.name.split(' ')[0]}`);
                setReply('');
              }
            }}
          />
          <button
            className="icon-btn"
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff', backdropFilter: 'blur(8px)' }}
            onClick={() => {
              if (reply.trim()) {
                ui.toast(`Reply sent to ${owner.name.split(' ')[0]}`);
                setReply('');
              }
            }}
            aria-label="Send reply"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
      <button className="story-nav prev" onClick={prev} aria-label="Previous story">
        <ChevronLeft size={24} />
      </button>
      <button className="story-nav next" onClick={next} aria-label="Next story">
        <ChevronRight size={24} />
      </button>
    </div>
  );
}

export type { Story };
