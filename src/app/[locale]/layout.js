import { notFound } from "next/navigation";
import { LocalePersist } from "@/components/LocalePersist";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { defaultLocale, isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getAnalyticsCopy } from "@/i18n/analytics";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }) {
  const { locale = defaultLocale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const analyticsCopy = getAnalyticsCopy(locale);

  return (
    <>
      <LocalePersist locale={locale} />
      <SiteHeader copy={copy} locale={locale} />
      {children}
      <SiteFooter analyticsCopy={analyticsCopy} copy={copy} locale={locale} />
    </>
  );
}
