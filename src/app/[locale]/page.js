/* eslint-disable @next/next/no-img-element */
import { geoEqualEarth, geoGraticule10, geoPath } from "d3-geo";
import { ArrowRight, CalendarSearch, ExternalLink, Newspaper } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { feature } from "topojson-client";
import land110m from "world-atlas/land-110m.json";
import { EventCard } from "@/components/EventCard";
import { JsonLd } from "@/components/JsonLd";
import { getUpcomingEvents } from "@/lib/api";
import { getFeaturedNews } from "@/lib/news";
import { formatCountryName, formatDate } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { isLocale, languageAlternates, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const revalidate = 120;

const mapSize = {
  height: 250,
  width: 560,
};

const worldProjection = geoEqualEarth().fitExtent(
  [
    [28, 20],
    [532, 204],
  ],
  { type: "Sphere" },
);
const worldPath = geoPath(worldProjection);
const worldLand = feature(land110m, land110m.objects.land);
const worldLandPath = worldPath(worldLand) || "";
const worldSpherePath = worldPath({ type: "Sphere" }) || "";
const worldGraticulePath = worldPath(geoGraticule10()) || "";

const countryCoverageMetadata = {
  Argentina: { code: "AR", coordinates: [-64.9673, -34.9965] },
  Australia: { code: "AU", coordinates: [133.7751, -25.2744] },
  Austria: { code: "AT", coordinates: [14.5501, 47.5162] },
  Belgium: { code: "BE", coordinates: [4.4699, 50.5039] },
  Brazil: { code: "BR", coordinates: [-51.9253, -14.235] },
  Canada: { code: "CA", coordinates: [-106.3468, 56.1304] },
  Chile: { code: "CL", coordinates: [-71.543, -35.6751] },
  China: { code: "CN", coordinates: [104.1954, 35.8617] },
  Colombia: { code: "CO", coordinates: [-74.2973, 4.5709] },
  Croatia: { code: "HR", coordinates: [15.2, 45.1] },
  Czechia: { code: "CZ", coordinates: [15.473, 49.8175] },
  Denmark: { code: "DK", coordinates: [9.5018, 56.2639] },
  Egypt: { code: "EG", coordinates: [30.8025, 26.8206] },
  Estonia: { code: "EE", coordinates: [25.0136, 58.5953] },
  Finland: { code: "FI", coordinates: [25.7482, 61.9241] },
  France: { code: "FR", coordinates: [2.2137, 46.2276] },
  Germany: { code: "DE", coordinates: [10.4515, 51.1657] },
  Global: { code: "UN", coordinates: [0, 4] },
  Greece: { code: "GR", coordinates: [21.8243, 39.0742] },
  Hungary: { code: "HU", coordinates: [19.5033, 47.1625] },
  India: { code: "IN", coordinates: [78.9629, 20.5937] },
  Ireland: { code: "IE", coordinates: [-8.2439, 53.4129] },
  Israel: { code: "IL", coordinates: [34.8516, 31.0461] },
  Italy: { code: "IT", coordinates: [12.5674, 41.8719] },
  Japan: { code: "JP", coordinates: [138.2529, 36.2048] },
  Latvia: { code: "LV", coordinates: [24.6032, 56.8796] },
  Lithuania: { code: "LT", coordinates: [23.8813, 55.1694] },
  Mexico: { code: "MX", coordinates: [-102.5528, 23.6345] },
  Morocco: { code: "MA", coordinates: [-7.0926, 31.7917] },
  Netherlands: { code: "NL", coordinates: [5.2913, 52.1326] },
  "New Zealand": { code: "NZ", coordinates: [174.886, -40.9006] },
  Nigeria: { code: "NG", coordinates: [8.6753, 9.082] },
  Norway: { code: "NO", coordinates: [8.4689, 60.472] },
  Poland: { code: "PL", coordinates: [19.1451, 51.9194] },
  Portugal: { code: "PT", coordinates: [-8.2245, 39.3999] },
  Romania: { code: "RO", coordinates: [24.9668, 45.9432] },
  Spain: { code: "ES", coordinates: [-3.7492, 40.4637] },
  Sweden: { code: "SE", coordinates: [18.6435, 60.1282] },
  Switzerland: { code: "CH", coordinates: [8.2275, 46.8182] },
  Turkey: { code: "TR", coordinates: [35.2433, 38.9637] },
  Ukraine: { code: "UA", coordinates: [31.1656, 48.3794] },
  "United Arab Emirates": { code: "AE", coordinates: [53.8478, 23.4241] },
  "United Kingdom": { code: "GB", coordinates: [-3.436, 55.3781] },
  "United States": { code: "US", coordinates: [-98.5795, 39.8283] },
  Uruguay: { code: "UY", coordinates: [-55.7658, -32.5228] },
};

const fallbackCountryCoordinates = [
  [-30, 20],
  [42, 12],
  [100, 18],
  [-78, -8],
  [18, -24],
  [132, -20],
];

const coverageFallbackCopy = {
  eyebrow: "Active countries",
  label: "Tournament coverage by country",
  title: "Live tournament coverage",
  total: "tournaments",
};

function getProjectedMarker(coordinates, index, count, maxCount) {
  const projected = worldProjection(coordinates) || [mapSize.width / 2, mapSize.height / 2];
  const ratio = maxCount > 0 ? count / maxCount : 1;

  return {
    radius: 7 + ratio * 9,
    x: projected[0],
    y: projected[1],
  };
}

function getCountryTournamentStats(events, locale = "en") {
  const counts = new Map();

  events.forEach((event) => {
    const country = typeof event?.country === "string" ? event.country.trim() : "";
    const key = country || "Global";

    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const sortedStats = Array.from(counts, ([country, count]) => ({
    count,
    country,
    label: formatCountryName(country, locale),
  }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale, { sensitivity: "base" }))
    .slice(0, fallbackCountryCoordinates.length);
  const maxCount = Math.max(...sortedStats.map((stat) => stat.count), 1);

  return sortedStats.map((stat, index) => {
    const metadata = countryCoverageMetadata[stat.country] || {};
    const coordinates = metadata.coordinates || fallbackCountryCoordinates[index];

    return {
      ...stat,
      flagCode: (metadata.code || "UN").toLowerCase(),
      marker: getProjectedMarker(coordinates, index, stat.count, maxCount),
      rank: index + 1,
    };
  });
}

function CountryTournamentVisual({ copy, stats }) {
  if (!stats.length) return null;

  const coverageCopy = copy.home.coverage || coverageFallbackCopy;
  const total = stats.reduce((sum, stat) => sum + stat.count, 0);

  return (
    <aside className="country-coverage" aria-label={coverageCopy.label}>
      <div className="country-coverage-map" aria-hidden="true">
        <svg viewBox={`0 0 ${mapSize.width} ${mapSize.height}`} focusable="false">
          <defs>
            <linearGradient id="coverageScan" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#BA9B4A" stopOpacity="0" />
              <stop offset="44%" stopColor="#BA9B4A" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#BA9B4A" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect className="country-coverage-panel" x="1" y="1" width="558" height="248" rx="8" />
          <path className="country-coverage-sphere" d={worldSpherePath} />
          <path className="country-coverage-graticule" d={worldGraticulePath} />
          <path className="country-coverage-land" d={worldLandPath} />
          <path className="country-coverage-shimmer" d="M68 214H492" />
          {stats.map((stat, index) => {
            const markerClassName = `country-coverage-marker${index === 0 ? " is-leading" : ""}`;
            const pulseRadius = stat.marker.radius + 5;
            const haloRadius = stat.marker.radius + 9;

            return (
              <g
                className={markerClassName}
                key={stat.country}
                style={{ "--marker-order": index }}
                transform={`translate(${stat.marker.x} ${stat.marker.y})`}
              >
                <circle className="country-coverage-marker-halo" r={haloRadius} />
                <circle className="country-coverage-marker-pulse" r={pulseRadius} />
                <circle className="country-coverage-marker-core" r={stat.marker.radius} />
                <circle className="country-coverage-marker-dot" r="3" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="country-coverage-data">
        <div className="country-coverage-summary">
          <div>
            <p className="eyebrow">{coverageCopy.eyebrow}</p>
            <h2>{coverageCopy.title}</h2>
          </div>
          <div className="country-coverage-total">
            <strong>{total}</strong>
            <span>{coverageCopy.total}</span>
          </div>
        </div>
        <div className="country-coverage-list">
          {stats.map((stat, index) => (
            <div
              aria-label={`${stat.label} ${stat.count}`}
              className={`country-coverage-chip${index === 0 ? " is-leading" : ""}`}
              key={stat.country}
            >
              <span className="country-coverage-label">
                <span className={`country-coverage-flag fi fi-${stat.flagCode}`} aria-hidden="true" />
                <span className="country-coverage-country">{stat.label}</span>
              </span>
              <strong>{stat.count}</strong>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function CompactNewsCard({ copy, item, locale }) {
  const hasImage = typeof item.imageUrl === "string" && item.imageUrl.trim().length > 0;

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
        {hasImage ? (
          <img alt="" loading="lazy" referrerPolicy="no-referrer" src={item.imageUrl} />
        ) : (
          <span className="compact-news-fallback" aria-hidden="true">
            <Newspaper size={20} strokeWidth={1.9} />
            <span>{item.sourceName || "News"}</span>
          </span>
        )}
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
  const countryStats = getCountryTournamentStats(publicEvents, locale);
  const featuredEvents = publicEvents.slice(0, 3);
  const featuredNews = Array.isArray(news) ? news : [];
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
        <CountryTournamentVisual copy={copy} stats={countryStats} />
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
