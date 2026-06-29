import { CalendarDays, ExternalLink, FileText, MapPin } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { StatusBadge } from "@/components/StatusBadge";
import { backendAssetUrl, getEvent } from "@/lib/api";
import { compactDescription, formatCountryName, formatDateRange, formatDateTime, formatTimeControl } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import { byId, localizedEventHref, playerName, resultLabel } from "@/lib/tournament";
import { isLocale, languageAlternates, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const eventStatusUrl = (status) =>
  ({
    completed: "https://schema.org/EventCompleted",
    cancelled: "https://schema.org/EventCancelled",
  })[status] || "https://schema.org/EventScheduled";

const eventPath = (event) => `/events/${event.slug || event._id}`;

const documentHref = (document) => backendAssetUrl(document.localUrl || document.url);

const documentLabel = (document, labels = {}) =>
  [document.label, labels[document.type], labels[document.status]]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" - ");

const uniqueLocationParts = (parts) => {
  const seen = new Set();

  return parts.reduce((result, part) => {
    const clean = String(part || "").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return result;
    seen.add(key);
    result.push(clean);
    return result;
  }, []);
};

const includesLocationPart = (location, part) => {
  const haystack = String(location || "").toLowerCase();
  const needle = String(part || "").toLowerCase();
  if (!haystack || !needle) return false;
  if (needle === "united states" && /\busa\b/.test(haystack)) return true;
  return haystack.includes(needle);
};

async function loadEvent(id) {
  return getEvent(id);
}

export async function generateMetadata({ params }) {
  const { id, locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const { data: event, notFound: eventNotFound } = await loadEvent(id);

  if (eventNotFound) notFound();

  if (!event) {
    return {
      title: copy.notFound.title,
    };
  }

  const path = eventPath(event);
  const description = compactDescription(event.description, `${event.title} in ${event.city}`, { title: event.title });

  return {
    title: event.title,
    description,
    alternates: {
      canonical: localePath(locale, path),
      languages: languageAlternates(path),
    },
    openGraph: {
      type: "article",
      title: event.title,
      description,
      url: localePath(locale, path),
    },
    twitter: {
      card: "summary",
      title: event.title,
      description,
    },
  };
}

export default async function EventDetailPage({ params }) {
  const { id, locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const { data: event, error, notFound: eventNotFound } = await loadEvent(id);

  if (eventNotFound || (!event && !error)) notFound();

  if (event?.slug && id !== event.slug) {
    redirect(localizedEventHref(locale, event));
  }

  if (error) {
    return (
      <main className="page">
        <div className="state state-warning">{copy.event.unavailable}</div>
      </main>
    );
  }

  const players = event.players || [];
  const rounds = [...(event.rounds || [])].sort((a, b) => a.number - b.number);
  const pairings = event.pairings || [];
  const documents = event.documents || [];
  const playerMap = byId(players);
  const pairingsByRound = pairings.reduce((groups, pairing) => {
    groups[pairing.round] = groups[pairing.round] || [];
    groups[pairing.round].push(pairing);
    return groups;
  }, {});
  const description = compactDescription(event.description, copy.event.detailsFallback, {
    maxLength: 320,
    title: event.title,
  });
  const locationBase = uniqueLocationParts([event.venueName, event.address]).join(", ");
  const location = uniqueLocationParts([
    locationBase,
    includesLocationPart(locationBase, event.city) ? "" : event.city,
  ]).join(", ");
  const organizerName = event.sourceOrganizerName || event.organizer?.name || "";
  const contactText = [event.contactEmail, event.contactPhone].filter(Boolean).join(" / ");
  const displayCountry = formatCountryName(event.country, locale);
  const country = includesLocationPart(location, event.country) || includesLocationPart(location, displayCountry) ? "" : displayCountry;
  const sourceLinkLabels = {
    source: copy.event.originalSource,
    website: copy.event.officialWebsite,
    results: copy.event.resultsLink,
    regulations: copy.event.regulationsLink,
  };
  const fallbackSourceLinks = [
    event.source?.url
      ? {
          href: event.source.url,
          label: copy.event.originalSource,
        }
      : null,
    event.websiteUrl
      ? {
          href: event.websiteUrl,
          label: copy.event.officialWebsite,
        }
      : null,
    event.resultsUrl
      ? {
          href: event.resultsUrl,
          label: copy.event.resultsLink,
        }
      : null,
    event.regulationsUrl
      ? {
          href: event.regulationsUrl,
          label: copy.event.regulationsLink,
        }
      : null,
  ].filter(Boolean);
  const sourceLinks = event.externalLinks?.length
    ? event.externalLinks
        .filter((link) => link.url)
        .map((link) => ({
          href: link.url,
          label: sourceLinkLabels[link.type] || link.label || copy.event.originalSource,
        }))
    : fallbackSourceLinks;
  const schema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: event.title,
    description,
    sport: "Chess",
    url: absoluteUrl(localePath(locale, eventPath(event))),
    inLanguage: locale,
    startDate: event.startDate,
    endDate: event.endDate,
    eventStatus: eventStatusUrl(event.status),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venueName || event.city,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.address || undefined,
        addressLocality: event.city,
      },
    },
    organizer: organizerName
      ? {
          "@type": "Organization",
          name: organizerName,
        }
      : undefined,
  };

  return (
    <main className="page">
      <JsonLd data={schema} id={`event-jsonld-${event._id}-${locale}`} />
      <section className="event-detail-header">
        <div>
          <p className="eyebrow">{formatDateRange(event.startDate, event.endDate, locale)}</p>
          <h1>{event.title}</h1>
          <div className="event-header-meta">
            <span>
              <MapPin size={16} aria-hidden="true" />
              {event.venueName || event.city}
            </span>
            <span>
              <CalendarDays size={16} aria-hidden="true" />
              {formatTimeControl(event.timeControl, locale, copy.event.timeControlTba)}
            </span>
          </div>
        </div>
        <div className="badge-stack">
          <StatusBadge labels={copy.status} value={event.status} />
          <StatusBadge labels={copy.status} value={event.registrationStatus} />
        </div>
      </section>

      <nav className="anchor-nav" aria-label={copy.event.sectionsNav}>
        <a href="#overview">{copy.event.overview}</a>
        <a href="#players">{copy.event.players}</a>
        <a href="#rounds">{copy.event.rounds}</a>
        <a href="#standings">{copy.event.standings}</a>
        {documents.length ? <a href="#documents">{copy.event.documents}</a> : null}
      </nav>

      <section className="content-grid" id="overview">
        <article className="info-panel">
          <h2>{copy.event.eventOverview}</h2>
          <p>{description}</p>
          <dl className="detail-list">
            <div>
              <dt>{copy.event.starts}</dt>
              <dd>{formatDateTime(event.startDate, locale)}</dd>
            </div>
            <div>
              <dt>{copy.event.ends}</dt>
              <dd>{formatDateTime(event.endDate, locale)}</dd>
            </div>
            <div>
              <dt>{copy.event.location}</dt>
              <dd>{[location, country].filter(Boolean).join(", ") || copy.event.tba}</dd>
            </div>
            <div>
              <dt>{copy.event.organizer}</dt>
              <dd>{organizerName || copy.event.organizer}</dd>
            </div>
            <div>
              <dt>{copy.event.ratingType}</dt>
              <dd>{event.ratingType || copy.event.tba}</dd>
            </div>
          </dl>
        </article>

        <article className="info-panel">
          <h2>{copy.event.sections}</h2>
          {event.sections?.length ? (
            <ul className="data-list">
              {event.sections.map((section) => (
                <li className="data-row" key={section._id}>
                  <strong>{section.name}</strong>
                  <span>{formatTimeControl(section.timeControl || event.timeControl, locale, copy.event.timeControlTba)}</span>
                  <span>
                    {section.roundsCount || 0} {copy.event.roundsCount}
                  </span>
                  <span>
                    {section.maxPlayers || copy.event.open} {copy.event.playersCapacity}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">{copy.event.noSections}</p>
          )}
        </article>

        <article className="info-panel">
          <h2>{copy.event.registration}</h2>
          <dl className="detail-list">
            <div>
              <dt>{copy.events.status}</dt>
              <dd>{copy.status[event.registrationStatus] || event.registrationStatus || copy.status.closed}</dd>
            </div>
            <div>
              <dt>{copy.event.contact}</dt>
              <dd>{contactText || copy.event.tba}</dd>
            </div>
            <div>
              <dt>{copy.event.capacity}</dt>
              <dd>{event.maxPlayers || copy.event.open}</dd>
            </div>
          </dl>
        </article>

        {event.source?.name || sourceLinks.length ? (
          <article className="info-panel">
            <h2>{copy.event.source}</h2>
            <dl className="detail-list">
              <div>
                <dt>{copy.event.sourceName}</dt>
                <dd>{event.source?.name || copy.event.tba}</dd>
              </div>
              <div>
                <dt>{copy.event.lastChecked}</dt>
                <dd>{formatDateTime(event.source?.lastCheckedAt, locale)}</dd>
              </div>
            </dl>
            {sourceLinks.length ? (
              <div className="link-list">
                {sourceLinks.map((link) => (
                  <a href={link.href} key={`${link.label}-${link.href}`} rel="noreferrer" target="_blank">
                    <ExternalLink size={16} aria-hidden="true" />
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </article>
        ) : null}

        <article className="info-panel" id="documents">
          <h2>{copy.event.documents}</h2>
          {documents.length ? (
            <div className="link-list document-list">
              {documents.map((document) => (
                <a
                  href={documentHref(document)}
                  key={`${document.type}-${document.url}-${document.localUrl}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <FileText size={16} aria-hidden="true" />
                  <span>{documentLabel(document, copy.event.documentLabels)}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="empty-state">{copy.event.noDocuments}</p>
          )}
        </article>
      </section>

      <section className="page-section" id="players">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{copy.event.players}</p>
            <h2>{copy.event.playerList}</h2>
          </div>
        </div>
        {players.length ? (
          <ul className="data-list">
            {players.map((player) => (
              <li className="data-row" key={player._id}>
                <strong>{playerName(player)}</strong>
                <span>{player.club || copy.event.noClub}</span>
                <span>
                  {player.rating || copy.event.unrated} {player.rating ? copy.event.rating : ""}
                </span>
                <span>{copy.status[player.status] || player.status || copy.event.active}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">{copy.event.noPlayers}</p>
        )}
      </section>

      <section className="page-section" id="rounds">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{copy.event.rounds}</p>
            <h2>{copy.event.pairingsAndResults}</h2>
          </div>
        </div>
        {rounds.length ? (
          <div className="round-stack">
            {rounds.map((round) => (
              <article className="info-panel" key={round._id}>
                <div className="round-heading">
                  <div>
                    <p className="eyebrow">{copy.status[round.status] || round.status}</p>
                    <h2>{round.name || `${copy.event.round} ${round.number}`}</h2>
                  </div>
                  <span className="muted">{formatDateTime(round.startsAt, locale)}</span>
                </div>
                {(pairingsByRound[round._id] || []).length ? (
                  <ul className="data-list">
                    {(pairingsByRound[round._id] || []).map((pairing) => (
                      <li className="pairing-row" key={pairing._id}>
                        <span className="board-number">
                          {copy.event.board} {pairing.boardNumber}
                        </span>
                        <strong>{playerName(playerMap[pairing.whitePlayer], copy.event.notPaired)}</strong>
                        <span>{resultLabel(pairing.result, copy.result)}</span>
                        <strong>{playerName(playerMap[pairing.blackPlayer], copy.event.notPaired)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-state">{copy.event.noPairings}</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">{copy.event.noRounds}</p>
        )}
      </section>

      <section className="page-section" id="standings">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{copy.event.standings}</p>
            <h2>{copy.event.currentTable}</h2>
          </div>
        </div>
        {event.standings?.length ? (
          <ul className="data-list">
            {event.standings.map((row) => (
              <li className="data-row standings-row" key={row.playerId}>
                <strong>
                  {row.position}. {playerName(row.player, copy.event.notPaired)}
                </strong>
                <span>
                  {row.points} {copy.event.points}
                </span>
                <span>
                  {row.wins} {copy.event.wins}
                </span>
                {row.sourceTieBreaks?.length ? (
                  <span>
                    {copy.event.tieBreaks}: {row.sourceTieBreaks.join(" / ")}
                  </span>
                ) : null}
                {row.performanceRating ? (
                  <span>
                    {copy.event.performance}: {row.performanceRating}
                  </span>
                ) : null}
                <span>{row.scoreString || copy.event.noResults}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">{copy.event.noStandings}</p>
        )}
      </section>
    </main>
  );
}
