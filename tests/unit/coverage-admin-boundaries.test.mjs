import assert from "node:assert/strict";
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
  assert.equal(coverageAdminBoundaryOpacity(3), 0);
  assert.ok(coverageAdminBoundaryOpacity(4.5) > 0);
  assert.equal(coverageAdminBoundaryOpacity(6), 1);
  assert.equal(coverageAdminBoundaryOpacity(1, true), 0);
  assert.ok(coverageAdminBoundaryOpacity(2, true) > 0);
  assert.equal(coverageAdminBoundaryOpacity(2.5, true), 1);
  assert.equal(shouldLoadCoverageAdminBoundaries(3), false);
  assert.equal(shouldLoadCoverageAdminBoundaries(3.01), true);
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
