import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { NewsCard } from "@/components/NewsCard";
import { isLocale, languageAlternates, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getNewsItems, getNewsSources } from "@/lib/news";
import { siteConfig } from "@/lib/site";

export const revalidate = 900;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getDictionary(locale);

  return {
    title: copy.news.title,
    description: copy.news.description,
    alternates: {
      canonical: localePath(locale, "/news"),
      languages: languageAlternates("/news"),
    },
    openGraph: {
      title: copy.news.title,
      description: copy.news.description,
      url: localePath(locale, "/news"),
    },
  };
}

export default async function NewsPage({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const items = getNewsItems();
  const sources = getNewsSources();
  const newsJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: copy.news.title,
    url: `${siteConfig.url}/${locale}/news`,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.url,
      name: item.title,
    })),
  };

  return (
    <main className="page">
      <JsonLd data={newsJsonLd} id={`news-jsonld-${locale}`} />
      <section className="page-header news-page-header">
        <p className="eyebrow">{copy.news.eyebrow}</p>
        <h1>{copy.news.title}</h1>
        <p>{copy.news.description}</p>
      </section>

      <section className="source-strip" aria-label={copy.news.sources}>
        <p>{copy.news.sources}</p>
        <div>
          {sources.map((source) => (
            <a href={source.url} key={source.name} rel="noreferrer" target="_blank">
              {source.name}
              <span>{source.count}</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <section className="news-grid news-grid-large" aria-label={copy.news.latest}>
        {items.map((item) => (
          <NewsCard copy={copy} item={item} key={item.id} locale={locale} />
        ))}
      </section>
    </main>
  );
}
