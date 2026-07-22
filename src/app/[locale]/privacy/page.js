import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getPrivacyCopy } from "@/i18n/analytics";
import { pageSeoMetadata } from "@/lib/seo";

const updatedAt = "2026-07-22";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getPrivacyCopy(locale);

  return pageSeoMetadata({
    locale,
    path: "/privacy",
    title: copy.title,
    description: copy.intro,
  });
}

export default async function PrivacyPage({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getPrivacyCopy(locale);

  return (
    <main className="page policy-page">
      <section className="page-header">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.updated}: {updatedAt}</p>
      </section>

      <section className="policy-content" aria-label={copy.title}>
        <p>{copy.intro}</p>
        {copy.sections.map(([title, body]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
