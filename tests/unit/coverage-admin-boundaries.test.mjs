import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  coverageAdminBoundaryOpacity,
  coverageBoundaryCountry,
  decodeCoverageBoundaryLine,
  decodedCoverageBoundaryLines,
  normalizeCoverageCountryName,
  shouldLoadCoverageAdminBoundaries,
} from "../../src/lib/coverageAdminBoundaries.js";

test("regional boundaries remain hidden at minimum zoom and fade in progressively", () => {
  assert.equal(coverageAdminBoundaryOpacity(1), 0);
  assert.equal(coverageAdminBoundaryOpacity(10), 0);
  assert.ok(coverageAdminBoundaryOpacity(11.5) > 0);
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

  assert.equal(data.version, 2);
  assert.equal(italy.sourceGrouping, "parent-region");
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
