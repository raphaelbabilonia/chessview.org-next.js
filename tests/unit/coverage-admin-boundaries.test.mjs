import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  coverageAdminBoundaryOpacity,
  coverageBoundaryCountry,
  decodeCoverageBoundaryLine,
  decodedCoverageBoundaryLines,
  decodedCoverageWorldOutlineLines,
  normalizeCoverageCountryName,
  shouldLoadCoverageAdminBoundaries,
} from "../../src/lib/coverageAdminBoundaries.js";

test("regional boundaries remain hidden at minimum zoom and fade in progressively", () => {
  assert.equal(coverageAdminBoundaryOpacity(1), 0);
  assert.equal(coverageAdminBoundaryOpacity(10), 0);
  assert.ok(coverageAdminBoundaryOpacity(10.375) > 0);
  assert.equal(coverageAdminBoundaryOpacity(10.75), 1);
  assert.equal(coverageAdminBoundaryOpacity(13), 1);
  assert.equal(coverageAdminBoundaryOpacity(8, true), 0);
  assert.ok(coverageAdminBoundaryOpacity(10, true) > 0);
  assert.equal(coverageAdminBoundaryOpacity(12, true), 1);
  assert.equal(shouldLoadCoverageAdminBoundaries(10), false);
  assert.equal(shouldLoadCoverageAdminBoundaries(10.01), true);
  assert.equal(shouldLoadCoverageAdminBoundaries(8, true), false);
  assert.equal(shouldLoadCoverageAdminBoundaries(8.01, true), true);
});

test("generated boundaries use restrained first subdivisions instead of lower-level Italian provinces", () => {
  const data = JSON.parse(readFileSync(new URL("../../public/maps/admin1-boundaries.json", import.meta.url), "utf8"));
  const italy = data.countries.italy;

  assert.equal(data.version, 4);
  assert.equal(italy.sourceGrouping, "parent-region");
  assert.equal(italy.coordinatePrecision, 10000);
  assert.equal(italy.simplificationTolerance, 0.003);
  assert.equal(italy.regionNames.length, 20);
  assert.ok(italy.regionNames.includes("Piemonte"));
  assert.ok(italy.regionNames.includes("Lombardia"));
  assert.ok(italy.regionNames.includes("Lazio"));
  assert.equal(italy.regionNames.includes("Torino"), false);
  assert.equal(italy.regionNames.includes("Milano"), false);
  assert.equal(italy.regionNames.includes("Roma"), false);
  assert.equal(data.countries.france.regionNames.length, 18);
  assert.equal(data.countries.germany.regionNames.length, 16);
  assert.equal(data.countries.canada.regionNames.length, 13);
  assert.equal(data.countries.unitedstatesofamerica.regionNames.length, 51);
  assert.equal(data.countries.japan.regionNames.length, 47);
  assert.equal(data.countries.macedonia.regionNames.length, 9);
  assert.equal(data.countries.malta.regionNames.length, 3);
  assert.equal(data.countries.russia.regionNames.length, 6);
  assert.equal(data.countries.thailand.regionNames.length, 6);
  assert.equal(data.countries.spain.regionNames.length, 19);
  assert.equal(data.countries.brazil.regionNames.length, 27);
  assert.equal(data.countries.india.regionNames.length, 36);
  assert.equal(data.countries.australia.regionNames.length, 11);
  assert.equal(data.countries.southafrica.regionNames.length, 9);
  assert.ok(Object.keys(data.countries).length >= 190);
  assert.ok(Object.values(data.countries).every((country) => country.regionNames.length >= 2 && country.lines.length >= 1));
  assert.ok(Object.values(data.countries).every((country) => country.coordinatePrecision === 10000));
  assert.ok(Object.values(data.countries).every((country) => country.simplificationTolerance === 0.003));
});

test("regional networks and country outlines share every junction worldwide", () => {
  const data = JSON.parse(readFileSync(new URL("../../public/maps/admin1-boundaries.json", import.meta.url), "utf8"));
  assert.ok(Object.keys(data.worldOutlines).length >= 200);
  assert.ok(data.worldOutlines.italy);
  assert.ok(data.worldOutlines.unitedstatesofamerica);
  assert.ok(data.worldOutlines.brazil);
  assert.ok(data.worldOutlines.southafrica);
  assert.ok(data.worldOutlines.india);
  assert.ok(data.worldOutlines.australia);
  assert.ok(decodedCoverageWorldOutlineLines(data).length >= 3000);
  assert.ok(Object.keys(data.countries).every((countryKey) => data.worldOutlines[countryKey]));

  for (const [countryKey, outline] of Object.entries(data.worldOutlines)) {
    const country = data.countries[countryKey];
    if (!country) continue;
    const internalLines = country.lines.map((line) => decodeCoverageBoundaryLine(line, country.coordinatePrecision));
    const outlineLines = outline.lines.map((line) => decodeCoverageBoundaryLine(line, outline.coordinatePrecision));
    const pointOccurrences = new Map();

    for (const line of [...internalLines, ...outlineLines]) {
      for (const point of line) {
        const key = point.join(",");
        pointOccurrences.set(key, (pointOccurrences.get(key) || 0) + 1);
      }
    }

    for (const line of internalLines) {
      for (const endpoint of [line[0], line[line.length - 1]]) {
        const key = endpoint.join(",");
        assert.ok(pointOccurrences.get(key) >= 2, `${countryKey} has a regional boundary disconnected from its topology at ${key}`);
      }
    }
  }
});

test("delta encoded boundary lines decode to longitude and latitude", () => {
  assert.deepEqual(decodeCoverageBoundaryLine([12000, 41000, 25, -10, -5, 20], 1000), [
    [12, 41],
    [12.025, 40.99],
    [12.02, 41.01],
  ]);
  assert.deepEqual(decodeCoverageBoundaryLine([], 1000), []);
});

test("country lookup accepts display and atlas-style names", () => {
  const data = {
    coordinatePrecision: 1000,
    countries: {
      bosniaandherzegovina: { lines: [[1000, 2000, 5, 5]], name: "Bosnia and Herzegovina" },
      unitedkingdom: { lines: [[3000, 4000, 5, 5]], name: "United Kingdom" },
    },
  };

  assert.equal(normalizeCoverageCountryName("Bosnia & Herzegovina"), "bosniaandherzegovina");
  assert.equal(coverageBoundaryCountry(data, ["England", "United Kingdom"])?.name, "United Kingdom");
  assert.deepEqual(decodedCoverageBoundaryLines(data, ["Bosnia & Herzegovina"]), [
    [
      [1, 2],
      [1.005, 2.005],
    ],
  ]);
});

test("country-specific precision preserves detailed worldwide coordinates", () => {
  const data = {
    coordinatePrecision: 1000,
    countries: {
      italy: { coordinatePrecision: 10000, lines: [[120001, 410002, 3, -4]] },
    },
  };

  assert.deepEqual(decodedCoverageBoundaryLines(data, ["Italy"]), [
    [
      [12.0001, 41.0002],
      [12.0004, 40.9998],
    ],
  ]);
});
