"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  cleanArticleHtml,
  getArticle,
  getCategories,
  getSummary,
  stripHtml,
  wikiUrl,
} from "@/lib/wiki";

export default function ArticlePage() {
  const params = useParams();
  const rawTitle = Array.isArray(params.title)
    ? params.title.join("/")
    : (params.title as string) || "";
  const title = useMemo(
    () => decodeURIComponent(rawTitle.replace(/_/g, " ")),
    [rawTitle]
  );

  const [html, setHtml] = useState("");
  const [displayTitle, setDisplayTitle] = useState(title);
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setHtml("");

    (async () => {
      try {
        const [article, summary, cats] = await Promise.allSettled([
          getArticle(title),
          getSummary(title),
          getCategories(title),
        ]);

        if (cancelled) return;

        if (article.status === "fulfilled") {
          setHtml(cleanArticleHtml(article.value.html));
          setDisplayTitle(stripHtml(article.value.displaytitle) || article.value.title);
        } else {
          throw new Error("Article not found");
        }

        if (summary.status === "fulfilled" && summary.value.description) {
          setDescription(summary.value.description);
        }
        if (cats.status === "fulfilled") {
          setCategories(cats.value.slice(0, 12));
        }
      } catch {
        if (!cancelled)
          setError(
            "This article could not be found. It may have been moved or deleted on Wikipedia."
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [title]);

  // Build a table of contents from the rendered HTML headings
  const toc = useMemo(() => {
    if (!html || typeof document === "undefined") return [];
    const div = document.createElement("div");
    div.innerHTML = html;
    const headings = Array.from(div.querySelectorAll("h2, h3"));
    return headings
      .map((h, i) => {
        const text = h.textContent?.trim() || "";
        const id = `sec-${i}`;
        h.id = id;
        return { id, text, level: h.tagName === "H3" ? 2 : 1 };
      })
      .filter((h) => h.text && !h.text.startsWith("References") && !h.text.startsWith("External links"))
      .slice(0, 30);
  }, [html]);

  if (loading) {
    return (
      <div className="article-wrap">
        <div className="loading-wrap">
          <div className="spinner" />
          Opening “{title}”…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="article-wrap">
        <nav className="breadcrumb">
          <Link href="/">Home</Link> <span>/</span> <span>Not found</span>
        </nav>
        <div className="empty-state">
          <h2>📭 Article not found</h2>
          <p>{error}</p>
          <p>
            <Link href={`/search?q=${encodeURIComponent(title)}`}>
              Search for “{title}” →
            </Link>
          </p>
          <p>
            <a href={wikiUrl(title)} target="_blank" rel="noreferrer">
              View on Wikipedia ↗
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="article-wrap">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/browse">Browse</Link>
        <span>/</span>
        <span>{displayTitle}</span>
      </nav>

      <header className="article-head">
        <h1 className="article-title">{displayTitle}</h1>
        {description && <p className="article-desc">{description}</p>}
        <div className="article-meta">
          <span>📚 Encyclopædia entry</span>
          <a href={wikiUrl(displayTitle)} target="_blank" rel="noreferrer">
            View on Wikipedia ↗
          </a>
          <button
            onClick={() => setShowToc((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "var(--burgundy)",
              fontWeight: 600,
              fontSize: 13,
              fontFamily: "var(--sans)",
            }}
          >
            {showToc ? "Hide contents ▲" : "Contents ▼"}
          </button>
        </div>
      </header>

      <div className="article-layout">
        <article
          className="wiki-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <aside className="article-toc" style={{ display: showToc || toc.length ? undefined : "none" }}>
          <h4>Contents</h4>
          {toc.length ? (
            <ul>
              {toc.map((t) => (
                <li key={t.id} className={t.level === 2 ? "toc-l2" : ""}>
                  <a href={`#${t.id}`}>{t.text}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
              No sections in this article.
            </p>
          )}
        </aside>
      </div>

      {categories.length > 0 && (
        <div className="article-cats">
          <span>Categories:</span>
          {categories.map((c) => (
            <Link key={c} href={`/search?q=${encodeURIComponent(c)}`}>
              {c}
            </Link>
          ))}
        </div>
      )}

      <div className="article-actions">
        <Link href="/" className="btn">
          ← Back to home
        </Link>
        <Link href="/browse" className="btn btn--ghost">
          Browse topics
        </Link>
        <a
          href={wikiUrl(displayTitle)}
          target="_blank"
          rel="noreferrer"
          className="btn btn--ghost"
        >
          Read on Wikipedia ↗
        </a>
      </div>
    </div>
  );
}
