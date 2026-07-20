import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mesh } from "topojson-client";
import { topology } from "topojson-server";

const sourceCommit = "ca96624a56bd078437bca8184e78163e5039ad19";
const sourceUrl = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${sourceCommit}/geojson/ne_10m_admin_1_states_provinces.geojson`;
const coordinatePrecision = 10000;
const simplificationTolerance = 0.003;
const topologyQuantization = 100000;
const outputPath = path.resolve("public/maps/admin1-boundaries.json");

const normalizedName = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const cleanName = (value) => {
  const name = String(value || "").trim();
  return name && name !== "-99" ? name : "";
};

const squaredSegmentDistance = (point, start, end) => {
  let x = start[0];
  let y = start[1];
  let deltaX = end[0] - x;
  let deltaY = end[1] - y;

  if (deltaX || deltaY) {
    const ratio = ((point[0] - x) * deltaX + (point[1] - y) * deltaY) / (deltaX * deltaX + deltaY * deltaY);
    if (ratio > 1) {
      x = end[0];
      y = end[1];
    } else if (ratio > 0) {
      x += deltaX * ratio;
      y += deltaY * ratio;
    }
  }

  deltaX = point[0] - x;
  deltaY = point[1] - y;
  return deltaX * deltaX + deltaY * deltaY;
};

const coordinateKey = (coordinate) => `${Number(coordinate?.[0])},${Number(coordinate?.[1])}`;

const simplifyLine = (points, tolerance, preservedPoints = new Set()) => {
  if (!Array.isArray(points) || points.length <= 2) return points || [];
  const squareTolerance = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const anchorIndexes = [0];
  for (let index = 1; index < points.length - 1; index += 1) {
    if (!preservedPoints.has(coordinateKey(points[index]))) continue;
    keep[index] = 1;
    anchorIndexes.push(index);
  }
  anchorIndexes.push(points.length - 1);
  const stack = [];
  for (let index = 1; index < anchorIndexes.length; index += 1) {
    stack.push([anchorIndexes[index - 1], anchorIndexes[index]]);
  }

  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDistance = squareTolerance;
    let splitIndex = -1;

    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredSegmentDistance(points[index], points[first], points[last]);
      if (distance <= maxDistance) continue;
      maxDistance = distance;
      splitIndex = index;
    }

    if (splitIndex < 0) continue;
    keep[splitIndex] = 1;
    stack.push([first, splitIndex], [splitIndex, last]);
  }

  return points.filter((_, index) => keep[index]);
};

const encodeLine = (
  coordinates,
  { precision = coordinatePrecision, preservedPoints = new Set(), tolerance = simplificationTolerance } = {},
) => {
  const simplified = simplifyLine(coordinates, tolerance, preservedPoints);
  const quantized = [];

  for (const coordinate of simplified) {
    const longitude = Math.round(Number(coordinate?.[0]) * precision);
    const latitude = Math.round(Number(coordinate?.[1]) * precision);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    const previous = quantized[quantized.length - 1];
    if (previous?.[0] === longitude && previous?.[1] === latitude) continue;
    quantized.push([longitude, latitude]);
  }

  if (quantized.length < 2) return null;
  const encoded = [quantized[0][0], quantized[0][1]];
  for (let index = 1; index < quantized.length; index += 1) {
    encoded.push(quantized[index][0] - quantized[index - 1][0], quantized[index][1] - quantized[index - 1][1]);
  }
  return encoded;
};

const featureUnitName = (feature) => {
  const properties = feature.properties || {};
  return cleanName(properties.name) || cleanName(properties.name_en) || cleanName(properties.name_local) || cleanName(properties.adm1_code);
};

const parentRegionName = (feature) => cleanName(feature.properties?.region);

const featureUnitKey = (feature) => {
  const properties = feature.properties || {};
  return cleanName(properties.adm1_code) || cleanName(properties.iso_3166_2) || featureUnitName(feature);
};

const shouldUseParentRegions = (features) => {
  const parentNames = features.map(parentRegionName).filter(Boolean);
  const uniqueParents = new Set(parentNames);
  if (uniqueParents.size < 2 || uniqueParents.size >= features.length || parentNames.length / features.length < 0.8) return false;

  const geonamesLevels = features.map((feature) => Number(feature.properties?.gn_level)).filter((level) => level > 0);
  const lowerLevelRatio = geonamesLevels.length
    ? geonamesLevels.filter((level) => level >= 2).length / geonamesLevels.length
    : 0;
  const tooDenseForCountryView = features.length > 60 && uniqueParents.size <= 25;
  return lowerLevelRatio >= 0.7 || tooDenseForCountryView;
};

const countryBoundaryGeometry = (features, useParentRegions, encodingOptions) => {
  const regionFeatures = features
    .map((feature) => {
      const coverageRegionName = useParentRegions ? parentRegionName(feature) : featureUnitName(feature);
      const coverageRegionKey = useParentRegions ? normalizedName(coverageRegionName) : featureUnitKey(feature);
      if (!coverageRegionKey || !coverageRegionName) return null;
      return {
        ...feature,
        properties: {
          coverageRegionKey,
          coverageRegionName,
        },
      };
    })
    .filter(Boolean);
  if (!regionFeatures.length) return { lines: [], outlineLines: [], regionNames: [] };

  const regionNames = [...new Set(regionFeatures.map((feature) => feature.properties.coverageRegionName))].sort((first, second) =>
    first.localeCompare(second, "en"),
  );
  const regionTopology = topology(
    {
      regions: {
        type: "FeatureCollection",
        features: regionFeatures,
      },
    },
    topologyQuantization,
  );
  const outlineMesh = mesh(regionTopology, regionTopology.objects.regions, (first, second) => first === second);
  const outlineCoordinates = outlineMesh.coordinates || [];
  const boundaryCoordinates =
    regionFeatures.length >= 2 && regionNames.length >= 2
      ? mesh(
          regionTopology,
          regionTopology.objects.regions,
          (first, second) => first !== second && first.properties?.coverageRegionKey !== second.properties?.coverageRegionKey,
        ).coordinates || []
      : [];
  const preservedPoints = new Set();
  for (const line of [...outlineCoordinates, ...boundaryCoordinates]) {
    if (line.length) preservedPoints.add(coordinateKey(line[0]));
    if (line.length > 1) preservedPoints.add(coordinateKey(line[line.length - 1]));
  }
  const topologySafeEncoding = { ...encodingOptions, preservedPoints };
  const outlineLines = outlineCoordinates
    .map((line) => encodeLine(line, topologySafeEncoding))
    .filter(Boolean);
  const lines = boundaryCoordinates
    .map((line) => encodeLine(line, topologySafeEncoding))
    .filter(Boolean);
  return { lines, outlineLines, regionNames };
};

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`Natural Earth download failed with ${response.status}`);
const source = await response.json();
const featuresByCountry = new Map();

for (const feature of source.features || []) {
  if (!feature?.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) continue;
  const countryName = cleanName(feature.properties?.admin) || cleanName(feature.properties?.geonunit);
  const countryKey = normalizedName(countryName);
  if (!countryKey) continue;
  if (!featuresByCountry.has(countryKey)) {
    featuresByCountry.set(countryKey, { features: [], name: countryName });
  }
  const country = featuresByCountry.get(countryKey);
  country.features.push(feature);
}

const countries = {};
const worldOutlines = {};
for (const [countryKey, country] of [...featuresByCountry].sort(([first], [second]) => first.localeCompare(second))) {
  const useParentRegions = shouldUseParentRegions(country.features);
  const encodingOptions = { precision: coordinatePrecision, tolerance: simplificationTolerance };
  const { lines, outlineLines, regionNames } = countryBoundaryGeometry(country.features, useParentRegions, encodingOptions);

  if (outlineLines.length) {
    worldOutlines[countryKey] = {
      coordinatePrecision,
      lines: outlineLines,
      name: country.name,
      simplificationTolerance,
    };
  }
  if (!lines.length || regionNames.length < 2) continue;
  countries[countryKey] = {
    coordinatePrecision,
    lines,
    name: country.name,
    regionNames,
    simplificationTolerance,
    sourceGrouping: useParentRegions ? "parent-region" : "admin-unit",
  };
}

const payload = {
  coordinatePrecision,
  countries,
  generatedFrom: sourceUrl,
  simplificationTolerance,
  source: "Natural Earth Admin-1 states/provinces polygons, dissolved to the first useful country subdivision",
  sourceCommit,
  topologyQuantization,
  version: 4,
  worldOutlines,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(payload));

const totalLines = Object.values(countries).reduce((sum, country) => sum + country.lines.length, 0);
const totalRegions = Object.values(countries).reduce((sum, country) => sum + country.regionNames.length, 0);
const totalWorldOutlineLines = Object.values(worldOutlines).reduce((sum, country) => sum + country.lines.length, 0);
console.log(
  `Wrote ${Object.keys(countries).length} countries, ${totalRegions} subdivisions, ${totalLines} internal lines, and ${totalWorldOutlineLines} aligned worldwide outline lines to ${outputPath}`,
);
