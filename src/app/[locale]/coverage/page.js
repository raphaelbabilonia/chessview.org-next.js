import { notFound } from "next/navigation";
import { CoverageExplorer } from "@/components/CoverageExplorer";
import { getUpcomingEvents } from "@/lib/api";
import { buildCountryCoverage } from "@/lib/coverage";
import { isLocale, languageAlternates, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const revalidate = 120;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getDictionary(locale);

  return {
    title: copy.coverage.title,
    description: copy.coverage.description,
    alternates: {
      canonical: localePath(locale, "/coverage"),
      languages: languageAlternates("/coverage"),
    },
    openGraph: {
      title: copy.coverage.title,
      description: copy.coverage.description,
      url: localePath(locale, "/coverage"),
    },
  };
}

export default async function CoveragePage({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const { data: events, error } = await getUpcomingEvents();
  const coverage = buildCountryCoverage(Array.isArray(events) ? events : [], locale);

  return (
    <main className="page coverage-page">
      <section className="coverage-hero">
        <div className="coverage-hero-copy">
          <p className="eyebrow">{copy.coverage.eyebrow}</p>
          <h1>{copy.coverage.title}</h1>
          <p>{copy.coverage.description}</p>
        </div>
        <div className="coverage-stat-strip" aria-label={copy.coverage.activeCountries}>
          <span>
            <strong>{coverage.totalCountries}</strong>
            {copy.coverage.activeCountries}
          </span>
          <span>
            <strong>{coverage.totalTournaments}</strong>
            {copy.coverage.tournaments}
          </span>
          <span>
            <strong>{coverage.totalLive}</strong>
            {copy.coverage.liveNow}
          </span>
          <span>
            <strong>{coverage.totalUpcoming}</strong>
            {copy.coverage.upcoming}
          </span>
        </div>
      </section>

      {error ? <div className="state state-warning">{copy.coverage.apiError}</div> : null}
      {!error && coverage.totalTournaments === 0 ? <div className="state">{copy.coverage.empty}</div> : null}
      {coverage.totalTournaments ? <CoverageExplorer copy={copy} coverage={coverage} locale={locale} /> : null}
    </main>
  );
}
