import { LocaleRedirect } from "@/components/LocaleRedirect";
import { getDictionary } from "@/i18n/dictionaries";

export const metadata = {
  title: {
    absolute: "Chess View",
  },
  description: getDictionary("en").site.description,
};

export default function RootPage() {
  return <LocaleRedirect copy={getDictionary("en")} />;
}
