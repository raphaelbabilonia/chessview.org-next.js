export const locales = ["en", "es", "it"];
export const defaultLocale = "en";

export const localeNames = {
  en: "English",
  es: "Español",
  it: "Italiano",
};

export const isLocale = (value) => locales.includes(value);

export const localePath = (locale, path = "/") => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${cleanPath === "/" ? "" : cleanPath}`;
};

export const pathWithoutLocale = (pathname = "/") => {
  const parts = pathname.split("/").filter(Boolean);
  if (isLocale(parts[0])) {
    return `/${parts.slice(1).join("/")}`;
  }
  return pathname || "/";
};

export const languageAlternates = (path = "/") =>
  Object.fromEntries(locales.map((locale) => [locale, localePath(locale, path)]));
