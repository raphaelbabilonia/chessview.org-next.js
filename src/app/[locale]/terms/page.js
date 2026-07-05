import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { pageSeoMetadata } from "@/lib/seo";

const updatedAt = "2026-07-03";

const sections = [
  {
    title: "Open source code",
    body:
      "The ChessView source code is licensed separately under AGPL-3.0-only. These terms govern the official hosted ChessView website, APIs, accounts, public data surfaces, and commercial features.",
  },
  {
    title: "Accounts and submitted content",
    body:
      "Users and organizers are responsible for their account activity and for having the rights needed to submit events, registrations, player information, links, documents, images, and other content.",
  },
  {
    title: "Data restrictions",
    body:
      "Unless ChessView gives written permission, you may not scrape, crawl, harvest, bulk export, mirror, resell, redistribute, train models on, or build a competing database from ChessView data.",
  },
  {
    title: "Brand restrictions",
    body:
      "The ChessView name, logo, domain, and brand assets are reserved. Forks and competing services must use their own name and brand assets unless written permission is granted.",
  },
  {
    title: "AI and recommendations",
    body:
      "AI-assisted search, recommendations, analytics, or tournament suggestions are informational tools. Always verify dates, rules, fees, eligibility, ratings, registration status, and venue details with the original organizer or source.",
  },
  {
    title: "Third-party sources",
    body:
      "ChessView may link to third-party organizers, federations, publishers, platforms, and documents. Third-party content remains controlled by its own owners and terms.",
  },
  {
    title: "No warranty",
    body:
      "The service is provided as is and as available, to the maximum extent permitted by law. Public event data can be incomplete, outdated, or corrected later.",
  },
];

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return pageSeoMetadata({
    locale,
    path: "/terms",
    title: "Terms of Service",
    description: "Terms for the official ChessView hosted service.",
  });
}

export default async function TermsPage({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <main className="page policy-page">
      <section className="page-header">
        <p className="eyebrow">Legal</p>
        <h1>Terms of Service</h1>
        <p>Last updated: {updatedAt}</p>
      </section>

      <section className="policy-content" aria-label="Terms of Service">
        <p>
          These terms are a baseline for the official ChessView hosted service and should be reviewed by a
          qualified lawyer before public commercial launch.
        </p>
        {sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
