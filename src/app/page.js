import { LocaleRedirect } from "@/components/LocaleRedirect";
import { getDictionary } from "@/i18n/dictionaries";
import { siteConfig } from "@/lib/site";

export const metadata = {
  title: {
    absolute: siteConfig.name,
  },
  description: getDictionary("en").site.description,
};

export default function RootPage() {
  return <LocaleRedirect copy={getDictionary("en")} />;
}
