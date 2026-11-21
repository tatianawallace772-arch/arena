"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import ArticleCard from "@/components/ArticleCard";
import {
  FEATURED_TITLES,
  TOPICS,
  getOnThisDay,
  getRandomArticles,
  getSummaries,
  type ArticleSummary,
  type OnThisDayItem,
} from "@/lib/wiki";

export default function HomePage() {
  const [featured, setFeatured] = useState<ArticleSummary[]>([]);
  const [randoms, setRandoms] = useState<ArticleSummary[]>([]);
  const [births, setBirths] = useState<OnThisDayItem[]>([]);
  const [events, setEvents] = useState<OnThisDayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [f, r, otd] = await Promise.all([
          getSummaries(FEATURED_TITLES),
          getRandomArticles(4),
          getOnThisDay(),
        ]);
        if (cancelled) return;
        setFeatured(f);
        setRandoms(r);
        setBirths(otd.births.slice(0, 4));
        setEvents(otd.events.slice(0, 4));
      } catch (e) {
        if (!cancelled) setError("Could not load articles. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="hero__eyebrow">Est. MMXXVI · Free Knowledge</p>
          <h1 className="hero__title">
            The <em>Encyclopædia</em>
          </h1>
          <p className="hero__sub">
            Explore the world of knowledge — history, science, biography, and
            beyond — in the tradition of the great encyclopedias, powered live
            by Wikipedia.
          </p>
          <div className="hero__search">
            <SearchBar large autoFocus />
          </div>
          <div className="hero__chips">
            <span>Popular:</span>
            {["Albert Einstein", "Cleopatra", "The Moon", "Leonardo da Vinci", "Marie Curie"].map(
              (t) => (
                <Link key={t} href={`/article/${encodeURIComponent(t.replace(/ /g, "_"))}`}>
                  {t}
                </Link>
              )
            )}
          </div>
          <div className="hero__stats">
            <span>
              <strong>6.9M+</strong> articles via Wikipedia
            </span>
            <span>
              <strong>300+</strong> languages
            </span>
            <span>
              <strong>Live</strong> Wikipedia API
            </span>
          </div>
        </div>
      </section>

      <div className="container">
        {error && (
          <div className="empty-state" style={{ marginTop: 28 }}>
            <h2>⚠️ {error}</h2>
            <p>Please reload the page — articles are fetched live from Wikipedia.</p>
          </div>
        )}

        {loading ? (
          <div className="loading-wrap">
            <div className="spinner" />
            Consulting the encyclopedia…
          </div>
        ) : (
          <>
            <section className="section">
              <div className="section__head">
                <h2>Featured Articles</h2>
                <Link href="/browse">Browse all topics →</Link>
              </div>
              <div className="card-grid">
                {featured.map((a) => (
                  <ArticleCard key={a.title} article={a} />
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section__head">
                <h2>Browse by Topic</h2>
                <Link href="/browse">All topics →</Link>
              </div>
              <div className="topic-grid">
                {TOPICS.slice(0, 8).map((t) => (
                  <Link
                    key={t.name}
                    href={`/search?q=${encodeURIComponent(t.query)}`}
                    className="topic-card"
                  >
                    <span className="topic-card__icon">{t.icon}</span>
                    <span className="topic-card__name">{t.name}</span>
                    <span className="topic-card__desc">{t.desc}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section__head">
                <h2>On This Day</h2>
                <span style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-soft)" }}>
                  {today}
                </span>
              </div>
              <div className="otd-grid">
                <div className="otd-panel">
                  <h3>🎂 Births</h3>
                  <ul className="otd-list">
                    {births.map((b, i) => (
                      <li key={i}>
                        {b.thumbnail?.source && <img src={b.thumbnail.source} alt="" loading="lazy" />}
                        <div>
                          <span className="otd-year">{b.year || ""}</span>{" "}
                          <Link
                            className="otd-title"
                            href={`/article/${encodeURIComponent(b.title.replace(/ /g, "_"))}`}
                          >
                            {b.title}
                          </Link>
                          <span className="otd-text">{b.extract}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="otd-panel">
                  <h3>📌 Events</h3>
                  <ul className="otd-list">
                    {events.map((b, i) => (
                      <li key={i}>
                        <div>
                          <span className="otd-year">{b.year || ""}</span>{" "}
                          <Link
                            className="otd-title"
                            href={`/article/${encodeURIComponent(b.title.replace(/ /g, "_"))}`}
                          >
                            {b.title}
                          </Link>
                          <span className="otd-text">{b.extract}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="section__head">
                <h2>Serendipity — Random Picks</h2>
                <Link href="/browse">More topics →</Link>
              </div>
              <p className="section__note">
                A fresh selection of articles, chosen at random from Wikipedia.
              </p>
              <div className="card-grid">
                {randoms.map((a) => (
                  <ArticleCard key={a.title} article={a} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
