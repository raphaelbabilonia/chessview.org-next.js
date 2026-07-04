/* eslint-disable @next/next/no-img-element */
import { ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/format";
import { hasRequiredNewsImage } from "@/lib/news";

const normalizeTagLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");

export function NewsCard({ copy, item, locale }) {
  if (!hasRequiredNewsImage(item)) return null;

  const meta = [item.author, item.region, item.language].filter(Boolean).slice(0, 3);
  const relatedNames = Array.isArray(item.relatedPlayerNames) ? item.relatedPlayerNames.slice(0, 3) : [];
  const summary = item.summary || item.description;
  const visibleLabels = new Set(
    [item.sourceName, item.category, ...meta, item.relatedTournamentName, ...relatedNames]
      .map(normalizeTagLabel)
      .filter(Boolean)
  );
  const tags = Array.isArray(item.tags)
    ? item.tags.reduce((uniqueTags, tag) => {
        const label = String(tag || "").trim();
        const key = normalizeTagLabel(label);
        if (!key || visibleLabels.has(key) || uniqueTags.some((uniqueTag) => normalizeTagLabel(uniqueTag) === key)) {
          return uniqueTags;
        }
        if (uniqueTags.length < 4) uniqueTags.push(label);
        return uniqueTags;
      }, [])
    : [];

  return (
    <article className="news-card">
      <a
        className="news-card-image"
        data-tracking-entity-id={item.id}
        data-tracking-entity-title={item.title}
        data-tracking-entity-type="news"
        data-tracking-event="news_original_click"
        data-tracking-outbound-url={item.url}
        data-tracking-placement="news_card_image"
        href={item.url}
        rel="noreferrer"
        target="_blank"
      >
        <img alt="" loading="lazy" referrerPolicy="no-referrer" src={item.imageUrl} />
      </a>
      <div className="news-card-body">
        <div className="news-card-kicker">
          <span>{item.sourceName}</span>
          <span>{item.category}</span>
        </div>
        <h3>
          <a
            data-tracking-entity-id={item.id}
            data-tracking-entity-title={item.title}
            data-tracking-entity-type="news"
            data-tracking-event="news_original_click"
            data-tracking-outbound-url={item.url}
            data-tracking-placement="news_card_title"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            {item.title}
          </a>
        </h3>
        {meta.length ? <div className="news-card-meta">{meta.map((part) => <span key={part}>{part}</span>)}</div> : null}
        {summary ? <p className="news-card-summary">{summary}</p> : null}
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
          <a
            className="button button-small button-ghost"
            data-tracking-entity-id={item.id}
            data-tracking-entity-title={item.title}
            data-tracking-entity-type="news"
            data-tracking-event="news_original_click"
            data-tracking-outbound-url={item.url}
            data-tracking-placement="news_card_cta"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={16} aria-hidden="true" />
            {copy.news.readOriginal}
          </a>
        </div>
      </div>
    </article>
  );
}
