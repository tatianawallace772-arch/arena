export type ID = string;

export type ReactionKey = 'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad' | 'angry';

export type Reactions = Partial<Record<ReactionKey, number>>;

export interface User {
  id: ID;
  name: string;
  handle: string;
  avatar: string;
  cover?: string;
  bio?: string;
  location?: string;
  work?: string;
  education?: string;
  birthday?: string; // MM-DD
  joined?: string;
  mutuals?: number;
  online?: boolean;
  page?: boolean;
}

export interface Comment {
  id: ID;
  authorId: ID;
  text: string;
  at: number; // epoch ms
  likes: number;
  liked?: boolean;
}

export interface Media {
  type: 'photo' | 'video' | 'link';
  src?: string;
  poster?: string;
  title?: string;
  url?: string;
  desc?: string;
  domain?: string;
  duration?: string;
  images?: string[];
}

export interface Post {
  id: ID;
  authorId: ID;
  at: number;
  text: string;
  media?: Media;
  audience?: 'public' | 'friends' | 'only-me' | 'group';
  background?: string;
  feeling?: string;
  location?: string;
  reactions: Reactions;
  myReaction?: ReactionKey | null;
  comments: Comment[];
  shares: number;
  saved?: boolean;
  groupId?: ID;
  live?: boolean;
  sharedPostId?: ID;
}

export interface StoryItem {
  type: 'photo';
  src: string;
  caption?: string;
}

export interface Story {
  id: ID;
  userId: ID;
  at: number;
  items: StoryItem[];
  seen?: boolean;
}

export type NotifKind = 'reaction' | 'comment' | 'friend' | 'birthday' | 'group' | 'mention' | 'event' | 'live' | 'tag';

export interface Notification {
  id: ID;
  kind: NotifKind;
  userId?: ID;
  text: string;
  at: number;
  read?: boolean;
  icon?: string;
  thumb?: string;
}

export interface Message {
  id: ID;
  from: ID; // user id or 'me'
  text: string;
  at: number;
  media?: string;
  reactions?: string[];
}

export interface Conversation {
  id: ID;
  name?: string; // group conversations
  userIds: ID[];
  messages: Message[];
  pinned?: boolean;
  muted?: boolean;
  unread?: number;
}

export interface Group {
  id: ID;
  name: string;
  cover: string;
  members: number;
  privacy: 'Public' | 'Private';
  joined?: boolean;
  desc: string;
  color: string;
}

export interface Video {
  id: ID;
  src: string;
  poster: string;
  title: string;
  authorId: ID;
  views: number;
  length: string;
  at: number;
}

export interface Listing {
  id: ID;
  title: string;
  price: number;
  image: string;
  sellerId: ID;
  place: string;
  category: string;
  desc: string;
  condition: string;
  saved?: boolean;
}

export interface ScrapedBundle {
  source: string;
  generatedAt: string;
  page: { id: string; name: string; avatar: string; url?: string; handle?: string };
  posts: Array<{
    id: string;
    at: number;
    text: string;
    images?: string[];
    video?: string;
    link?: { url: string; title?: string; desc?: string };
    reactions: Reactions;
    commentsCount: number;
    shares: number;
    url?: string;
  }>;
}

export interface AppState {
  version: number;
  meId: ID;
  theme: 'light' | 'dark';
  users: Record<ID, User>;
  friends: ID[];
  requests: ID[];
  suggestions: ID[];
  posts: Post[];
  stories: Story[];
  notifications: Notification[];
  conversations: Conversation[];
  groups: Group[];
  videos: Video[];
  listings: Listing[];
  saved: ID[];
  recentSearches: string[];
  archived?: ID[];
}
