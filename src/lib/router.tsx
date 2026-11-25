import { useCallback, useEffect, useState } from 'react';

export interface Route {
  path: string; // e.g. "/groups/g1"
  parts: string[];
  query: URLSearchParams;
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs ?? '') };
}

export function navigate(path: string, opts: { replace?: boolean; scroll?: boolean } = {}) {
  const target = `#${path}`;
  if (opts.replace) {
    history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
  if (opts.scroll !== false) window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function useNavigate() {
  return useCallback((path: string, opts?: { replace?: boolean; scroll?: boolean }) => navigate(path, opts), []);
}
