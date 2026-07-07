import { notFound } from "next/navigation";
import { EventCard } from "@/components/EventCard";
import { getAllUpcomingEvents } from "@/lib/api";
import { pageSeoMetadata } from "@/lib/seo";
import { slugifySegment, sourceHref } from "@/lib/tournament";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const labelFromSlug = (value) =>
  String(value || "source")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

async function loadSourceEvents(sourceSlug) {
  const label = labelFromSlug(sourceSlug);
  const { data: events, error } = await getAllUpcomingEvents({ source: label });
  return {
    data: events.filter((event) => slugifySegment(event.source?.name || "unknown") === sourceSlug),
    error,
  };
}

export async function generateMetadata({ params }) {
  const { locale, source } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const { data: events, error } = await loadSourceEvents(source);
  if (!error && events.length === 0) notFound();

  const label = events[0]?.source?.name || labelFromSlug(source);
  const path = sourceHref(label);

  return pageSeoMetadata({
    locale,
    path,
    title: `${copy.events.sourceTitle} ${label}`,
    description: `${copy.events.description} ${label}.`,
  });
}

export default async function SourceEventsPage({ params }) {
  const { locale, source } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const { data: events, error } = await loadSourceEvents(source);
  if (!error && events.length === 0) notFound();

  const label = events[0]?.source?.name || labelFromSlug(source);

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">{copy.events.source}</p>
        <h1>
          {copy.events.sourceTitle} {label}
        </h1>
      </section>

      {error ? <div className="state state-warning">{copy.events.apiError}</div> : null}
      {!error && events.length === 0 ? <div className="state">{copy.events.empty}</div> : null}
      {events.length ? (
        <section className="event-grid" aria-label={copy.events.results}>
          {events.map((event) => (
            <EventCard copy={copy} event={event} key={event._id} locale={locale} />
          ))}
        </section>
      ) : null}
    </main>
  );
}
