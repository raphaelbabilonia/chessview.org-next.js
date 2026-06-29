import { ArrowRight, CalendarSearch, Code2, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardPreview } from "@/components/BoardPreview";
import { EventCard } from "@/components/EventCard";
import { JsonLd } from "@/components/JsonLd";
import { getUpcomingEvents } from "@/lib/api";
import { siteConfig } from "@/lib/site";
import { isLocale, languageAlternates, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const revalidate = 120;

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
  const { data: events, error } = await getUpcomingEvents();
  const featuredEvents = events.slice(0, 3);
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
            <a
              className="button button-ghost"
              href="https://github.com/raphaelbabilonia/chessview.org-next.js"
              rel="noreferrer"
              target="_blank"
            >
              <Code2 size={18} aria-hidden="true" />
              {copy.home.source}
            </a>
          </div>
        </div>
        <BoardPreview />
      </section>

      <section className="page-section">
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
          <div className="event-grid">
            {featuredEvents.map((event) => (
              <EventCard copy={copy} event={event} key={event._id} locale={locale} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="page-section feature-band" aria-label={copy.home.foundations}>
        {copy.home.features.map((feature, index) => {
          const Icon = index === 0 ? Trophy : index === 1 ? UsersRound : Code2;
          return (
            <article key={feature.title}>
              <Icon size={22} aria-hidden="true" />
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
