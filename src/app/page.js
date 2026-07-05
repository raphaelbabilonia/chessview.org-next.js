import { LocaleRedirect } from "@/components/LocaleRedirect";
import { getDictionary } from "@/i18n/dictionaries";
import { pageSeoMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = pageSeoMetadata({
  locale: "en",
  path: "/",
  title: siteConfig.title,
  description: getDictionary("en").site.description,
  absoluteTitle: true,
});

export default function RootPage() {
  return <LocaleRedirect copy={getDictionary("en")} />;
}
