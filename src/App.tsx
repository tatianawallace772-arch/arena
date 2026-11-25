import { useEffect } from 'react';
import { useStore } from './lib/store';
import { useRoute, navigate } from './lib/router';
import { UIProvider } from './components/ui';
import { Topbar, LeftRail, RightRail, MobileNav } from './components/Chrome';
import { Composer } from './components/Composer';
import { SearchOverlay } from './components/SearchOverlay';
import { StoryViewer } from './components/Stories';
import { HomePage } from './pages/Home';
import { FriendsPage } from './pages/Friends';
import { GroupsPage, GroupDetailPage } from './pages/Groups';
import { WatchPage } from './pages/Watch';
import { MarketplacePage, ListingPage } from './pages/Marketplace';
import { ProfilePage } from './pages/Profile';
import { MessagesPage } from './pages/Messages';
import { NotificationsPage } from './pages/Notifications';
import { SavedPage } from './pages/Saved';
import { MemoriesPage } from './pages/Memories';
import { EventsPage, EventDetailPage } from './pages/Events';
import { SettingsPage } from './pages/Settings';
import { ImportPage } from './pages/Import';
import { GamesPage } from './pages/Games';
import { AboutPage } from './pages/About';
import { PostCard } from './components/PostCard';
import { Breadcrumb } from './components/Breadcrumb';

export default function App() {
  const { state, user } = useStore();
  const route = useRoute();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.path]);

  useEffect(() => {
    document.title = documentTitle(route.parts[0]);
  }, [route.parts]);

  const [a, b] = route.parts;

  let page: React.ReactNode;
  let showRails = true;

  switch (a) {
    case undefined:
    case '':
      page = <HomePage />;
      showRails = false; // Home renders its own three-column layout
      break;
    case 'friends':
      page = <FriendsPage initialTab={b === 'requests' ? 'requests' : b === 'suggestions' ? 'suggestions' : 'friends'} />;
      break;
    case 'groups':
      page = b ? <GroupDetailPage id={b} /> : <GroupsPage />;
      break;
    case 'watch':
      page = <WatchPage />;
      showRails = false;
      break;
    case 'marketplace':
      page = b ? <ListingPage id={b} /> : <MarketplacePage />;
      break;
    case 'profile':
      page = <ProfilePage id={b ?? state.meId} />;
      break;
    case 'messages':
      page = <MessagesPage id={b} />;
      showRails = false;
      break;
    case 'notifications':
      page = <NotificationsPage />;
      break;
    case 'saved':
      page = <SavedPage />;
      break;
    case 'memories':
      page = <MemoriesPage />;
      break;
    case 'events':
      page = b ? <EventDetailPage id={b} /> : <EventsPage />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'import':
      page = <ImportPage />;
      break;
    case 'games':
      page = <GamesPage />;
      break;
    case 'about':
      page = <AboutPage />;
      break;
    case 'post': {
      const post = state.posts.find((p) => p.id === b);
      page = post ? (
        <div className="page-wrap narrow">
          <Breadcrumb items={[{ label: 'Home', href: '#/' }, { label: 'Post' }]} />
          <PostCard post={post} />
          <div className="card card-pad" style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 16 }}>Post details</h3>
            <p className="hint" style={{ marginTop: 6 }}>
              Posted by {user(post.authorId).name} · {new Date(post.at).toLocaleString()} · permalink #{post.id}
            </p>
          </div>
        </div>
      ) : (
        <div className="page-wrap narrow">
          <div className="card empty-state">
            <h3>Post not found</h3>
            <p>It may have been deleted. <a className="link" href="#/">Back to your feed</a></p>
          </div>
        </div>
      );
      break;
    }
    default:
      page = (
        <div className="page-wrap narrow">
          <div className="card empty-state">
            <h3>Page not found</h3>
            <p>
              Junction doesn’t have a page at <code>#{route.path}</code>.<br />
              <a className="link" href="#/">Go home</a>
            </p>
          </div>
        </div>
      );
  }

  return (
    <UIProvider
      stories={state.stories}
      renderCompose={({ onClose, prefill }) => <Composer onClose={onClose} prefill={prefill} />}
      renderSearch={({ onClose }) => <SearchOverlay onClose={onClose} />}
      renderStories={({ index, onClose }) => <StoryViewer index={index} onClose={onClose} />}
    >
      <div className="app-shell">
        <Topbar />
        <main id="main">
          {showRails ? (
            <div className="layout page-layout">
              <LeftRail />
              <div className="layout-main">{page}</div>
              <RightRail />
            </div>
          ) : (
            page
          )}
        </main>
        <MobileNav />
      </div>
    </UIProvider>
  );
}

function documentTitle(section?: string): string {
  const map: Record<string, string> = {
    friends: 'Friends',
    groups: 'Groups',
    watch: 'Watch',
    marketplace: 'Marketplace',
    messages: 'Messenger',
    notifications: 'Notifications',
    saved: 'Saved',
    memories: 'Memories',
    events: 'Events',
    settings: 'Settings',
    import: 'Import from Facebook',
    games: 'Games',
    about: 'About',
  };
  const name = section ? map[section] : undefined;
  return name ? `${name} · Junction` : 'Junction — people, posts, and places';
}

export { navigate };
export type { };
