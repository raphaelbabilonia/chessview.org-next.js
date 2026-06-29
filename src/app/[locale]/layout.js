import { notFound } from "next/navigation";
import { LocalePersist } from "@/components/LocalePersist";
import { SiteHeader } from "@/components/SiteHeader";
import { defaultLocale, isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }) {
  const { locale = defaultLocale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);

  return (
    <>
      <LocalePersist locale={locale} />
      <SiteHeader copy={copy} locale={locale} />
      {children}
    </>
  );
}
