const dateLocales = {
  en: "en",
  es: "es",
  it: "it-IT",
};

const rangeSeparators = {
  en: "to",
  es: "a",
  it: "al",
};

const countryLabels = {
  China: {
    it: "Cina",
  },
  Global: {
    it: "Globale",
  },
  Poland: {
    es: "Polonia",
    it: "Polonia",
  },
  Spain: {
    es: "Espa\u00f1a",
    it: "Spagna",
  },
  "United States": {
    es: "Estados Unidos",
    it: "Stati Uniti",
  },
};

export const formatCountryName = (country, locale = "en") => countryLabels[country]?.[locale] || country;

const timeControlLabels = {
  blitz: {
    en: "Blitz",
    es: "Blitz",
    it: "Blitz",
  },
  rapid: {
    en: "Rapid",
    es: "R\u00e1pido",
    it: "Rapid",
  },
  standard: {
    en: "Classical",
    es: "Cl\u00e1sico",
    it: "Classico",
  },
};

export const formatTimeControl = (value, locale = "en", fallback = "") => {
  const key = String(value || "").toLowerCase();
  if (!key) return fallback;
  return timeControlLabels[key]?.[locale] || value;
};

export const formatDate = (value, locale = "en") => {
  if (!value) return "TBA";
  return new Intl.DateTimeFormat(dateLocales[locale] || dateLocales.en, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
};

export const formatDateTime = (value, locale = "en") => {
  if (!value) return "TBA";
  return new Intl.DateTimeFormat(dateLocales[locale] || dateLocales.en, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const formatDateRange = (start, end, locale = "en") => {
  const startLabel = formatDate(start, locale);
  const endLabel = formatDate(end, locale);
  return startLabel === endLabel ? startLabel : `${startLabel} ${rangeSeparators[locale] || "to"} ${endLabel}`;
};

const validDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatCardDateRange = (start, end, locale = "en") => {
  const startDate = validDate(start);
  const endDate = validDate(end) || startDate;
  if (!startDate) return { primary: "TBA", secondary: "", accessible: "TBA" };

  const formatter = new Intl.DateTimeFormat(dateLocales[locale] || dateLocales.en, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });
  const isRange = endDate && startDate.getTime() !== endDate.getTime();
  const accessible =
    isRange && typeof formatter.formatRange === "function"
      ? formatter.formatRange(startDate, endDate)
      : formatter.format(startDate);

  if (typeof formatter.formatRangeToParts !== "function" && isRange) {
    return { primary: accessible, secondary: "", accessible };
  }

  const parts = isRange
    ? formatter.formatRangeToParts(startDate, endDate)
    : formatter.formatToParts(startDate).map((part) => ({ ...part, source: "shared" }));
  const years = [...new Set(parts.filter((part) => part.type === "year").map((part) => part.value))];
  const primary = parts
    .filter((part) => part.type !== "year")
    .map((part) => part.value)
    .join("")
    .replace(/[,\s]+$/g, "")
    .trim();

  return {
    primary: primary || accessible,
    secondary: years.join(" - "),
    accessible,
  };
};

const cleanDescription = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*/i, "")
    .replace(/\s+(Registration|Register by|Entry fee|Early registration|Late registration):.*$/i, "")
    .replace(/,\s+from\s+\d{4}-\d{2}-\d{2}(?:\s+to\s+\d{4}-\d{2}-\d{2})?/gi, "")
    .replace(/\s+(Chief Arbiter|Deputy Arbiters|Rate of play|Extra information|Tournament menu|Initial ranking|Pairings and results|Standings|Tournament cross table|Games|Download).*$/i, "")
    .replace(/\bOfficial website\b/gi, "")
    .trim();

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const withoutTitlePrefix = (value, title) => {
  const text = String(value || "").trim();
  if (!title) return text;
  const next = text.replace(new RegExp(`^${escapeRegExp(title)}\\s*[-:|]?\\s*`, "i"), "").trim();
  return next || text;
};

export const compactDescription = (value, fallback, { maxLength = 155, title = "" } = {}) => {
  const text = cleanDescription(withoutTitlePrefix(value || fallback, title));
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(maxLength - 3, 0)).trim()}...`;
};
