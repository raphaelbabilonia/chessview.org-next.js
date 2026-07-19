export const coverageMarkerSizing = Object.freeze({
  densityRadius: 12,
  flatClusterMaxRadius: 3.4,
  flatClusterRadiusBase: 2.2,
  flatClusterRadiusPerRootEvent: 0.2,
  flatEventRadius: 1.65,
  flatMarkerRingPadding: 0.55,
  flatMarkerTargetRadius: 4.2,
  globeClusterMaxRadiusPx: 3.6,
  globeClusterMinRadiusPx: 2.6,
  globeCountryMaxRadiusPx: 4.2,
  globeCountryMinRadiusPx: 2.8,
  globeEventMaxRadiusPx: 2.4,
  globeEventMinRadiusPx: 1.1,
  hoverScale: 1.25,
  minimumDensityScale: 0.45,
  surfaceEpsilon: 0.001,
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const rounded = (value) => Number(value.toFixed(3));

export const markerDensityScale = (neighborCount) => {
  const safeCount = Math.max(1, Number(neighborCount) || 1);
  return Math.max(coverageMarkerSizing.minimumDensityScale, 1 / Math.sqrt(1 + 0.5 * (safeCount - 1)));
};

export const densityScalesForPoints = (points, zoom = 1) => {
  const safeZoom = Math.max(Number(zoom) || 1, 1);

  return points.map((point) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return 1;
    const neighborCount = points.reduce((count, other) => {
      if (!other || !Number.isFinite(other.x) || !Number.isFinite(other.y)) return count;
      const distance = Math.hypot((point.x - other.x) * safeZoom, (point.y - other.y) * safeZoom);
      return count + Number(distance <= coverageMarkerSizing.densityRadius);
    }, 0);
    return markerDensityScale(neighborCount);
  });
};

export const flatEventMarkerDimensions = ({ densityScale = 1, zoom = 1 } = {}) => {
  const safeZoom = Math.max(Number(zoom) || 1, 1);
  const visualRadius = coverageMarkerSizing.flatEventRadius * clamp(Number(densityScale) || 1, coverageMarkerSizing.minimumDensityScale, 1);

  return {
    radius: rounded(visualRadius / safeZoom),
    ringRadius: rounded((visualRadius + coverageMarkerSizing.flatMarkerRingPadding) / safeZoom),
    targetRadius: rounded(coverageMarkerSizing.flatMarkerTargetRadius / safeZoom),
    visualRadius: rounded(visualRadius),
  };
};

export const flatClusterMarkerDimensions = ({ count = 1, zoom = 1 } = {}) => {
  const safeCount = Math.max(Number(count) || 1, 1);
  const safeZoom = Math.max(Number(zoom) || 1, 1);
  const visualRadius = Math.min(
    coverageMarkerSizing.flatClusterMaxRadius,
    coverageMarkerSizing.flatClusterRadiusBase + Math.sqrt(safeCount) * coverageMarkerSizing.flatClusterRadiusPerRootEvent,
  );

  return {
    dotRadius: rounded(Math.max(0.38, visualRadius * 0.32) / safeZoom),
    haloRadius: rounded((visualRadius + 0.8) / safeZoom),
    radius: rounded(visualRadius / safeZoom),
    targetRadius: rounded(Math.max(coverageMarkerSizing.flatMarkerTargetRadius, visualRadius) / safeZoom),
    visualRadius: rounded(visualRadius),
  };
};

export const globeEventMarkerRadiusPx = (densityScale = 1) =>
  rounded(
    clamp(
      coverageMarkerSizing.globeEventMaxRadiusPx * (Number(densityScale) || 1),
      coverageMarkerSizing.globeEventMinRadiusPx,
      coverageMarkerSizing.globeEventMaxRadiusPx,
    ),
  );

export const globeClusterMarkerRadiusPx = (count = 1) =>
  rounded(
    clamp(
      2.35 + Math.sqrt(Math.max(Number(count) || 1, 1)) * 0.28,
      coverageMarkerSizing.globeClusterMinRadiusPx,
      coverageMarkerSizing.globeClusterMaxRadiusPx,
    ),
  );

export const globeCountryMarkerRadiusPx = (count = 1) =>
  rounded(
    clamp(
      2.6 + Math.sqrt(Math.max(Number(count) || 1, 1)) * 0.18,
      coverageMarkerSizing.globeCountryMinRadiusPx,
      coverageMarkerSizing.globeCountryMaxRadiusPx,
    ),
  );

export const markerFanoutOffset = (event, maxDistance = 10) => {
  const anchor = event?.anchor;
  const marker = event?.marker;
  if (!anchor || !marker) return { x: 0, y: 0 };

  const x = Number(marker.x) - Number(anchor.x);
  const y = Number(marker.y) - Number(anchor.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const distance = Math.hypot(x, y);
  if (!distance || distance <= maxDistance) return { x, y };
  const scale = maxDistance / distance;
  return { x: x * scale, y: y * scale };
};

export const worldUnitsPerPixel = ({ distance, fovDegrees, viewportHeight }) => {
  const safeDistance = Math.max(Number(distance) || 0, 0);
  const safeHeight = Math.max(Number(viewportHeight) || 0, 1);
  const safeFov = clamp(Number(fovDegrees) || 0, 0, 179);
  return (2 * Math.tan((safeFov * Math.PI) / 360) * safeDistance) / safeHeight;
};

export const surfaceBeadCenterRadius = ({ beadRadius, globeRadius, surfaceEpsilon = coverageMarkerSizing.surfaceEpsilon }) =>
  Math.max(Number(globeRadius) || 0, 0) + Math.max(Number(beadRadius) || 0, 0) + Math.max(Number(surfaceEpsilon) || 0, 0);
