"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { defaultLocale, locales, localeNames } from "@/i18n/config";

export function LocaleRedirect({ copy }) {
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("chessview_locale");
    const locale = locales.includes(stored) ? stored : defaultLocale;
    router.replace(`/${locale}`);
  }, [router]);

  return (
    <main className="page locale-entry">
      <section className="info-panel">
        <p className="eyebrow">{copy.home.eyebrow}</p>
        <h1>{copy.home.title}</h1>
        <p>{copy.home.lead}</p>
        <div className="button-row">
          {locales.map((locale) => (
            <Link className="button button-ghost" href={`/${locale}`} key={locale}>
              {localeNames[locale]}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
