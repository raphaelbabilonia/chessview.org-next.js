import { Clock, ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCardDateRange, formatCountryName, formatTimeControl } from "@/lib/format";
import { countryHref, localizedEventHref } from "@/lib/tournament";

const hostnameFor = (href) => {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const sameHost = (first, second) => {
  const firstHost = hostnameFor(first);
  const secondHost = hostnameFor(second);
  return Boolean(firstHost && secondHost && firstHost === secondHost);
};

const faviconUrlFor = (href) => {
  const host = hostnameFor(href);
  if (!host) return "";
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${host}`)}&sz=32`;
};

const originalSiteInfo = (event) => {
  const links = event.externalLinks || [];
  const website = links.find((link) => link.url && link.type === "website");
  const source = links.find((link) => link.url && link.type === "source");
  const firstLink = links.find((link) => link.url);
  const href = event.websiteUrl || website?.url || event.source?.url || source?.url || firstLink?.url || "";
  if (!href) return null;

  const sourceName = String(event.source?.name || "").trim();
  const label = sourceName && sameHost(href, event.source?.url) ? sourceName : hostnameFor(href) || sourceName;

  return {
    href,
    iconUrl: faviconUrlFor(href),
    label,
  };
};

const roundsLabel = (copy, count) => {
  const rounds = Number(count || 0);
  if (!rounds) return "";
  return `${rounds} ${rounds === 1 ? copy.card.round : copy.card.rounds}`;
};

export function EventCard({ copy, event, locale }) {
  const locationLabel = [event.city, formatCountryName(event.country, locale)].filter(Boolean).join(", ");
  const cardDate = formatCardDateRange(event.startDate, event.endDate, locale);
  const timeControl = formatTimeControl(event.timeControl, locale, copy.card.timeControlTba);
  const timeDetails = [timeControl, roundsLabel(copy, event.roundsCount)].filter(Boolean).join(" - ");
  const sourceInfo = originalSiteInfo(event);
  const sourceName = event.source?.name || event.sourceOrganizerName || copy.event.source;

  return (
    <article className="event-card">
      <div className="event-card-header">
        <time className="event-card-date" dateTime={event.startDate} title={cardDate.accessible}>
          <span className="event-card-date-primary">{cardDate.primary}</span>
          {cardDate.secondary ? <span className="event-card-date-secondary">{cardDate.secondary}</span> : null}
        </time>
        <div className="event-card-main">
          <div className="event-card-title-row">
            <h3>{event.title}</h3>
            <StatusBadge labels={copy.status} value={event.status || "published"} />
          </div>
          <p className="event-card-source">{sourceName}</p>
        </div>
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
          <Clock size={16} aria-hidden="true" />
          {timeDetails}
        </span>
      </div>
      <div className="event-card-actions">
        <Link
          className="button button-small"
          data-tracking-entity-id={event._id}
          data-tracking-entity-slug={event.slug}
          data-tracking-entity-title={event.title}
          data-tracking-entity-type="event"
          data-tracking-event="event_view_details"
          data-tracking-placement="event_card"
          href={localizedEventHref(locale, event)}
        >
          {copy.card.seeMore}
        </Link>
        {sourceInfo ? (
          <a
            className="button button-small button-ghost event-source-button"
            data-tracking-entity-id={event._id}
            data-tracking-entity-slug={event.slug}
            data-tracking-entity-title={event.title}
            data-tracking-entity-type="event"
            data-tracking-event="event_original_click"
            data-tracking-outbound-url={sourceInfo.href}
            data-tracking-placement="event_card"
            href={sourceInfo.href}
            rel="noreferrer"
            target="_blank"
          >
            {sourceInfo.iconUrl ? (
              <span
                aria-hidden="true"
                className="source-favicon"
                style={{ backgroundImage: `url(${sourceInfo.iconUrl})` }}
              />
            ) : (
              <ExternalLink size={16} aria-hidden="true" />
            )}
            <span>{sourceInfo.label || copy.card.originalSite}</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
