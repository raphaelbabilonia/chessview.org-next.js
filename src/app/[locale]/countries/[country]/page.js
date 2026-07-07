import { notFound } from "next/navigation";
import { EventCard } from "@/components/EventCard";
import { getAllUpcomingEvents } from "@/lib/api";
import { formatCountryName } from "@/lib/format";
import { pageSeoMetadata } from "@/lib/seo";
import { countryHref, slugifySegment } from "@/lib/tournament";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const titleCase = (value) =>
  String(value || "global")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

async function loadCountryEvents(countrySlug) {
  const label = titleCase(countrySlug);
  const { data: events, error } = await getAllUpcomingEvents({ country: label });
  return {
    data: events.filter((event) => slugifySegment(event.country || "global") === countrySlug),
    error,
  };
}

export async function generateMetadata({ params }) {
  const { country, locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const { data: events, error } = await loadCountryEvents(country);
  if (!error && events.length === 0) notFound();

  const label = events[0]?.country || titleCase(country);
  const displayLabel = formatCountryName(label, locale);
  const path = countryHref(label);

  return pageSeoMetadata({
    locale,
    path,
    title: `${copy.events.countryTitle} ${displayLabel}`,
    description: `${copy.events.description} ${displayLabel}.`,
  });
}

export default async function CountryEventsPage({ params }) {
  const { country, locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const { data: events, error } = await loadCountryEvents(country);
  if (!error && events.length === 0) notFound();
  const label = formatCountryName(events[0]?.country || titleCase(country), locale);

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">{copy.events.country}</p>
        <h1>
          {copy.events.countryTitle} {label}
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
