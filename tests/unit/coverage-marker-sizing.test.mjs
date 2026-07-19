import assert from "node:assert/strict";
import test from "node:test";
import {
  coverageMarkerSizing,
  densityScalesForPoints,
  globeClusterMarkerRadiusPx,
  globeCountryMarkerRadiusPx,
  globeEventMarkerRadiusPx,
  markerFanoutOffset,
  surfaceBeadCenterRadius,
  worldUnitsPerPixel,
} from "../../src/lib/coverageMarkerSizing.js";

test("marker density shrinks crowded points without changing isolated points", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 4, y: 0 },
    { x: 100, y: 100 },
  ];
  const scales = densityScalesForPoints(points, 1);

  assert.ok(scales[0] < 1);
  assert.ok(scales[1] <= scales[0]);
  assert.equal(scales[3], 1);
  assert.deepEqual(densityScalesForPoints(points, 10), [1, 1, 1, 1]);
});

test("globe marker radii stay inside the visual caps", () => {
  assert.equal(globeEventMarkerRadiusPx(1), coverageMarkerSizing.globeEventMaxRadiusPx);
  assert.equal(globeEventMarkerRadiusPx(0.01), coverageMarkerSizing.globeEventMinRadiusPx);
  assert.ok(globeClusterMarkerRadiusPx(2) >= coverageMarkerSizing.globeClusterMinRadiusPx);
  assert.equal(globeClusterMarkerRadiusPx(1000), coverageMarkerSizing.globeClusterMaxRadiusPx);
  assert.ok(globeCountryMarkerRadiusPx(1) >= coverageMarkerSizing.globeCountryMinRadiusPx);
  assert.equal(globeCountryMarkerRadiusPx(1000), coverageMarkerSizing.globeCountryMaxRadiusPx);
});

test("fan-out is capped and surface beads remain grounded", () => {
  const offset = markerFanoutOffset({ anchor: { x: 0, y: 0 }, marker: { x: 30, y: 40 } });
  assert.ok(Math.abs(Math.hypot(offset.x, offset.y) - 10) < 0.000001);
  assert.deepEqual(markerFanoutOffset({ anchor: { x: 4, y: 5 }, marker: { x: 4, y: 5 } }), { x: 0, y: 0 });

  const beadRadius = 0.018;
  const centerRadius = surfaceBeadCenterRadius({ beadRadius, globeRadius: 2.36 });
  assert.ok(Math.abs(centerRadius - beadRadius - coverageMarkerSizing.surfaceEpsilon - 2.36) < 0.000001);
  assert.ok(worldUnitsPerPixel({ distance: 5, fovDegrees: 38, viewportHeight: 500 }) > 0);
});
