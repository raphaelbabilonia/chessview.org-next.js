/* eslint-disable @next/next/no-img-element */
import { ArrowRight, CalendarSearch, ExternalLink, Newspaper } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountryCoverageSummary } from "@/components/CountryCoverageSummary";
import { EventCard } from "@/components/EventCard";
import { JsonLd } from "@/components/JsonLd";
import { getUpcomingEvents } from "@/lib/api";
import { buildCountryCoverage } from "@/lib/coverage";
import { getFeaturedNews, hasRequiredNewsImage } from "@/lib/news";
import { formatDate } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { isLocale, languageAlternates, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const revalidate = 120;

function CompactNewsCard({ copy, item, locale }) {
  if (!hasRequiredNewsImage(item)) return null;

  return (
    <article className="compact-news-card">
      <a
        className="compact-news-image"
        data-tracking-entity-id={item.id}
        data-tracking-entity-title={item.title}
        data-tracking-entity-type="news"
        data-tracking-event="news_original_click"
        data-tracking-outbound-url={item.url}
        data-tracking-placement="home_news_image"
        href={item.url}
        rel="noreferrer"
        target="_blank"
      >
        <img alt="" loading="lazy" referrerPolicy="no-referrer" src={item.imageUrl} />
      </a>
      <div className="compact-news-body">
        <div className="compact-news-meta">
          <span>{item.sourceName}</span>
          <span>{formatDate(item.publishedAt, locale)}</span>
        </div>
        <h3>
          <a
            data-tracking-entity-id={item.id}
            data-tracking-entity-title={item.title}
            data-tracking-entity-type="news"
            data-tracking-event="news_original_click"
            data-tracking-outbound-url={item.url}
            data-tracking-placement="home_news_title"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            {item.title}
          </a>
        </h3>
        <a
          className="compact-news-link"
          data-tracking-entity-id={item.id}
          data-tracking-entity-title={item.title}
          data-tracking-entity-type="news"
          data-tracking-event="news_original_click"
          data-tracking-outbound-url={item.url}
          data-tracking-placement="home_news_cta"
          href={item.url}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink size={14} aria-hidden="true" />
          {copy.news.readOriginal}
        </a>
      </div>
    </article>
  );
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getDictionary(locale);

  return {
    title: {
      absolute: copy.site.name,
    },
    description: copy.site.description,
    alternates: {
      canonical: localePath(locale),
      languages: languageAlternates("/"),
    },
    openGraph: {
      title: copy.site.name,
      description: copy.site.description,
      url: localePath(locale),
    },
  };
}

export default async function HomePage({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const [eventsResult, newsResult] = await Promise.all([getUpcomingEvents(), getFeaturedNews(3)]);
  const { data: events, error } = eventsResult;
  const { data: news, error: newsError } = newsResult;
  const publicEvents = Array.isArray(events) ? events : [];
  const countryCoverage = buildCountryCoverage(publicEvents, locale);
  const featuredEvents = publicEvents.slice(0, 3);
  const featuredNews = Array.isArray(news) ? news.filter(hasRequiredNewsImage) : [];
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: copy.site.name,
    url: `${siteConfig.url}/${locale}`,
    description: copy.site.description,
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteConfig.url}/${locale}/events?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <main>
      <JsonLd data={websiteJsonLd} id={`website-jsonld-${locale}`} />
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">{copy.home.eyebrow}</p>
          <h1>{copy.home.title}</h1>
          <p>{copy.home.lead}</p>
          <div className="button-row">
            <Link className="button" href={`/${locale}/events`}>
              <CalendarSearch size={18} aria-hidden="true" />
              {copy.home.browse}
            </Link>
            <Link className="button button-ghost" href={`/${locale}/news`}>
              <Newspaper size={18} aria-hidden="true" />
              {copy.home.news.viewAll}
            </Link>
          </div>
        </div>
        <CountryCoverageSummary copy={copy} coverage={countryCoverage} locale={locale} />
      </section>

      <section className="page-section landing-updates">
        <div className="landing-column">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{copy.home.publicCalendar}</p>
              <h2>{copy.home.upcoming}</h2>
            </div>
            <Link className="button button-small button-ghost" href={`/${locale}/events`}>
              {copy.home.viewAll}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {error ? <div className="state state-warning">{copy.home.apiError}</div> : null}
          {!error && featuredEvents.length === 0 ? <div className="state">{copy.home.empty}</div> : null}
          {featuredEvents.length ? (
            <div className="event-grid landing-event-grid">
              {featuredEvents.map((event) => (
                <EventCard copy={copy} event={event} key={event._id} locale={locale} />
              ))}
            </div>
          ) : null}
        </div>

        <aside className="landing-column landing-news" id="news">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{copy.home.news.eyebrow}</p>
              <h2>{copy.news.latest}</h2>
            </div>
            <Link className="button button-small button-ghost" href={`/${locale}/news`}>
              {copy.home.news.viewAll}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {newsError ? <div className="state state-warning">{copy.news.apiError}</div> : null}
          {!newsError && featuredNews.length === 0 ? <div className="state">{copy.news.empty}</div> : null}
          {featuredNews.length ? (
            <div className="compact-news-list">
              {featuredNews.map((item) => (
                <CompactNewsCard copy={copy} item={item} key={item.id} locale={locale} />
              ))}
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
