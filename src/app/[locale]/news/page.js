import { ExternalLink, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { NewsCard } from "@/components/NewsCard";
import { isLocale, languageAlternates, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getNewsItems } from "@/lib/news";
import { siteConfig } from "@/lib/site";

export const revalidate = 900;

const NEWS_FETCH_LIMIT = 100;
const NEWS_PAGE_SIZE = 12;
const newsFilterParamKeys = ["search", "source"];

const getParam = (params, key) => {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] || "" : value || "";
};

const getPage = (params) => {
  const page = Number(getParam(params, "page"));
  return Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
};

const buildPageHref = (locale, filters, page) => {
  const params = new URLSearchParams();
  newsFilterParamKeys.forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/${locale}/news${query ? `?${query}` : ""}`;
};

const renderTemplate = (template, values) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);

const getPageItems = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  if (currentPage <= 4) {
    [2, 3, 4, 5].forEach((page) => pages.add(page));
  }
  if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach((page) => pages.add(page));
  }

  const sortedPages = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  return sortedPages.reduce((items, page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push(`ellipsis-${page}`);
    }
    items.push(page);
    return items;
  }, []);
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const searchableTextFor = (item) =>
  [
    item.title,
    item.summary,
    item.description,
    item.sourceName,
    item.author,
    item.region,
    item.language,
    item.category,
    item.relatedTournamentName,
    ...(Array.isArray(item.relatedPlayerNames) ? item.relatedPlayerNames : []),
    ...(Array.isArray(item.tags) ? item.tags : []),
  ]
    .filter(Boolean)
    .join(" ");

const getSourcesFromItems = (items) =>
  Object.values(
    items.reduce((sources, item) => {
      const name = item.sourceName || "Unknown source";
      sources[name] ||= {
        name,
        url: item.sourceHomeUrl || item.sourceUrl || item.canonicalUrl || item.url || "",
        count: 0,
      };
      sources[name].count += 1;
      return sources;
    }, {})
  ).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

function PaginationNav({ copy, locale, linkFilters, meta }) {
  if (!meta?.pages || meta.pages <= 1) return null;

  const pageLabel = renderTemplate(copy.news.pageLabel, {
    page: meta.page,
    pages: meta.pages,
  });

  return (
    <nav className="pagination" aria-label={copy.news.pagination}>
      <p className="pagination-status">{pageLabel}</p>
      <div className="pagination-controls">
        {meta.hasPrev ? (
          <a className="pagination-action" href={buildPageHref(locale, linkFilters, meta.page - 1)} aria-label={copy.news.previous}>
            <span className="pagination-action-icon" aria-hidden="true">
              &lsaquo;
            </span>
            <span className="pagination-action-label">{copy.news.previous}</span>
          </a>
        ) : (
          <span className="pagination-action pagination-disabled" aria-disabled="true">
            <span className="pagination-action-icon" aria-hidden="true">
              &lsaquo;
            </span>
            <span className="pagination-action-label">{copy.news.previous}</span>
          </span>
        )}
        <div className="pagination-pages" aria-label={pageLabel}>
          {getPageItems(meta.page, meta.pages).map((item) =>
            typeof item === "number" ? (
              item === meta.page ? (
                <span className="pagination-page is-current" aria-current="page" key={item}>
                  {item}
                </span>
              ) : (
                <a className="pagination-page" href={buildPageHref(locale, linkFilters, item)} key={item}>
                  {item}
                </a>
              )
            ) : (
              <span className="pagination-page pagination-ellipsis" aria-hidden="true" key={item}>
                ...
              </span>
            )
          )}
        </div>
        {meta.hasNext ? (
          <a
            className="pagination-action pagination-action-primary"
            href={buildPageHref(locale, linkFilters, meta.page + 1)}
            aria-label={copy.news.next}
          >
            <span className="pagination-action-label">{copy.news.next}</span>
            <span className="pagination-action-icon" aria-hidden="true">
              &rsaquo;
            </span>
          </a>
        ) : (
          <span className="pagination-action pagination-disabled" aria-disabled="true">
            <span className="pagination-action-label">{copy.news.next}</span>
            <span className="pagination-action-icon" aria-hidden="true">
              &rsaquo;
            </span>
          </span>
        )}
      </div>
    </nav>
  );
}

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

export default async function NewsPage({ params, searchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const query = await searchParams;
  const page = getPage(query);
  const filters = {
    search: getParam(query, "search"),
    source: getParam(query, "source"),
  };
  const { data, error, meta } = await getNewsItems({
    ...filters,
    limit: NEWS_FETCH_LIMIT,
  });
  const allItems = Array.isArray(data) ? data : [];
  const sources = Array.isArray(meta?.sources) && meta.sources.length ? meta.sources : getSourcesFromItems(allItems);
  const searchNeedle = normalize(filters.search);
  const sourceNeedle = normalize(filters.source);
  const items = allItems.filter((item) => {
    const matchesSearch = !searchNeedle || normalize(searchableTextFor(item)).includes(searchNeedle);
    const matchesSource = !sourceNeedle || normalize(item.sourceName) === sourceNeedle;
    return matchesSearch && matchesSource;
  });
  const totalPages = Math.max(1, Math.ceil(items.length / NEWS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = items.slice((currentPage - 1) * NEWS_PAGE_SIZE, currentPage * NEWS_PAGE_SIZE);
  const paginationMeta = {
    page: currentPage,
    pages: totalPages,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
  const resultSummary = renderTemplate(copy.news.resultSummary, {
    count: pageItems.length,
    total: items.length,
  });
  const activeFilterCount = newsFilterParamKeys.filter((key) => filters[key]).length;
  const hasSelectedSource = sources.some((source) => source.name === filters.source);
  const newsJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: copy.news.title,
    url: `${siteConfig.url}/${locale}/news`,
    numberOfItems: pageItems.length,
    itemListElement: pageItems.map((item, index) => ({
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
      </section>

      <details className="filter-panel">
        <summary className="filter-panel-summary">
          <span>{copy.news.filters}</span>
          {activeFilterCount ? <span className="filter-panel-count">{activeFilterCount}</span> : null}
        </summary>
        <form className="filter-bar filter-bar-compact filter-panel-body" action={`/${locale}/news`}>
          <label>
            {copy.news.search}
            <input name="search" defaultValue={filters.search} placeholder={copy.news.searchPlaceholder} />
          </label>
          <label>
            {copy.news.source}
            <select name="source" defaultValue={filters.source}>
              <option value="">{copy.news.allSources}</option>
              {filters.source && !hasSelectedSource ? <option value={filters.source}>{filters.source}</option> : null}
              {sources.map((source) => (
                <option value={source.name} key={source.name}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            <Search size={18} aria-hidden="true" />
            {copy.news.apply}
          </button>
        </form>
      </details>

      {error ? <div className="state state-warning">{copy.news.apiError}</div> : null}
      {!error && pageItems.length === 0 ? <div className="state">{copy.news.empty}</div> : null}
      {pageItems.length ? (
        <>
          <div className="results-toolbar">
            <p>{resultSummary}</p>
          </div>
          <PaginationNav copy={copy} locale={locale} linkFilters={filters} meta={paginationMeta} />
          <section className="news-grid news-grid-large" aria-label={copy.news.latest}>
            {pageItems.map((item) => (
              <NewsCard copy={copy} item={item} key={item.id} locale={locale} />
            ))}
          </section>
          <PaginationNav copy={copy} locale={locale} linkFilters={filters} meta={paginationMeta} />
        </>
      ) : null}

      {sources.length ? (
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
      ) : null}
    </main>
  );
}
