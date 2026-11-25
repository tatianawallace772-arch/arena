import { useMemo, useRef, useState } from 'react';
import { Check, Copy, FileJson, FolderOpen, RefreshCw, Terminal, Upload } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI } from '../components/ui';
import { nfmt } from '../lib/util';
import type { ScrapedBundle } from '../lib/types';

const SNIPPET = `# 1) install the scraper + tooling
pip install facebook-scraper

# 2) scrape a public page/group into Junction's bundle format
python tools/fb_import.py --page nasa --pages 2 --out public/data/imports/nasa.json

# 3) in Junction: Import from Facebook → choose that JSON file
#    (or drop it in public/data/imports/ and reload to see it in the picker)`;

const SAMPLE = import.meta.env.VITE_SAMPLE_BUNDLE ?? '/data/imports/sample-page.json';

export function ImportPage() {
  const { state, setState } = useStore();
  const ui = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = useState<ScrapedBundle | null>(null);
  const [imported, setImported] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadBundle = (text: string) => {
    try {
      const data = JSON.parse(text) as ScrapedBundle;
      if (!data.posts || !Array.isArray(data.posts) || !data.page?.name) {
        ui.toast('That JSON is not a Junction import bundle');
        return;
      }
      setBundle(data);
      setImported(false);
      setLoadingSample(false);
    } catch {
      ui.toast('Could not parse that file as JSON');
    }
  };

  const loadSample = async () => {
    setLoadingSample(true);
    try {
      const res = await fetch(SAMPLE, { cache: 'no-store' });
      if (!res.ok) throw new Error('missing');
      loadBundle(await res.text());
      ui.toast('Sample bundle loaded');
    } catch {
      setLoadingSample(false);
      ui.toast('Sample bundle not found in this build — use a file from tools/fb_import.py');
    }
  };

  const doImport = () => {
    if (!bundle) return;
    const pageId = `fb-${bundle.page.id || bundle.page.handle || 'page'}`;
    const postsToAdd = bundle.posts.map((p, i) => ({
      id: `fbi-${Date.now()}-${i}`,
      authorId: pageId,
      at: p.at,
      text: p.text,
      media:
        p.images?.length
          ? { type: 'photo' as const, images: p.images.slice(0, 4), src: p.images[0] }
          : p.video
            ? { type: 'video' as const, src: p.video, poster: p.images?.[0] }
            : p.link?.url
              ? { type: 'link' as const, url: p.link.url, title: p.link.title, desc: p.link.desc, domain: new URL(p.link.url).hostname }
              : undefined,
      reactions: p.reactions ?? {},
      comments: [],
      shares: p.shares ?? 0,
      audience: 'public' as const,
    }));

    setState((s) => ({
      ...s,
      users: {
        ...s.users,
        [pageId]: {
          id: pageId,
          name: bundle.page.name,
          handle: bundle.page.handle ?? pageId,
          avatar: bundle.page.avatar || '',
          bio: `Imported from facebook-scraper · ${bundle.posts.length} posts · ${new Date(bundle.generatedAt).toLocaleDateString()}`,
          page: true,
          joined: String(new Date(bundle.generatedAt).getFullYear()),
          location: 'via facebook-scraper',
        },
      },
      posts: [...postsToAdd, ...s.posts],
    }));
    setImported(true);
    ui.toast(`Imported ${postsToAdd.length} posts from ${bundle.page.name}`);
  };

  const totalReactions = useMemo(
    () =>
      bundle?.posts.reduce(
        (n, p) => n + Object.values(p.reactions ?? {}).reduce((x, y) => x + y, 0),
        0,
      ) ?? 0,
    [bundle],
  );

  const pageUser = bundle ? state.users[`fb-${bundle.page.id || bundle.page.handle || 'page'}`] ?? null : null;

  return (
    <div className="page-wrap mid">
      <div className="page-head">
        <div>
          <h1>Import from Facebook</h1>
          <p>Turn public pages and groups into a live Junction feed using <b>facebook-scraper</b>.</p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Terminal size={18} /> 1 · Scrape with facebook-scraper</h3>
        <pre
          style={{
            marginTop: 12,
            background: '#12131a',
            color: '#e8e9ed',
            padding: 16,
            borderRadius: 12,
            overflowX: 'auto',
            fontSize: 12.8,
            lineHeight: 1.65,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            border: '1px solid var(--line)',
          }}
        >
          {SNIPPET}
        </pre>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button
            className="btn btn-sm btn-soft"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(SNIPPET);
              } catch {
                /* ignore */
              }
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy commands'}
          </button>
          <span className="hint">The script lives at <code>tools/fb_import.py</code> in this repo. facebook-scraper is a Python package for public data only — respect each site’s terms.</span>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><FileJson size={18} /> 2 · Load the bundle</h3>
        <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-soft" onClick={() => fileRef.current?.click()}>
            <FolderOpen size={16} /> Choose JSON file
          </button>
          <button className="btn btn-soft" onClick={loadSample} disabled={loadingSample}>
            <RefreshCw size={15} /> {loadingSample ? 'Loading…' : 'Load sample bundle'}
          </button>
          <span className="hint">Bundle format: <code>v1</code> · <code>page</code>, <code>posts[]</code>, <code>reactions</code>, <code>comments</code></span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              const reader = new FileReader();
              reader.onload = () => loadBundle(String(reader.result));
              reader.readAsText(f);
            }
            e.currentTarget.value = '';
          }}
        />
      </div>

      {bundle && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="widget-head">
            <span>3 · Preview</span>
            <span className="tag">{bundle.posts.length} posts · {nfmt(totalReactions)} reactions</span>
          </div>
          <div className="card-pad">
            <div className="row" style={{ gap: 12, marginBottom: 14 }}>
              {bundle.page.avatar ? (
                <img src={bundle.page.avatar} alt="" className="avatar" width={48} height={48} style={{ borderRadius: 12 }} />
              ) : (
                <span className="avatar-letter" style={{ width: 48, height: 48, background: 'var(--brand)', borderRadius: 12 }}>{bundle.page.name[0]}</span>
              )}
              <div className="grow">
                <div style={{ fontWeight: 750, fontSize: 16 }}>{bundle.page.name}</div>
                <div className="hint">
                  Scraped {new Date(bundle.generatedAt).toLocaleString()} · source: {bundle.source}
                  {pageUser ? ' · already imported (re-importing duplicates posts)' : ''}
                </div>
              </div>
              <button className="btn btn-brand" onClick={doImport} disabled={imported}>
                {imported ? <><Check size={16} /> Imported</> : <><Upload size={16} /> Import {bundle.posts.length} posts</>}
              </button>
            </div>
            {imported && (
              <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className="pill-count" style={{ background: 'var(--green)' }}>Live</span>
                <a className="link" href="#/">See them on your feed</a>
                <span>·</span>
                <a className="link" href={`#/profile/fb-${bundle.page.id || bundle.page.handle || 'page'}`}>Open {bundle.page.name}’s page</a>
              </div>
            )}
            <div className="stack" style={{ gap: 10 }}>
              {bundle.posts.slice(0, 6).map((p) => {
                const rx = Object.values(p.reactions ?? {}).reduce((a, b) => a + b, 0);
                return (
                  <div key={p.id} className="list-row" style={{ border: '1px solid var(--line)', alignItems: 'flex-start' }}>
                    {p.images?.[0] && (
                      <img src={p.images[0]} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
                    )}
                    <div className="grow">
                      <div className="lr-title clamp-2" style={{ fontWeight: 600 }}>
                        {p.text || p.link?.title || '(media post)'}
                      </div>
                      <div className="lr-sub">
                        {new Date(p.at).toLocaleDateString()} · {nfmt(rx)} reactions · {p.commentsCount} comments · {p.shares} shares
                      </div>
                    </div>
                  </div>
                );
              })}
              {bundle.posts.length > 6 && <span className="hint">and {bundle.posts.length - 6} more…</span>}
            </div>
          </div>
        </div>
      )}

      <div className="card card-pad">
        <h3 style={{ fontSize: 16 }}>How this works</h3>
        <ol style={{ margin: '10px 0 0 18px', paddingLeft: 0, color: 'var(--text-2)', fontSize: 14, lineHeight: 1.8 }}>
          <li><b>Scrape.</b> <code>facebook-scraper</code> reads public page HTML and yields post dicts — text, time, image, video, likes/comments/shares.</li>
          <li><b>Bundle.</b> <code>tools/fb_import.py</code> normalises those dicts into the JSON shape this page expects and adds the page metadata.</li>
          <li><b>Import.</b> This page creates a Junction page-account for the source plus post objects with reaction counts, so the feed sorts and filters normally.</li>
          <li><b>Persist.</b> Imported content is saved to <code>localStorage</code>; export it any time from Settings → Your data.</li>
        </ol>
        <p className="hint" style={{ marginTop: 10 }}>
          Use the bundled sample to try the flow instantly, or run the scraper against a public page you have
          permission to collect. Junction is a demo and is not affiliated with Meta Platforms.
        </p>
      </div>
    </div>
  );
}
