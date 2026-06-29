import { Search } from "lucide-react";
import { notFound } from "next/navigation";
import { EventCard } from "@/components/EventCard";
import { getEvents, todayIsoDate } from "@/lib/api";
import { isLocale, languageAlternates, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const EVENTS_PAGE_SIZE = 30;
const filterParamKeys = ["search", "city", "country", "source", "status", "from", "to"];

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
  filterParamKeys.forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/${locale}/events${query ? `?${query}` : ""}`;
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

function PaginationNav({ copy, locale, linkFilters, meta }) {
  if (!meta?.pages || meta.pages <= 1) return null;

  const pageLabel = renderTemplate(copy.events.pageLabel, {
    page: meta.page,
    pages: meta.pages,
  });

  return (
    <nav className="pagination" aria-label={copy.events.pagination}>
      <p className="pagination-status">{pageLabel}</p>
      <div className="pagination-controls">
        {meta.hasPrev ? (
          <a className="pagination-action" href={buildPageHref(locale, linkFilters, meta.page - 1)}>
            {copy.events.previous}
          </a>
        ) : (
          <span className="pagination-action pagination-disabled" aria-disabled="true">
            {copy.events.previous}
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
          <a className="pagination-action pagination-action-primary" href={buildPageHref(locale, linkFilters, meta.page + 1)}>
            {copy.events.next}
          </a>
        ) : (
          <span className="pagination-action pagination-disabled" aria-disabled="true">
            {copy.events.next}
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
    title: copy.events.title,
    description: copy.events.description,
    alternates: {
      canonical: localePath(locale, "/events"),
      languages: languageAlternates("/events"),
    },
    openGraph: {
      title: copy.events.title,
      description: copy.events.description,
      url: localePath(locale, "/events"),
    },
  };
}

export default async function EventsPage({ params, searchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const query = await searchParams;
  const defaultFrom = todayIsoDate();
  const requestedFrom = getParam(query, "from");
  const page = getPage(query);
  const filters = {
    search: getParam(query, "search"),
    city: getParam(query, "city"),
    country: getParam(query, "country"),
    source: getParam(query, "source"),
    status: getParam(query, "status"),
    from: requestedFrom || defaultFrom,
    to: getParam(query, "to"),
  };
  const requestFilters = {
    ...filters,
    from: requestedFrom,
    activeFrom: requestedFrom ? "" : defaultFrom,
    limit: EVENTS_PAGE_SIZE,
    page,
  };
  const activeFilters = Object.fromEntries(Object.entries(requestFilters).filter(([, value]) => value));
  const { data: events, error, meta } = await getEvents(activeFilters);
  const resultTotal = meta?.total ?? events.length;
  const resultSummary = renderTemplate(copy.events.resultSummary, {
    count: events.length,
    total: resultTotal,
  });
  const linkFilters = {
    ...filters,
    from: requestedFrom,
  };

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">{copy.events.eyebrow}</p>
        <h1>{copy.events.title}</h1>
      </section>

      <form className="filter-bar" action={`/${locale}/events`}>
        <label>
          {copy.events.search}
          <input name="search" defaultValue={filters.search} placeholder={copy.events.searchPlaceholder} />
        </label>
        <label>
          {copy.events.city}
          <input name="city" defaultValue={filters.city} />
        </label>
        <label>
          {copy.events.country}
          <input name="country" defaultValue={filters.country} placeholder={copy.events.countryPlaceholder} />
        </label>
        <label>
          {copy.events.source}
          <input name="source" defaultValue={filters.source} placeholder={copy.events.sourcePlaceholder} />
        </label>
        <label>
          {copy.events.status}
          <select name="status" defaultValue={filters.status}>
            <option value="">{copy.events.any}</option>
            <option value="published">{copy.events.published}</option>
            <option value="completed">{copy.events.completed}</option>
          </select>
        </label>
        <label>
          {copy.events.from}
          <input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label>
          {copy.events.to}
          <input type="date" name="to" defaultValue={filters.to} />
        </label>
        <button className="button" type="submit">
          <Search size={18} aria-hidden="true" />
          {copy.events.apply}
        </button>
      </form>

      {error ? <div className="state state-warning">{copy.events.apiError}</div> : null}
      {!error && events.length === 0 ? <div className="state">{copy.events.empty}</div> : null}
      {events.length ? (
        <>
          <div className="results-toolbar">
            <p>{resultSummary}</p>
          </div>
          <PaginationNav copy={copy} locale={locale} linkFilters={linkFilters} meta={meta} />
          <section className="event-grid" aria-label={copy.events.results}>
            {events.map((event) => (
              <EventCard copy={copy} event={event} key={event._id} locale={locale} />
            ))}
          </section>
          <PaginationNav copy={copy} locale={locale} linkFilters={linkFilters} meta={meta} />
        </>
      ) : null}
    </main>
  );
}
