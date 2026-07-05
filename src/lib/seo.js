import { defaultLocale, languageAlternates, locales, localePath } from "@/i18n/config";
import { absoluteUrl, siteConfig } from "@/lib/site";

const openGraphLocales = {
  en: "en_US",
  es: "es_ES",
  it: "it_IT",
};

const verificationValue = (name) => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
};

const definedObject = (entries) => Object.fromEntries(entries.filter(([, value]) => value));

export const crawlerRobots = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    noimageindex: false,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

export const defaultOpenGraphImage = {
  url: siteConfig.ogImage.path,
  width: 1200,
  height: 630,
  alt: siteConfig.ogImage.alt,
};

export const searchEngineVerification = () => {
  const other = definedObject([
    ["msvalidate.01", verificationValue("BING_SITE_VERIFICATION")],
    ["p:domain_verify", verificationValue("PINTEREST_SITE_VERIFICATION")],
  ]);
  return definedObject([
    ["google", verificationValue("GOOGLE_SITE_VERIFICATION")],
    ["yandex", verificationValue("YANDEX_SITE_VERIFICATION")],
    ["yahoo", verificationValue("YAHOO_SITE_VERIFICATION")],
    ["other", Object.keys(other).length ? other : undefined],
  ]);
};

export const absoluteLanguageAlternates = (path = "/") => ({
  ...Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(localePath(locale, path))])),
  "x-default": absoluteUrl(path.startsWith("/") ? path : `/${path}`),
});

export const pageSeoMetadata = ({
  locale = defaultLocale,
  path = "/",
  title = siteConfig.title,
  description = siteConfig.description,
  absoluteTitle = false,
  type = "website",
} = {}) => {
  const url = localePath(locale, path);
  const alternateLocale = locales
    .filter((entry) => entry !== locale)
    .map((entry) => openGraphLocales[entry])
    .filter(Boolean);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(path),
    },
    openGraph: {
      type,
      siteName: siteConfig.name,
      title,
      description,
      url,
      locale: openGraphLocales[locale],
      alternateLocale,
      images: [defaultOpenGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [defaultOpenGraphImage],
    },
    robots: crawlerRobots,
  };
};

export const siteJsonLd = (locale = defaultLocale, description = siteConfig.description) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: "ChessView.org",
      url: siteConfig.url,
      logo: absoluteUrl("/brand/chessview-icon-circle-social.svg"),
      sameAs: siteConfig.repositories.map((repository) => repository.url),
    },
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      name: siteConfig.name,
      alternateName: ["ChessView.org", "Chess View"],
      url: siteConfig.url,
      description,
      inLanguage: locale,
      publisher: {
        "@id": `${siteConfig.url}/#organization`,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteConfig.url}/${locale}/events?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${siteConfig.url}/#webapp`,
      name: siteConfig.name,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      url: `${siteConfig.url}/${locale}`,
      description,
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      about: {
        "@type": "Thing",
        name: "Chess tournaments and chess news",
      },
    },
  ],
});
