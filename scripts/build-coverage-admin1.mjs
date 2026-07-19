import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceCommit = "ca96624a56bd078437bca8184e78163e5039ad19";
const sourceUrl = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${sourceCommit}/geojson/ne_10m_admin_1_states_provinces_lines.geojson`;
const coordinatePrecision = 1000;
const simplificationTolerance = 0.015;
const outputPath = path.resolve("public/maps/admin1-boundaries.json");

const normalizedName = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

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

const simplifyLine = (points, tolerance) => {
  if (!Array.isArray(points) || points.length <= 2) return points || [];
  const squareTolerance = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  keep[0] = 1;
  keep[points.length - 1] = 1;

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

const encodeLine = (coordinates) => {
  const simplified = simplifyLine(coordinates, simplificationTolerance);
  const quantized = [];

  for (const coordinate of simplified) {
    const longitude = Math.round(Number(coordinate?.[0]) * coordinatePrecision);
    const latitude = Math.round(Number(coordinate?.[1]) * coordinatePrecision);
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

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`Natural Earth download failed with ${response.status}`);
const source = await response.json();
const countries = {};

for (const feature of source.features || []) {
  const countryName = String(feature.properties?.ADM0_NAME || "").trim();
  const countryKey = normalizedName(countryName);
  if (!countryKey) continue;
  const geometry = feature.geometry;
  const lines = geometry?.type === "MultiLineString" ? geometry.coordinates : geometry?.type === "LineString" ? [geometry.coordinates] : [];

  for (const line of lines) {
    const encoded = encodeLine(line);
    if (!encoded) continue;
    if (!countries[countryKey]) countries[countryKey] = { name: countryName, lines: [] };
    countries[countryKey].lines.push(encoded);
  }
}

const payload = {
  coordinatePrecision,
  countries,
  generatedFrom: sourceUrl,
  simplificationTolerance,
  source: "Natural Earth Admin-1 states/provinces lines",
  sourceCommit,
  version: 1,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(payload));

const totalLines = Object.values(countries).reduce((sum, country) => sum + country.lines.length, 0);
console.log(`Wrote ${Object.keys(countries).length} countries and ${totalLines} lines to ${outputPath}`);
