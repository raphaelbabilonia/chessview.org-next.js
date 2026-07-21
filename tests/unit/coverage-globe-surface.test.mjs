import assert from "node:assert/strict";
import test from "node:test";
import { geoArea } from "d3-geo";
import {
  coverageCountryShadeIndex,
  coverageGlobeSurface,
  coverageGlobeTextureSize,
  normalizeCoverageAtlasFeature,
} from "../../src/lib/coverageGlobeSurface.js";

test("globe surface quality selects the intended texture dimensions", () => {
  assert.deepEqual(coverageGlobeTextureSize("full"), { height: 2048, width: 4096 });
  assert.deepEqual(coverageGlobeTextureSize("reduced"), { height: 1024, width: 2048 });
  assert.deepEqual(coverageGlobeTextureSize("unknown"), coverageGlobeTextureSize("full"));
});

test("geographic lines stay close enough to the globe to avoid deep-zoom parallax", () => {
  const { adminBoundary, boundary, detailedSurface, graticule } = coverageGlobeSurface.lineLifts;

  assert.ok(detailedSurface > 0);
  assert.ok(detailedSurface < graticule);
  assert.ok(graticule > 0);
  assert.ok(graticule < boundary);
  assert.ok(boundary < adminBoundary);
  assert.ok(adminBoundary <= 0.0025);
});

test("country surface shades are deterministic and varied", () => {
  const countries = ["Italy", "France", "Germany", "Spain", "Portugal", "Austria"];
  const shades = countries.map((country) => coverageCountryShadeIndex(country));

  assert.deepEqual(shades, countries.map((country) => coverageCountryShadeIndex(country)));
  assert.ok(shades.every((shade) => shade >= 0 && shade < coverageGlobeSurface.landPalette.length));
  assert.ok(new Set(shades).size >= 3);
});

test("country shade selection remains safe with an invalid palette length", () => {
  assert.equal(coverageCountryShadeIndex("Italy", 0), 0);
  assert.equal(coverageCountryShadeIndex("Italy", Number.NaN), 0);
});

test("atlas polygons are normalized away from whole-world complement fills", () => {
  const reversedCountry = {
    geometry: {
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
      type: "Polygon",
    },
    properties: { name: "Fixture" },
    type: "Feature",
  };

  assert.ok(geoArea(reversedCountry) > 2 * Math.PI);
  const normalized = normalizeCoverageAtlasFeature(reversedCountry);
  assert.ok(geoArea(normalized) < 2 * Math.PI);
  assert.equal(normalized.properties.name, "Fixture");
});
