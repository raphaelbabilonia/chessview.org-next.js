/* eslint-disable @next/next/no-img-element */
import { ExternalLink, Newspaper } from "lucide-react";
import { formatDate } from "@/lib/format";

export function NewsCard({ copy, item, locale }) {
  const hasImage = typeof item.imageUrl === "string" && item.imageUrl.trim().length > 0;
  const meta = [item.author, item.region, item.language].filter(Boolean).slice(0, 3);
  const tags = Array.isArray(item.tags) ? item.tags.slice(0, 4) : [];
  const relatedNames = Array.isArray(item.relatedPlayerNames) ? item.relatedPlayerNames.slice(0, 3) : [];

  return (
    <article className="news-card">
      <a className="news-card-image" href={item.url} rel="noreferrer" target="_blank">
        {hasImage ? (
          <img alt="" loading="lazy" referrerPolicy="no-referrer" src={item.imageUrl} />
        ) : (
          <span className="news-image-fallback" aria-hidden="true">
            <Newspaper size={34} strokeWidth={1.8} />
            <span>{item.sourceName || "Chess news"}</span>
          </span>
        )}
      </a>
      <div className="news-card-body">
        <div className="news-card-kicker">
          <span>{item.sourceName}</span>
          <span>{item.category}</span>
        </div>
        <h3>
          <a href={item.url} rel="noreferrer" target="_blank">
            {item.title}
          </a>
        </h3>
        {meta.length ? <div className="news-card-meta">{meta.map((part) => <span key={part}>{part}</span>)}</div> : null}
        <p>{item.summary}</p>
        {relatedNames.length || item.relatedTournamentName ? (
          <p className="news-card-related">
            {[item.relatedTournamentName, ...relatedNames].filter(Boolean).join(" / ")}
          </p>
        ) : null}
        {tags.length ? (
          <div className="news-card-tags" aria-label="News tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
        <div className="news-card-footer">
          <span>{formatDate(item.publishedAt, locale)}</span>
          <a className="button button-small button-ghost" href={item.url} rel="noreferrer" target="_blank">
            <ExternalLink size={16} aria-hidden="true" />
            {copy.news.readOriginal}
          </a>
        </div>
      </div>
    </article>
  );
}
