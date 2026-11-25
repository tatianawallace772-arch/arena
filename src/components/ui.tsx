import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import type { Story, User } from '../lib/types';
import { colorFor, initials } from '../lib/util';

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

export function Avatar({
  user,
  size = 40,
  ring,
  seen,
  online,
  className,
}: {
  user: Pick<User, 'name' | 'avatar'>;
  size?: number;
  ring?: boolean;
  seen?: boolean;
  online?: boolean;
  className?: string;
}) {
  const img = user.avatar ? (
    <img
      src={user.avatar}
      alt={user.name}
      className={`avatar ${className ?? ''}`}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  ) : (
    <span
      className={`avatar-letter ${className ?? ''}`}
      style={{ width: size, height: size, background: colorFor(user.name), fontSize: Math.round(size * 0.38) }}
      aria-label={user.name}
    >
      {initials(user.name)}
    </span>
  );

  const inner = ring ? (
    <span className={`avatar-ring ${seen ? 'seen' : ''}`} style={{ width: size + 5, height: size + 5 }}>
      {img}
    </span>
  ) : (
    img
  );

  if (!online) return inner;
  return (
    <span className="avatar-wrap">
      {inner}
      <span className="online-dot" style={{ width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28) }} />
    </span>
  );
}

export function Verified({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="verified" aria-label="Verified page">
      <path
        d="M12 2.2l2.4 2 3.1-.3 1 3 2.7 1.6-.9 3 .9 3-2.7 1.6-1 3-3.1-.3-2.4 2-2.4-2-3.1.3-1-3L3.8 16.7l.9-3-.9-3L6.5 9.1l1-3 3.1.3 2.4-2z"
        fill="currentColor"
      />
      <path d="M8.4 12.3l2.3 2.3 4.8-4.8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  children,
  onClose,
  wide,
  label,
  className,
}: {
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  label?: string;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal aria-label={label}>
      <div className={`modal ${wide ? 'wide' : ''} ${className ?? ''}`}>{children}</div>
    </div>
  );
}

export function ModalHead({ title, onClose, right }: { title: string; onClose: () => void; right?: ReactNode }) {
  return (
    <div className="modal-head">
      <h3>{title}</h3>
      <div className="row" style={{ gap: 6 }}>
        {right}
        <button className="icon-btn plain" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

interface ToastItem {
  id: number;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Overlay context                                                     */
/* ------------------------------------------------------------------ */

interface LightboxState {
  src: string;
  alt?: string;
}

interface UI {
  toast: (message: string) => void;
  openCompose: (prefill?: { text?: string; media?: string[] }) => void;
  openSearch: () => void;
  openStory: (index: number) => void;
  openLightbox: (src: string, alt?: string) => void;
  lightbox: LightboxState | null;
  closeLightbox: () => void;
  composeOpen: boolean;
  closeCompose: () => void;
  composePrefill?: { text?: string; media?: string[] };
  searchOpen: boolean;
  closeSearch: () => void;
  storyIndex: number | null;
  closeStory: () => void;
  setStories: (stories: Story[]) => void;
  stories: Story[];
  toasts: ToastItem[];
}

const UICtx = createContext<UI | null>(null);

export function UIProvider({
  children,
  renderCompose,
  renderSearch,
  renderStories,
  stories,
}: {
  children: ReactNode;
  renderCompose: (props: { onClose: () => void; prefill?: { text?: string; media?: string[] } }) => ReactNode;
  renderSearch: (props: { onClose: () => void }) => ReactNode;
  renderStories: (props: { index: number; onClose: () => void }) => ReactNode;
  stories: Story[];
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<{ text?: string; media?: string[] } | undefined>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ui = useMemo<UI>(
    () => ({
      toast,
      openCompose: (prefill) => {
        setComposePrefill(prefill);
        setComposeOpen(true);
      },
      openSearch: () => setSearchOpen(true),
      openStory: (index) => setStoryIndex(index),
      openLightbox: (src, alt) => setLightbox({ src, alt }),
      lightbox,
      closeLightbox: () => setLightbox(null),
      composeOpen,
      closeCompose: () => setComposeOpen(false),
      composePrefill,
      searchOpen,
      closeSearch: () => setSearchOpen(false),
      storyIndex,
      closeStory: () => setStoryIndex(null),
      setStories: () => undefined,
      stories,
      toasts,
    }),
    [toast, lightbox, composeOpen, composePrefill, searchOpen, storyIndex, toasts, stories],
  );

  return (
    <UICtx.Provider value={ui}>
      {children}
      {composeOpen && renderCompose({ onClose: () => setComposeOpen(false), prefill: composePrefill })}
      {searchOpen && renderSearch({ onClose: () => setSearchOpen(false) })}
      {storyIndex !== null && stories[storyIndex] && renderStories({ index: storyIndex, onClose: () => setStoryIndex(null) })}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lb-close" onClick={() => setLightbox(null)} aria-label="Close image">
            <X size={22} />
          </button>
          <img src={lightbox.src} alt={lightbox.alt ?? ''} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <div className="toasts">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span className="tick">
              <Check size={14} strokeWidth={3} />
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </UICtx.Provider>
  );
}

export function useUI(): UI {
  const ui = useContext(UICtx);
  if (!ui) throw new Error('useUI must be used inside UIProvider');
  return ui;
}
