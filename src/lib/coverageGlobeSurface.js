import { geoArea } from "d3-geo";

export const coverageGlobeSurface = Object.freeze({
  landPalette: Object.freeze(["#304a66", "#344f6c", "#395571", "#3d5976"]),
  lineLifts: Object.freeze({
    adminBoundary: 0.0025,
    boundary: 0.0015,
    detailedSurface: 0.00025,
    graticule: 0.001,
  }),
  oceanColor: "#082b50",
  style: "cartographic-slate",
  textureSizes: Object.freeze({
    full: Object.freeze({ height: 2048, width: 4096 }),
    reduced: Object.freeze({ height: 1024, width: 2048 }),
  }),
});

export const coverageGlobeTextureSize = (quality = "full") =>
  quality === "reduced" ? coverageGlobeSurface.textureSizes.reduced : coverageGlobeSurface.textureSizes.full;

export const coverageCountryShadeIndex = (identity, paletteLength = coverageGlobeSurface.landPalette.length) => {
  const colors = Math.max(1, Math.floor(Number(paletteLength) || 1));
  const value = String(identity ?? "");
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % colors;
};

const normalizeCoveragePolygon = (coordinates) => {
  const polygon = { coordinates, type: "Polygon" };
  return geoArea(polygon) > 2 * Math.PI ? coordinates.map((ring) => [...ring].reverse()) : coordinates;
};

export const normalizeCoverageAtlasFeature = (country) => {
  if (!country?.geometry || !["Polygon", "MultiPolygon"].includes(country.geometry.type)) return country;

  return {
    ...country,
    geometry: {
      ...country.geometry,
      coordinates:
        country.geometry.type === "MultiPolygon"
          ? country.geometry.coordinates.map(normalizeCoveragePolygon)
          : normalizeCoveragePolygon(country.geometry.coordinates),
    },
  };
};
