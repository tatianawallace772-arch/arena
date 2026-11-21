"use client";

import Link from "next/link";
import { TOPICS } from "@/lib/wiki";
import SearchBar from "@/components/SearchBar";

export default function BrowsePage() {
  return (
    <div className="container">
      <div className="browse-hero">
        <p className="hero__eyebrow">Browse the Collection</p>
        <h1>Topics &amp; Subjects</h1>
        <p>
          From ancient history to outer space — choose a subject to explore
          articles curated by search across Wikipedia.
        </p>
        <div style={{ maxWidth: 560, margin: "22px auto 0" }}>
          <SearchBar />
        </div>
      </div>

      <section className="section">
        <div className="topic-grid">
          {TOPICS.map((t) => (
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
          <h2>Start with a Classic</h2>
        </div>
        <p className="section__note">
          Timeless subjects every encyclopedia should contain:
        </p>
        <div className="topic-grid">
          {[
            "World War II",
            "Ancient Egypt",
            "The Renaissance",
            "Evolution",
            "The Solar System",
            "Shakespeare",
            "The Roman Empire",
            "Black holes",
          ].map((t) => (
            <Link
              key={t}
              href={`/article/${encodeURIComponent(t.replace(/ /g, "_"))}`}
              className="topic-card"
            >
              <span className="topic-card__icon">📖</span>
              <span className="topic-card__name">{t}</span>
              <span className="topic-card__desc">Read the article →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
