import { notFound } from "next/navigation";
import { CoverageExplorer } from "@/components/CoverageExplorer";
import { getAllUpcomingEvents } from "@/lib/api";
import { buildCountryCoverage } from "@/lib/coverage";
import { pageSeoMetadata } from "@/lib/seo";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const revalidate = 120;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getDictionary(locale);

  return pageSeoMetadata({
    locale,
    path: "/coverage",
    title: copy.coverage.title,
    description: copy.coverage.description,
  });
}

export default async function CoveragePage({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const { data: events, error } = await getAllUpcomingEvents();
  const coverage = buildCountryCoverage(Array.isArray(events) ? events : [], locale);

  return (
    <main className="page coverage-page">
      <section className="coverage-hero">
        <h1>{copy.coverage.title}</h1>
      </section>

      {error ? <div className="state state-warning">{copy.coverage.apiError}</div> : null}
      {!error && coverage.totalTournaments === 0 ? <div className="state">{copy.coverage.empty}</div> : null}
      {coverage.totalTournaments ? <CoverageExplorer copy={copy} coverage={coverage} locale={locale} /> : null}
    </main>
  );
}
