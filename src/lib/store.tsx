import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppState, Comment, Conversation, ID, Media, Message, NotifKind, Post, ReactionKey, Story, User,
} from './types';
import { buildSeed } from './seed';
import { uid } from './util';

const KEY = 'junction.state.v4';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === 1 && parsed.users && parsed.meId) return parsed;
    }
  } catch {
    /* ignore corrupt state */
  }
  return buildSeed();
}

const FALLBACK = (id: ID): User => ({
  id,
  name: id
    .split(/[.\-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' '),
  handle: id,
  avatar: '',
});

export interface Store {
  state: AppState;
  me: User;
  user: (id: ID) => User;
  setState: (fn: (s: AppState) => AppState) => void;
  reset: () => void;
  setTheme: (t: 'light' | 'dark') => void;
  toggleReaction: (postId: ID, key: ReactionKey) => void;
  addComment: (postId: ID, text: string) => void;
  likeComment: (postId: ID, commentId: ID) => void;
  createPost: (input: {
    text: string;
    media?: Media;
    audience?: Post['audience'];
    background?: string;
    feeling?: string;
    location?: string;
    groupId?: ID;
  }) => ID;
  deletePost: (postId: ID) => void;
  archivePost: (postId: ID) => void;
  toggleSaved: (postId: ID) => void;
  sharePost: (postId: ID, text: string) => ID;
  addStory: (items: Story['items']) => void;
  viewStory: (storyId: ID) => void;
  markNotificationsRead: () => void;
  addNotification: (n: { kind: NotifKind; userId?: ID; text: string; thumb?: string }) => void;
  acceptRequest: (id: ID) => void;
  declineRequest: (id: ID) => void;
  addFriend: (id: ID) => void;
  removeFriend: (id: ID) => void;
  sendMessage: (convId: ID, text: string) => void;
  reactToMessage: (convId: ID, msgId: ID, emoji: string) => void;
  markConversationRead: (convId: ID) => void;
  startConversation: (userId: ID) => ID;
  joinGroup: (id: ID) => void;
  toggleListingSave: (id: ID) => void;
  addRecentSearch: (q: string) => void;
}

const StoreCtx = createContext<Store | null>(null);

const AUTO_REPLIES = [
  'Ha — okay, that’s fair.',
  'Sending you the details now ✨',
  'Yes! Count me in.',
  'Give me ten minutes and I’ll call you.',
  'This is the best thing I’ve read today.',
  'Wait, really? Tell me everything.',
  'On my way, grabbing coffee for two.',
  'That’s exactly what I was thinking.',
];

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(load);
  const saveTimer = useRef<number | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        const { users, posts, stories, notifications, conversations, groups, videos, listings, saved, recentSearches, archived, ...rest } = state;
        // persist everything except the large immutable catalogue, which is seeded
        localStorage.setItem(KEY, JSON.stringify({ ...rest, users, posts, stories, notifications, conversations, groups, videos, listings, saved, recentSearches, archived }));
      } catch {
        /* storage full — keep running in memory */
      }
    }, 250);
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.colorScheme = state.theme;
  }, [state.theme]);

  const setState = useCallback((fn: (s: AppState) => AppState) => {
    setStateRaw((prev) => fn(prev));
  }, []);

  const me = state.users[state.meId] ?? FALLBACK(state.meId);
  const user = useCallback((id: ID) => state.users[id] ?? FALLBACK(id), [state.users]);

  const patchPost = useCallback(
    (postId: ID, fn: (p: Post) => Post) =>
      setState((s) => ({ ...s, posts: s.posts.map((p) => (p.id === postId ? fn(p) : p)) })),
    [setState],
  );

  const setTheme = useCallback((theme: 'light' | 'dark') => {
    setState((s) => ({ ...s, theme }));
  }, [setState]);

  const reset = useCallback(() => {
    localStorage.removeItem(KEY);
    setStateRaw(buildSeed());
  }, []);

  const toggleReaction = useCallback(
    (postId: ID, key: ReactionKey) =>
      patchPost(postId, (p) => {
        const reactions = { ...p.reactions };
        const prev = p.myReaction;
        if (prev === key) {
          reactions[key] = Math.max(0, (reactions[key] ?? 1) - 1);
          if (!reactions[key]) delete reactions[key];
          return { ...p, reactions, myReaction: null };
        }
        if (prev) {
          reactions[prev] = Math.max(0, (reactions[prev] ?? 1) - 1);
          if (!reactions[prev]) delete reactions[prev];
        }
        reactions[key] = (reactions[key] ?? 0) + 1;
        return { ...p, reactions, myReaction: key };
      }),
    [patchPost],
  );

  const addComment = useCallback(
    (postId: ID, text: string) =>
      patchPost(postId, (p) => {
        const c: Comment = { id: uid('c'), authorId: 'me', text, at: Date.now(), likes: 0 };
        return { ...p, comments: [...p.comments, c] };
      }),
    [patchPost],
  );

  const likeComment = useCallback(
    (postId: ID, commentId: ID) =>
      patchPost(postId, (p) => ({
        ...p,
        comments: p.comments.map((c) =>
          c.id === commentId ? { ...c, liked: !c.liked, likes: Math.max(0, c.likes + (c.liked ? -1 : 1)) } : c,
        ),
      })),
    [patchPost],
  );

  const createPost = useCallback<Store['createPost']>(
    (input) => {
      const id = uid('p');
      const post: Post = {
        id,
        authorId: 'me',
        at: Date.now(),
        text: input.text,
        media: input.media,
        audience: input.audience ?? 'public',
        background: input.background,
        feeling: input.feeling,
        location: input.location,
        reactions: {},
        comments: [],
        shares: 0,
        groupId: input.groupId,
      };
      setState((s) => ({ ...s, posts: [post, ...s.posts] }));
      return id;
    },
    [setState],
  );

  const deletePost = useCallback((postId: ID) => {
    setState((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== postId) }));
  }, [setState]);

  const archivePost = useCallback((postId: ID) => {
    setState((s) => ({ ...s, archived: [...(s.archived ?? []), postId] }));
  }, [setState]);

  const toggleSaved = useCallback((postId: ID) => {
    setState((s) => ({
      ...s,
      saved: s.saved.includes(postId) ? s.saved.filter((x) => x !== postId) : [...s.saved, postId],
      posts: s.posts.map((p) => (p.id === postId ? { ...p, saved: !p.saved } : p)),
    }));
  }, [setState]);

  const sharePost = useCallback<Store['sharePost']>((postId, text) => {
    const id = uid('p');
    const post: Post = {
      id,
      authorId: 'me',
      at: Date.now(),
      text,
      reactions: {},
      comments: [],
      shares: 0,
      sharedPostId: postId,
    };
    setState((s) => ({
      ...s,
      posts: [post, ...s.posts.map((p) => (p.id === postId ? { ...p, shares: p.shares + 1 } : p))],
    }));
    return id;
  }, [setState]);

  const addStory = useCallback((items: Story['items']) => {
    setState((s) => ({
      ...s,
      stories: [{ id: uid('s'), userId: s.meId, at: Date.now(), items }, ...s.stories.filter((st) => st.userId !== s.meId)],
    }));
  }, [setState]);

  const viewStory = useCallback((storyId: ID) => {
    setState((s) => ({ ...s, stories: s.stories.map((st) => (st.id === storyId ? { ...st, seen: true } : st)) }));
  }, [setState]);

  const markNotificationsRead = useCallback(() => {
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  }, [setState]);

  const addNotification = useCallback((n: { kind: NotifKind; userId?: ID; text: string; thumb?: string }) => {
    setState((s) => ({
      ...s,
      notifications: [{ id: uid('n'), kind: n.kind, userId: n.userId, text: n.text, at: Date.now(), thumb: n.thumb }, ...s.notifications],
    }));
  }, [setState]);

  const acceptRequest = useCallback((id: ID) => {
    setState((s) => ({
      ...s,
      requests: s.requests.filter((r) => r !== id),
      friends: s.friends.includes(id) ? s.friends : [...s.friends, id],
      notifications: s.notifications.filter((n) => !(n.kind === 'friend' && n.userId === id)),
    }));
  }, [setState]);

  const declineRequest = useCallback((id: ID) => {
    setState((s) => ({
      ...s,
      requests: s.requests.filter((r) => r !== id),
      notifications: s.notifications.filter((n) => !(n.kind === 'friend' && n.userId === id)),
    }));
  }, [setState]);

  const addFriend = useCallback((id: ID) => {
    setState((s) => ({
      ...s,
      friends: s.friends.filter((f) => f !== id),
      requests: s.requests.filter((r) => r !== id),
      suggestions: s.suggestions.filter((r) => r !== id),
    }));
  }, [setState]);

  const removeFriend = useCallback((id: ID) => {
    setState((s) => ({
      ...s,
      friends: s.friends.filter((f) => f !== id),
      suggestions: s.suggestions.includes(id) ? s.suggestions : [...s.suggestions, id],
    }));
  }, [setState]);

  const markConversationRead = useCallback((convId: ID) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === convId ? { ...c, unread: 0 } : c)),
    }));
  }, [setState]);

  const sendMessage = useCallback((convId: ID, text: string) => {
    const msg: Message = { id: uid('m'), from: 'me', text, at: Date.now() };
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === convId ? { ...c, messages: [...c.messages, msg], unread: 0 } : c,
      ),
    }));
    const conv = stateRef.current.conversations.find((c) => c.id === convId);
    if (conv && conv.userIds.length === 1) {
      const other = conv.userIds[0];
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      window.setTimeout(() => {
        setState((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, { id: uid('m'), from: other, text: reply, at: Date.now() }] }
              : c,
          ),
        }));
      }, 1700);
    }
  }, [setState]);

  const reactToMessage = useCallback((convId: ID, msgId: ID, emoji: string) => {
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId
                  ? {
                      ...m,
                      reactions: m.reactions?.includes(emoji)
                        ? m.reactions.filter((e) => e !== emoji)
                        : [...(m.reactions ?? []), emoji],
                    }
                  : m,
              ),
            }
          : c,
      ),
    }));
  }, [setState]);

  const startConversation = useCallback<Store['startConversation']>((userId) => {
    const existing = stateRef.current.conversations.find((c) => c.userIds.length === 1 && c.userIds[0] === userId);
    if (existing) return existing.id;
    const id = uid('cv');
    const conv: Conversation = { id, userIds: [userId], messages: [], unread: 0 };
    setState((s) => ({ ...s, conversations: [conv, ...s.conversations] }));
    return id;
  }, [setState]);

  const joinGroup = useCallback((id: ID) => {
    setState((s) => ({
      ...s,
      groups: s.groups.map((g) =>
        g.id === id ? { ...g, joined: !g.joined, members: g.members + (g.joined ? -1 : 1) } : g,
      ),
    }));
  }, [setState]);

  const toggleListingSave = useCallback((id: ID) => {
    setState((s) => ({
      ...s,
      listings: s.listings.map((l) => (l.id === id ? { ...l, saved: !l.saved } : l)),
    }));
  }, [setState]);

  const addRecentSearch = useCallback((q: string) => {
    const term = q.trim();
    if (!term) return;
    setState((s) => ({ ...s, recentSearches: [term, ...s.recentSearches.filter((x) => x !== term)].slice(0, 6) }));
  }, [setState]);

  const store = useMemo<Store>(
    () => ({
      state,
      me,
      user,
      setState,
      reset,
      setTheme,
      toggleReaction,
      addComment,
      likeComment,
      createPost,
      deletePost,
      archivePost,
      toggleSaved,
      sharePost,
      addStory,
      viewStory,
      markNotificationsRead,
      addNotification,
      acceptRequest,
      declineRequest,
      addFriend,
      removeFriend,
      sendMessage,
      reactToMessage,
      markConversationRead,
      startConversation,
      joinGroup,
      toggleListingSave,
      addRecentSearch,
    }),
    [state, me, user, setState, reset, setTheme, toggleReaction, addComment, likeComment, createPost, deletePost,
      archivePost, toggleSaved, sharePost, addStory, viewStory, markNotificationsRead, addNotification,
      acceptRequest, declineRequest, addFriend, removeFriend, sendMessage, reactToMessage, markConversationRead,
      startConversation, joinGroup, toggleListingSave, addRecentSearch],
  );

  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreCtx);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

export { FALLBACK as fallbackUser };
export type { Media };
