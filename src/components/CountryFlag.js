const fallbackText = (label = "") =>
  String(label || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "CV";

export function CountryFlag({ className = "country-coverage-flag", country }) {
  const code = String(country?.flagCode || "").trim();
  const label = country?.label || country?.country || "";

  if (code && code !== "xx") {
    return <span className={`${className} fi fi-${code}`} aria-hidden="true" />;
  }

  return (
    <span className={`${className} country-coverage-flag-fallback`} aria-hidden="true">
      {fallbackText(label)}
    </span>
  );
}
