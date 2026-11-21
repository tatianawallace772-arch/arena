"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "./SearchBar";
import { getRandomTitle, articleUrl } from "@/lib/wiki";

export default function Header() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rolling, setRolling] = useState(false);

  const randomArticle = async () => {
    setRolling(true);
    try {
      const title = await getRandomTitle();
      router.push(articleUrl(title));
    } finally {
      setRolling(false);
      setMenuOpen(false);
    }
  };

  return (
    <header className="site-header">
      <div className="topbar">
        <div className="container topbar__inner">
          <span>The Modern Encyclopedia</span>
          <span className="topbar__right">
            Powered by the Wikipedia API · Free knowledge for everyone
          </span>
        </div>
      </div>

      <div className="container header__main">
        <Link href="/" className="brand" aria-label="Encyclopædia home">
          <span className="brand__mark">Æ</span>
          <span className="brand__text">
            <span className="brand__name">Encyclopædia</span>
            <span className="brand__tag">Knowledge, beautifully organised</span>
          </span>
        </Link>

        <div className="header__search">
          <SearchBar />
        </div>

        <nav className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main">
          <Link href="/" onClick={() => setMenuOpen(false)}>
            Home
          </Link>
          <Link href="/browse" onClick={() => setMenuOpen(false)}>
            Browse
          </Link>
          <button
            className="nav-random"
            onClick={randomArticle}
            disabled={rolling}
          >
            {rolling ? "Rolling…" : "🎲 Random article"}
          </button>
        </nav>

        <button
          className="menu-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      <div className="container header__search-mobile">
        <SearchBar />
      </div>
    </header>
  );
}
