import { locales, localePath } from "../i18n/config.js";
import { absoluteUrl } from "./site.js";
import { countryHref, eventHref, slugifySegment, sourceHref } from "./tournament.js";

export const MAX_SITEMAP_URLS = 5000;
export const MIN_UTILITY_EVENTS = 5;

const staticLocalizedPaths = [
  "/",
  "/events",
  "/maps",
  "/news",
  "/collaborate",
  "/collaborate/agents",
  "/terms",
  "/privacy",
];

const xmlEscape = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const stableTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const latestTimestamp = (items) =>
  items.reduce((latest, item) => {
    const timestamp = stableTimestamp(item.lastModified || item.updatedAt || item.startDate);
    return timestamp && (!latest || timestamp > latest) ? timestamp : latest;
  }, "");

const absoluteAlternates = (path) => ({
  ...Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(localePath(locale, path))])),
  "x-default": absoluteUrl(path),
});

const localizedEntry = (locale, path, lastModified = "") => ({
  url: absoluteUrl(localePath(locale, path)),
  alternates: absoluteAlternates(path),
  ...(lastModified ? { lastModified } : {}),
});

const chunk = (items, index) => items.slice(index * MAX_SITEMAP_URLS, (index + 1) * MAX_SITEMAP_URLS);

const chunkCount = (items) => Math.max(1, Math.ceil(items.length / MAX_SITEMAP_URLS));

export const eligibleSitemapEvents = (events = []) =>
  events.filter((event) => {
    if (event?.indexable !== true || !event.slug || !event.title) return false;
    if (!stableTimestamp(event.startDate) || !stableTimestamp(event.endDate)) return false;
    const location = String(event.city || event.country || "").trim();
    return Boolean(location);
  });

const utilityGroups = (events, valueFor, hrefFor) => {
  const groups = new Map();
  for (const event of events) {
    const label = String(valueFor(event) || "").trim();
    const key = slugifySegment(label);
    if (!key) continue;
    const current = groups.get(key) || { label, events: [] };
    current.events.push(event);
    groups.set(key, current);
  }

  return [...groups.values()]
    .filter((group) => group.events.length >= MIN_UTILITY_EVENTS)
    .map((group) => ({
      path: hrefFor(group.label),
      lastModified: latestTimestamp(group.events),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
};

export const coreSitemapEntries = (events = []) => {
  const eligible = eligibleSitemapEvents(events);
  const utilityPaths = [
    ...utilityGroups(eligible, (event) => event.country, countryHref),
    ...utilityGroups(eligible, (event) => event.source?.name, sourceHref),
  ];

  return [
    {
      url: absoluteUrl("/"),
      alternates: absoluteAlternates("/"),
    },
    ...locales.flatMap((locale) => [
      ...staticLocalizedPaths.map((path) => localizedEntry(locale, path)),
      ...utilityPaths.map(({ path, lastModified }) => localizedEntry(locale, path, lastModified)),
    ]),
  ];
};

const eventEntries = (events, locale, page) =>
  chunk(eligibleSitemapEvents(events), page).map((event) =>
    localizedEntry(locale, eventHref(event), stableTimestamp(event.updatedAt || event.startDate))
  );

export const sitemapDescriptors = (events = []) => {
  const eligible = eligibleSitemapEvents(events);
  const coreEntries = coreSitemapEntries(eligible);
  const descriptors = [];

  for (let page = 0; page < chunkCount(coreEntries); page += 1) {
    const entries = chunk(coreEntries, page);
    descriptors.push({ id: `core-${page}`, lastModified: latestTimestamp(entries) });
  }

  for (const locale of locales) {
    if (!eligible.length) continue;
    for (let page = 0; page < chunkCount(eligible); page += 1) {
      descriptors.push({
        id: `events-${locale}-${page}`,
        lastModified: latestTimestamp(chunk(eligible, page)),
      });
    }
  }

  return descriptors;
};

export const sitemapEntriesForId = (events = [], rawId = "") => {
  const id = String(rawId || "").replace(/\.xml$/i, "");
  const coreMatch = id.match(/^core-(\d+)$/);
  if (coreMatch) return chunk(coreSitemapEntries(events), Number(coreMatch[1]));

  const eventMatch = id.match(/^events-(en|es|it)-(\d+)$/);
  if (!eventMatch) return [];
  return eventEntries(events, eventMatch[1], Number(eventMatch[2]));
};

export const renderSitemapIndex = (descriptors = []) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
  descriptors
    .map(
      (descriptor) =>
        `<sitemap><loc>${xmlEscape(absoluteUrl(`/sitemaps/${descriptor.id}.xml`))}</loc>` +
        `${descriptor.lastModified ? `<lastmod>${xmlEscape(descriptor.lastModified)}</lastmod>` : ""}</sitemap>`
    )
    .join("") +
  `</sitemapindex>`;

export const renderUrlSitemap = (entries = []) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">` +
  entries
    .map((entry) => {
      const alternates = Object.entries(entry.alternates || {})
        .map(
          ([language, href]) =>
            `<xhtml:link rel="alternate" hreflang="${xmlEscape(language)}" href="${xmlEscape(href)}"/>`
        )
        .join("");
      return (
        `<url><loc>${xmlEscape(entry.url)}</loc>${alternates}` +
        `${entry.lastModified ? `<lastmod>${xmlEscape(entry.lastModified)}</lastmod>` : ""}</url>`
      );
    })
    .join("") +
  `</urlset>`;
