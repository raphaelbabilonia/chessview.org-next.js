import { CalendarDays, ExternalLink, MapPin, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { compactDescription, formatCountryName, formatDateRange, formatTimeControl } from "@/lib/format";
import { countryHref, localizedEventHref, sourceHref } from "@/lib/tournament";
import { StatusBadge } from "./StatusBadge";

export function EventCard({ copy, event, locale }) {
  const fallbackDescription = `${event.city || ""} ${copy.card.eventFallback}`.trim();
  const description = compactDescription(event.description, fallbackDescription, { title: event.title });
  const locationLabel = [event.city, formatCountryName(event.country, locale)].filter(Boolean).join(", ");
  const normalizedDescription = description.toLowerCase();
  const locationOnlyDescription = [event.city, event.venueName, event.address]
    .filter(Boolean)
    .some((value) => normalizedDescription === String(value).toLowerCase());

  return (
    <article className="event-card">
      <div className="event-card-main">
        <p className="eyebrow">{formatDateRange(event.startDate, event.endDate, locale)}</p>
        <h3>{event.title}</h3>
        {locationOnlyDescription ? null : <p>{description}</p>}
      </div>
      <div className="event-meta-grid">
        <span>
          <MapPin size={16} aria-hidden="true" />
          {event.country ? (
            <Link href={`/${locale}${countryHref(event.country)}`}>
              {locationLabel}
            </Link>
          ) : (
            event.city || copy.card.locationTba
          )}
        </span>
        <span>
          <CalendarDays size={16} aria-hidden="true" />
          {formatTimeControl(event.timeControl, locale, copy.card.timeControlTba)}
        </span>
        <span>
          {event.source?.name ? <ExternalLink size={16} aria-hidden="true" /> : <Users size={16} aria-hidden="true" />}
          {event.source?.name ? (
            <Link href={`/${locale}${sourceHref(event.source.name)}`}>{event.source.name}</Link>
          ) : (
            `${event.playersCount || 0}/${event.maxPlayers || copy.card.openCapacity}`
          )}
        </span>
        <span>
          <Trophy size={16} aria-hidden="true" />
          {event.ratingType || `${event.sectionsCount || event.sections?.length || 0} ${copy.card.sections}`}
        </span>
      </div>
      <div className="event-card-actions">
        <StatusBadge labels={copy.status} value={event.status} />
        <StatusBadge labels={copy.status} value={event.registrationStatus} />
        <Link className="button button-small" href={localizedEventHref(locale, event)}>
          {copy.card.open}
        </Link>
      </div>
    </article>
  );
}
