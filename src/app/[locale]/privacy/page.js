import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { pageSeoMetadata } from "@/lib/seo";

const updatedAt = "2026-07-05";

const sections = [
  {
    title: "Information ChessView may collect",
    body:
      "ChessView may collect account information, organizer and event information, registrations, player records, public agent submissions, technical logs, support messages, search interactions, analytics events, and AI query data.",
  },
  {
    title: "How information is used",
    body:
      "ChessView uses information to provide accounts, event management, registrations, public pages, search, discovery, safety, security, product analytics, recommendations, AI-assisted features, support, and legal compliance.",
  },
  {
    title: "Public event information",
    body:
      "Some tournament, player, pairing, standings, and result data may be displayed publicly when submitted by organizers or collected from public sources. Organizers are responsible for the rights and legal basis needed to submit personal data.",
  },
  {
    title: "AI and analytics",
    body:
      "ChessView may use service data to build search indexes, analytics, recommendations, and AI-assisted features. Private personal data should be minimized and protected.",
  },
  {
    title: "First-party website tracking",
    body:
      "ChessView may collect first-party website analytics such as visited pages, event detail views, filter usage, outbound source clicks, referrer domain, UTM tags, device/browser class, language/theme changes, and coarse country headers. Browser visitor and session identifiers are generated for analytics continuity and hashed before storage by the ChessView API. Raw search text is minimized before storage.",
  },
  {
    title: "Sharing",
    body:
      "ChessView may share information with service providers, public visitors when information is part of a public page, organizers when needed for event administration, and legal authorities when required by law.",
  },
  {
    title: "Cookies and local storage",
    body:
      "ChessView may use cookies or local storage for language preference, theme preference, first-party analytics, authentication, security, and service operation.",
  },
  {
    title: "Your rights",
    body:
      "Depending on your location, you may have rights to access, correct, delete, export, restrict, or object to processing of personal data. Contact the ChessView project owner to exercise privacy rights.",
  },
];

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return pageSeoMetadata({
    locale,
    path: "/privacy",
    title: "Privacy Policy",
    description: "Privacy baseline for the official ChessView hosted service.",
  });
}

export default async function PrivacyPage({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <main className="page policy-page">
      <section className="page-header">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p>Last updated: {updatedAt}</p>
      </section>

      <section className="policy-content" aria-label="Privacy Policy">
        <p>
          This policy is a baseline for the official ChessView hosted service. It should be reviewed by a qualified
          lawyer before public commercial launch, especially before processing EU/EEA personal data or data about
          minors.
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
