import { getEvents } from "@/lib/api";
import { absoluteUrl } from "@/lib/site";
import { absoluteLanguageAlternates } from "@/lib/seo";
import { countryHref, eventHref, sourceHref } from "@/lib/tournament";
import { locales, localePath } from "@/i18n/config";

export const dynamic = "force-dynamic";

const coreImage = absoluteUrl("/opengraph-image");

const rootEntry = (now) => ({
  url: absoluteUrl("/"),
  lastModified: now,
  changeFrequency: "daily",
  priority: 1,
  alternates: {
    languages: absoluteLanguageAlternates("/"),
  },
  images: [coreImage],
});

const localizedEntry = (locale, path, options = {}) => ({
  url: absoluteUrl(localePath(locale, path)),
  alternates: {
    languages: absoluteLanguageAlternates(path),
  },
  ...options,
});

export default async function sitemap() {
  const now = new Date();
  const { data: events } = await getEvents();
  const countries = [...new Set(events.map((event) => event.country).filter(Boolean))];
  const sources = [...new Set(events.map((event) => event.source?.name).filter(Boolean))];

  return [
    rootEntry(now),
    ...locales.flatMap((locale) => [
      localizedEntry(locale, "/", {
        lastModified: now,
        changeFrequency: "daily",
        priority: locale === "en" ? 1 : 0.9,
        images: [coreImage],
      }),
      localizedEntry(locale, "/events", {
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.9,
        images: [coreImage],
      }),
      localizedEntry(locale, "/maps", {
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.85,
        images: [coreImage],
      }),
      localizedEntry(locale, "/news", {
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.85,
        images: [coreImage],
      }),
      localizedEntry(locale, "/collaborate", {
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
        images: [coreImage],
      }),
      localizedEntry(locale, "/collaborate/agents", {
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.65,
        images: [coreImage],
      }),
      localizedEntry(locale, "/terms", {
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.35,
      }),
      localizedEntry(locale, "/privacy", {
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.35,
      }),
      ...countries.map((country) => localizedEntry(locale, countryHref(country), {
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.75,
      })),
      ...sources.map((source) => localizedEntry(locale, sourceHref(source), {
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.75,
      })),
      ...events.map((event) => localizedEntry(locale, eventHref(event), {
        lastModified: event.updatedAt || event.startDate || now,
        changeFrequency: event.status === "completed" ? "monthly" : "daily",
        priority: event.status === "completed" ? 0.6 : 0.8,
      })),
    ]),
  ];
}
