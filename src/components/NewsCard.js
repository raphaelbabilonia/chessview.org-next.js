import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { formatDate } from "@/lib/format";

export function NewsCard({ copy, item, locale }) {
  return (
    <article className="news-card">
      <a className="news-card-image" href={item.url} rel="noreferrer" target="_blank">
        <Image
          alt=""
          fill
          sizes="(min-width: 1080px) 33vw, (min-width: 700px) 50vw, 100vw"
          src={item.imageUrl}
        />
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
        <p>{item.summary}</p>
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
