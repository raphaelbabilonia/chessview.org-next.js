import { Clock, Database, ExternalLink, FileText, MapPin } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { backendAssetUrl, getEvent } from "@/lib/api";
import { compactDescription, formatCardDateRange, formatCountryName, formatDateRange, formatTimeControl } from "@/lib/format";
import { pageSeoMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { localizedEventHref } from "@/lib/tournament";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const eventStatusUrl = (status) =>
  ({
    completed: "https://schema.org/EventCompleted",
    cancelled: "https://schema.org/EventCancelled",
  })[status] || "https://schema.org/EventScheduled";

const eventPath = (event) => `/events/${event.slug || event._id}`;

const documentHref = (document) => backendAssetUrl(document.localUrl || document.url);

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

const uniqueValues = (values) => {
  const seen = new Set();
  return values.reduce((result, value) => {
    const clean = String(value || "").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return result;
    seen.add(key);
    result.push(clean);
    return result;
  }, []);
};

const firstExternalLink = (event, type) => (event.externalLinks || []).find((link) => link.url && link.type === type);

const originalSiteLink = (event, copy) => {
  const websiteLink = firstExternalLink(event, "website");
  const sourceLink = firstExternalLink(event, "source");
  const fallbackLink = (event.externalLinks || []).find((link) => link.url);
  const href = event.websiteUrl || websiteLink?.url || event.source?.url || sourceLink?.url || fallbackLink?.url || "";
  if (!href) return null;

  return {
    href,
    label: event.websiteUrl || websiteLink?.url ? copy.event.officialWebsite : copy.event.originalSource,
  };
};

const pdfPattern = /\.pdf(?:$|[?#])/i;
const announcementPattern = /regulation|regulations|regolamento|bando|announcement|brochure|prospectus|invitation|circular|rules|convocatoria|bases/i;

const isPdfDocument = (document) =>
  document?.type === "pdf" || /pdf/i.test(document?.mimeType || "") || pdfPattern.test(document?.localUrl || document?.url || "");

const isAnnouncementDocument = (document) =>
  document?.type === "regulations" || announcementPattern.test(`${document?.label || ""} ${document?.url || ""}`);

const noisyImportedDescriptionPattern = /\b(pairing:|scoring:|swiss_|gacrux|inperson|online)\b/i;

const isMetadataOnlyDescription = (value, event) => {
  const text = String(value || "").trim();
  if (!text) return true;
  if (noisyImportedDescriptionPattern.test(text)) return true;

  const knownLocationParts = uniqueValues([event.city, event.country, event.venueName, event.address]).map((part) =>
    part.toLowerCase()
  );
  const parts = text.split(/\s*[-–|,]\s*/).filter(Boolean);
  if (parts.length < 2) return false;

  return parts.every((part) => {
    const normalized = part.toLowerCase();
    return /^(?:\d+\s+rounds?|standard|classical|rapid|blitz|hybrid)$/.test(normalized) || knownLocationParts.includes(normalized);
  });
};

const announcementDocumentFor = (event, copy) => {
  const importedDocument = (event.documents || []).find(
    (document) => document.url && isPdfDocument(document) && isAnnouncementDocument(document)
  );
  if (importedDocument) return importedDocument;
  if (event.regulationsUrl && pdfPattern.test(event.regulationsUrl)) {
    return {
      label: copy.event.announcement,
      type: "pdf",
      url: event.regulationsUrl,
      localUrl: "",
    };
  }
  return null;
};

const isPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

const hasObjectData = (value) => isPlainObject(value) && Object.keys(value).length > 0;

const hasArrayData = (value) => Array.isArray(value) && value.length > 0;

const titleFromKey = (key) =>
  String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const metadataValue = (value, copy) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? copy.event.yes : copy.event.no;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => metadataValue(item, copy)).filter(Boolean).join("; ");
  }
  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([key, entryValue]) => {
        const formatted = metadataValue(entryValue, copy);
        return formatted ? `${titleFromKey(key)}: ${formatted}` : "";
      })
      .filter(Boolean)
      .join(" | ");
  }
  return "";
};

const entriesFromObject = (value, copy) =>
  Object.entries(value || {})
    .map(([key, entryValue]) => ({
      label: titleFromKey(key),
      value: metadataValue(entryValue, copy),
    }))
    .filter((entry) => entry.value);

const metadataGroupsFor = (metadata, copy) => {
  if (!hasObjectData(metadata)) return [];
  return [
    { title: copy.event.metadataFormat, entries: entriesFromObject(metadata.format, copy) },
    { title: copy.event.metadataRegistration, entries: entriesFromObject(metadata.registration, copy) },
    { title: copy.event.metadataLogistics, entries: entriesFromObject(metadata.logistics, copy) },
    { title: copy.event.metadataSchedule, entries: (metadata.schedule || []).map((item, index) => ({ label: item.label || `${copy.event.round} ${index + 1}`, value: metadataValue(item, copy) })) },
    { title: copy.event.metadataPrizes, entries: entriesFromObject(metadata.prizes, copy) },
    { title: copy.event.metadataPlayerField, entries: entriesFromObject(metadata.playerField, copy) },
    {
      title: copy.event.metadataHistorical,
      entries: (metadata.historicalEditions || []).map((item, index) => ({
        label: item.editionName || item.year || `${copy.event.metadataEdition} ${index + 1}`,
        value: metadataValue(item, copy),
      })),
    },
    { title: copy.event.metadataSourceAudit, entries: entriesFromObject(metadata.sourceAudit, copy) },
    {
      title: copy.event.metadataExtraFacts,
      entries: (metadata.extraFacts || []).map((item, index) => ({
        label: item.label || `${copy.event.metadataFact} ${index + 1}`,
        value: metadataValue(item.value ?? item, copy),
      })),
    },
  ].filter((group) => group.entries.length);
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

  return pageSeoMetadata({
    locale,
    path,
    title: event.title,
    description,
    type: "article",
  });
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

  const importedDescription = compactDescription(event.description, copy.event.detailsFallback, {
    maxLength: 320,
    title: event.title,
  });
  const description = isMetadataOnlyDescription(importedDescription, event) ? "" : importedDescription;
  const schemaDescription = description || `${event.title} - ${formatDateRange(event.startDate, event.endDate, locale)}`;
  const displayDate = formatCardDateRange(event.startDate, event.endDate, locale);
  const locationBase = uniqueLocationParts([event.venueName, event.address]).join(", ");
  const location = uniqueLocationParts([
    locationBase,
    includesLocationPart(locationBase, event.city) ? "" : event.city,
  ]).join(", ");
  const organizerName = event.sourceOrganizerName || event.organizer?.name || "";
  const contactText = [event.contactEmail, event.contactPhone].filter(Boolean).join(" / ");
  const displayCountry = formatCountryName(event.country, locale);
  const country = includesLocationPart(location, event.country) || includesLocationPart(location, displayCountry) ? "" : displayCountry;
  const fullLocation = [location, country].filter(Boolean).join(", ") || copy.event.tba;
  const timeControl = formatTimeControl(event.timeControl, locale, copy.event.timeControlTba);
  const sectionNames = uniqueValues((event.sections || []).map((section) => section.name)).join(", ");
  const primaryLink = originalSiteLink(event, copy);
  const announcementDocument = announcementDocumentFor(event, copy);
  const announcementHref = announcementDocument ? documentHref(announcementDocument) : "";
  const sourceName = event.source?.name || primaryLink?.label || copy.event.tba;
  const metadata = isPlainObject(event.metadata) ? event.metadata : {};
  const metadataGroups = metadataGroupsFor(metadata, copy);
  const hasAdvancedMetadata = Boolean(metadata.summary || metadataGroups.length);
  const schema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: event.title,
    description: schemaDescription,
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
        <time className="event-detail-date" dateTime={event.startDate} title={displayDate.accessible}>
          <span className="event-card-date-primary">{displayDate.primary}</span>
          {displayDate.secondary ? <span className="event-card-date-secondary">{displayDate.secondary}</span> : null}
        </time>
        <div className="event-detail-intro">
          <p className="eyebrow">{copy.event.overview}</p>
          <h1>{event.title}</h1>
          <div className="event-header-meta">
            <span>
              <MapPin size={16} aria-hidden="true" />
              {fullLocation}
            </span>
            <span>
              <Clock size={16} aria-hidden="true" />
              {timeControl}
            </span>
          </div>
          {description ? <p className="event-detail-lead">{description}</p> : null}
          <div className="event-detail-actions">
            {primaryLink ? (
              <a
                className="button"
                data-tracking-entity-id={event._id}
                data-tracking-entity-slug={event.slug}
                data-tracking-entity-title={event.title}
                data-tracking-entity-type="event"
                data-tracking-event="event_original_click"
                data-tracking-outbound-url={primaryLink.href}
                data-tracking-placement="event_detail_header"
                href={primaryLink.href}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={18} aria-hidden="true" />
                {copy.event.goToOriginalSite}
              </a>
            ) : null}
            {announcementDocument ? (
              <a
                className="button button-ghost"
                data-tracking-entity-id={event._id}
                data-tracking-entity-slug={event.slug}
                data-tracking-entity-title={event.title}
                data-tracking-entity-type="event"
                data-tracking-event="event_announcement_open"
                data-tracking-outbound-url={announcementHref}
                data-tracking-placement="event_detail_header"
                href={announcementHref}
                rel="noreferrer"
                target="_blank"
              >
                <FileText size={18} aria-hidden="true" />
                {copy.event.openAnnouncement}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="event-overview-grid" id="overview">
        <article className="info-panel">
          <h2>{copy.event.tournamentInfo}</h2>
          <dl className="detail-list">
            <div>
              <dt>{copy.event.dates}</dt>
              <dd>{formatDateRange(event.startDate, event.endDate, locale)}</dd>
            </div>
            <div>
              <dt>{copy.event.location}</dt>
              <dd>{fullLocation}</dd>
            </div>
            <div>
              <dt>{copy.event.timeControl}</dt>
              <dd>{timeControl}</dd>
            </div>
            <div>
              <dt>{copy.event.organizer}</dt>
              <dd>{organizerName || copy.event.tba}</dd>
            </div>
            <div>
              <dt>{copy.event.contact}</dt>
              <dd>{contactText || copy.event.tba}</dd>
            </div>
            {sectionNames ? (
              <div>
                <dt>{copy.event.sections}</dt>
                <dd>{sectionNames}</dd>
              </div>
            ) : null}
          </dl>
        </article>

        <aside className="info-panel registration-panel">
          <h2>{copy.event.registrationCtaTitle}</h2>
          <p>{copy.event.registrationCtaBody}</p>
          <dl className="detail-list">
            <div>
              <dt>{copy.event.sourceName}</dt>
              <dd>{sourceName}</dd>
            </div>
          </dl>
          <div className="link-list">
            {primaryLink ? (
              <a
                data-tracking-entity-id={event._id}
                data-tracking-entity-slug={event.slug}
                data-tracking-entity-title={event.title}
                data-tracking-entity-type="event"
                data-tracking-event="event_original_click"
                data-tracking-outbound-url={primaryLink.href}
                data-tracking-placement="event_registration_panel"
                href={primaryLink.href}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={16} aria-hidden="true" />
                {copy.event.goToOriginalSite}
              </a>
            ) : (
              <span className="muted">{copy.event.noOriginalSite}</span>
            )}
          </div>
        </aside>

        {announcementDocument ? (
          <article className="info-panel announcement-panel" id="documents">
            <h2>{copy.event.announcement}</h2>
            <p>{copy.event.announcementBody}</p>
            <div className="link-list document-list">
              <a
                data-tracking-entity-id={event._id}
                data-tracking-entity-slug={event.slug}
                data-tracking-entity-title={event.title}
                data-tracking-entity-type="event"
                data-tracking-event="event_announcement_open"
                data-tracking-outbound-url={announcementHref}
                data-tracking-placement="event_document_panel"
                href={announcementHref}
                rel="noreferrer"
                target="_blank"
              >
                <FileText size={16} aria-hidden="true" />
                <span>{copy.event.openAnnouncement}</span>
              </a>
            </div>
          </article>
        ) : null}

        {hasAdvancedMetadata ? (
          <details className="info-panel metadata-panel" id="metadata">
            <summary>
              <span>
                <Database size={18} aria-hidden="true" />
                {copy.event.metadataToggle}
              </span>
              <span>{metadata.enrichmentStatus || copy.event.metadataStatusPartial}</span>
            </summary>
            {metadata.summary ? <p>{metadata.summary}</p> : <p>{copy.event.metadataIntro}</p>}
            <div className="metadata-grid">
              {metadataGroups.map((group) => (
                <section className="metadata-group" key={group.title}>
                  <h3>{group.title}</h3>
                  <dl className="detail-list">
                    {group.entries.map((entry) => (
                      <div key={`${group.title}-${entry.label}`}>
                        <dt>{entry.label}</dt>
                        <dd>{entry.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </details>
        ) : null}
      </section>
    </main>
  );
}
