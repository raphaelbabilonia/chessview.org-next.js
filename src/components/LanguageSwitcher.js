"use client";

import { Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { locales, localeNames, pathWithoutLocale } from "@/i18n/config";
import { trackAnalyticsEvent } from "@/lib/tracking";

const storageKey = "chessview_locale";
const cookieName = "chessview_locale";

export function LanguageSwitcher({ label, locale }) {
  const pathname = usePathname();
  const router = useRouter();

  const changeLocale = (nextLocale) => {
    const cleanPath = pathWithoutLocale(pathname || "/");
    const query = window.location.search.replace(/^\?/, "");
    const nextPath = `/${nextLocale}${cleanPath === "/" ? "" : cleanPath}${query ? `?${query}` : ""}`;

    localStorage.setItem(storageKey, nextLocale);
    document.cookie = `${cookieName}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = nextLocale;
    trackAnalyticsEvent("language_change", {
      metadata: { from: locale, to: nextLocale },
    });
    router.push(nextPath);
  };

  return (
    <label className="language-switcher">
      <span className="sr-only">{label}</span>
      <Languages className="language-switcher-icon" size={18} aria-hidden="true" />
      <span className="language-switcher-current" aria-hidden="true">
        {locale.toUpperCase()}
      </span>
      <select
        aria-label={label}
        value={locale}
        onChange={(event) => changeLocale(event.target.value)}
      >
        {locales.map((item) => (
          <option key={item} value={item}>
            {localeNames[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
