import { getEvents } from "@/lib/api";
import { absoluteUrl } from "@/lib/site";
import { countryHref, eventHref, sourceHref } from "@/lib/tournament";
import { locales, localePath } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function sitemap() {
  const now = new Date();
  const { data: events } = await getEvents();
  const countries = [...new Set(events.map((event) => event.country).filter(Boolean))];
  const sources = [...new Set(events.map((event) => event.source?.name).filter(Boolean))];

  return [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    ...locales.flatMap((locale) => [
      {
        url: absoluteUrl(localePath(locale)),
        lastModified: now,
        changeFrequency: "daily",
        priority: locale === "en" ? 1 : 0.9,
      },
      {
        url: absoluteUrl(localePath(locale, "/events")),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.9,
      },
      {
        url: absoluteUrl(localePath(locale, "/news")),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.85,
      },
      {
        url: absoluteUrl(localePath(locale, "/terms")),
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.35,
      },
      {
        url: absoluteUrl(localePath(locale, "/privacy")),
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.35,
      },
      ...countries.map((country) => ({
        url: absoluteUrl(localePath(locale, countryHref(country))),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.75,
      })),
      ...sources.map((source) => ({
        url: absoluteUrl(localePath(locale, sourceHref(source))),
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.75,
      })),
      ...events.map((event) => ({
        url: absoluteUrl(localePath(locale, eventHref(event))),
        lastModified: event.updatedAt || event.startDate || now,
        changeFrequency: event.status === "completed" ? "monthly" : "daily",
        priority: event.status === "completed" ? 0.6 : 0.8,
      })),
    ]),
  ];
}
