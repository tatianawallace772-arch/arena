import Link from "next/link";
import type { ArticleSummary } from "@/lib/wiki";
import { articleUrl } from "@/lib/wiki";

export default function ArticleCard({ article }: { article: ArticleSummary }) {
  const img = article.thumbnail || article.originalimage;
  return (
    <Link href={articleUrl(article.title)} className="card">
      <div className="card__media">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={article.title} loading="lazy" />
        ) : (
          <div className="card__placeholder" aria-hidden>
            <span>Æ</span>
          </div>
        )}
        {article.description && (
          <span className="card__badge">{article.description}</span>
        )}
      </div>
      <div className="card__body">
        <h3 className="card__title">{article.title}</h3>
        <p className="card__excerpt">{article.extract}</p>
        <span className="card__cta">Read article →</span>
      </div>
    </Link>
  );
}
