export const coverageAdminBoundaries = Object.freeze({
  assetUrl: "/maps/admin1-boundaries.json?v=3",
  countryFadeEnd: 12,
  countryFadeStart: 8,
  globeOpacity: 0.52,
  worldFadeEnd: 13,
  worldFadeStart: 10,
});

let boundaryDataPromise;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const normalizeCoverageCountryName = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

export const coverageAdminBoundaryOpacity = (zoom, countryMode = false) => {
  const start = countryMode ? coverageAdminBoundaries.countryFadeStart : coverageAdminBoundaries.worldFadeStart;
  const end = countryMode ? coverageAdminBoundaries.countryFadeEnd : coverageAdminBoundaries.worldFadeEnd;
  const progress = clamp(((Number(zoom) || 0) - start) / (end - start), 0, 1);
  return progress * progress * (3 - 2 * progress);
};

export const shouldLoadCoverageAdminBoundaries = (zoom, countryMode = false) => {
  const start = countryMode ? coverageAdminBoundaries.countryFadeStart : coverageAdminBoundaries.worldFadeStart;
  return Number(zoom) > start;
};

export const decodeCoverageBoundaryLine = (encoded, coordinatePrecision = 1000) => {
  if (!Array.isArray(encoded) || encoded.length < 4) return [];
  const precision = Math.max(Number(coordinatePrecision) || 1, 1);
  const line = [];
  let longitude = 0;
  let latitude = 0;

  for (let index = 0; index + 1 < encoded.length; index += 2) {
    longitude = index ? longitude + Number(encoded[index]) : Number(encoded[index]);
    latitude = index ? latitude + Number(encoded[index + 1]) : Number(encoded[index + 1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [];
    line.push([longitude / precision, latitude / precision]);
  }

  return line;
};

export const coverageBoundaryCountry = (data, countryNames = []) => {
  for (const countryName of countryNames) {
    const country = data?.countries?.[normalizeCoverageCountryName(countryName)];
    if (country) return country;
  }
  return null;
};

export const decodedCoverageBoundaryLines = (data, countryNames) => {
  const countries = countryNames?.length ? [coverageBoundaryCountry(data, countryNames)].filter(Boolean) : Object.values(data?.countries || {});
  return countries.flatMap((country) =>
    (country.lines || [])
      .map((line) => decodeCoverageBoundaryLine(line, country.coordinatePrecision || data?.coordinatePrecision))
      .filter((line) => line.length >= 2),
  );
};

export const decodedCoverageEuropeOutlineLines = (data) =>
  Object.values(data?.europeOutlines || {}).flatMap((country) =>
    (country.lines || [])
      .map((line) => decodeCoverageBoundaryLine(line, country.coordinatePrecision || data?.europeCoordinatePrecision || data?.coordinatePrecision))
      .filter((line) => line.length >= 2),
  );

export const loadCoverageAdminBoundaries = async () => {
  if (!boundaryDataPromise) {
    boundaryDataPromise = fetch(coverageAdminBoundaries.assetUrl, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Coverage boundary request failed with ${response.status}`);
        return response.json();
      })
      .catch((error) => {
        boundaryDataPromise = undefined;
        throw error;
      });
  }
  return boundaryDataPromise;
};
