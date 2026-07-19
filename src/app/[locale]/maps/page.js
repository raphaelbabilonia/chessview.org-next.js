import { notFound } from "next/navigation";
import { MapsExplorer } from "@/components/MapsExplorer";
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
    path: "/maps",
    title: copy.coverage.seoTitle,
    description: copy.coverage.description,
  });
}

export default async function MapsPage({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const { data: events, error } = await getAllUpcomingEvents();
  const coverage = buildCountryCoverage(Array.isArray(events) ? events : [], locale);

  return (
    <main className="page maps-page">
      <section className="maps-hero">
        <p className="eyebrow">{copy.coverage.eyebrow}</p>
        <h1>{copy.coverage.title}</h1>
        <p>{copy.coverage.description}</p>
      </section>

      {error ? <div className="state state-warning">{copy.coverage.apiError}</div> : null}
      {!error && coverage.totalTournaments === 0 ? <div className="state">{copy.coverage.empty}</div> : null}
      {coverage.totalTournaments ? <MapsExplorer copy={copy} coverage={coverage} locale={locale} /> : null}
    </main>
  );
}
