"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import { searchArticles, type SearchResult } from "@/lib/wiki";

function SearchInner() {
  const params = useSearchParams();
  const q = params.get("q") || "";
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    searchArticles(q, 20)
      .then((r) => {
        if (!cancelled) setResults(r.results);
      })
      .catch(() => {
        if (!cancelled) setError("Search failed. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div className="search-wrap">
      <p className="hero__eyebrow">Search Results</p>
      <h1>{q ? `“${q}”` : "Search"}</h1>
      <div style={{ margin: "16px 0 8px" }}>
        <SearchBar initial={q} />
      </div>

      {loading ? (
        <div className="loading-wrap">
          <div className="spinner" />
          Searching the encyclopedia…
        </div>
      ) : error ? (
        <div className="empty-state">
          <h2>⚠️ {error}</h2>
        </div>
      ) : !q ? (
        <div className="empty-state">
          <h2>What would you like to know?</h2>
          <p>Type a subject above — e.g. “Albert Einstein”, “Roman Empire”, or “photosynthesis”.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <h2>No results for “{q}”</h2>
          <p>Try a different spelling or a broader term.</p>
          <p>
            <Link href="/browse">Browse topics instead →</Link>
          </p>
        </div>
      ) : (
        <>
          <p className="search-count">
            {results.length} result{results.length === 1 ? "" : "s"} for “{q}”
          </p>
          <div className="result-list">
            {results.map((r) => (
              <Link
                key={r.title}
                href={`/article/${encodeURIComponent(r.title.replace(/ /g, "_"))}`}
                className="result-card"
              >
                <h3>{r.title}</h3>
                <div
                  className="snippet"
                  dangerouslySetInnerHTML={{ __html: r.snippet }}
                />
                <div className="result-meta">
                  <span>{r.wordcount.toLocaleString()} words</span>
                  {r.timestamp && (
                    <span>Updated {new Date(r.timestamp).toLocaleDateString()}</span>
                  )}
                  <span>Read article →</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="loading-wrap"><div className="spinner" /></div>}>
      <SearchInner />
    </Suspense>
  );
}
