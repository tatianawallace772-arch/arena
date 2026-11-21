import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer__grid">
        <div>
          <div className="footer__brand">
            <span className="brand__mark brand__mark--sm">Æ</span>
            <strong>Encyclopædia</strong>
          </div>
          <p>
            A Britannica-inspired encyclopedia experience, built with Next.js and
            the free Wikipedia API. All article content is provided by Wikipedia
            contributors under CC BY-SA.
          </p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/browse">Browse topics</Link>
            </li>
            <li>
              <Link href="/search?q=history">Search history</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>About the data</h4>
          <ul>
            <li>
              <a
                href="https://en.wikipedia.org/w/api.php"
                target="_blank"
                rel="noreferrer"
              >
                Wikipedia API ↗
              </a>
            </li>
            <li>
              <a
                href="https://www.mediawiki.org/wiki/API:Main_page"
                target="_blank"
                rel="noreferrer"
              >
                MediaWiki API docs ↗
              </a>
            </li>
            <li>
              <a
                href="https://en.wikipedia.org/wiki/Wikipedia:General_disclaimer"
                target="_blank"
                rel="noreferrer"
              >
                Content disclaimer ↗
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="container footer__bottom">
        <span>© {new Date().getFullYear()} Encyclopædia — built with Next.js</span>
        <span>Not affiliated with Encyclopædia Britannica, Inc.</span>
      </div>
    </footer>
  );
}
