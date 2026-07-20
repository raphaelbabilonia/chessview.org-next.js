import assert from "node:assert/strict";
import test from "node:test";
import {
  coverageGlobeGesture,
  dampFactor,
  decayVelocity,
  globeCameraDistanceForZoom,
  nextOrientationStep,
  orientationDegreesForStep,
  pointerPairAngle,
  rotationDeltaFromPointer,
  rotationSensitivityForZoom,
  shortestAngleDelta,
  zoomControlStep,
  zoomFromPinch,
} from "../../src/lib/coverageGlobeGesture.js";

test("pinch zoom has consistent logarithmic sensitivity", () => {
  const lowZoom = zoomFromPinch({ distance: 150, startDistance: 100, startZoom: 1 });
  const highZoom = zoomFromPinch({ distance: 150, startDistance: 100, startZoom: 6 });

  assert.ok(Math.abs((highZoom - 6) - (lowZoom - 1)) < 0.000001);
  assert.equal(zoomFromPinch({ distance: 1000, startDistance: 10, startZoom: 10 }), coverageGlobeGesture.zoomMax);
  assert.equal(zoomFromPinch({ distance: 10, startDistance: 1000, startZoom: 2 }), coverageGlobeGesture.zoomMin);
});

test("rotation deltas are normalized to the canvas size", () => {
  const fullGesture = rotationDeltaFromPointer({ deltaX: 400, deltaY: 600, height: 600, width: 400 });
  const halfGesture = rotationDeltaFromPointer({ deltaX: 200, deltaY: 300, height: 600, width: 400 });

  assert.equal(fullGesture.yaw, coverageGlobeGesture.yawPerFullWidth);
  assert.equal(fullGesture.pitch, coverageGlobeGesture.pitchPerFullHeight);
  assert.equal(halfGesture.yaw, coverageGlobeGesture.yawPerFullWidth / 2);
  assert.equal(halfGesture.pitch, coverageGlobeGesture.pitchPerFullHeight / 2);
});

test("deep zoom progressively reduces horizontal and vertical rotation sensitivity", () => {
  const base = rotationDeltaFromPointer({ deltaX: 120, deltaY: 80, height: 600, width: 800, zoom: 1 });
  const medium = rotationDeltaFromPointer({ deltaX: 120, deltaY: 80, height: 600, width: 800, zoom: 12 });
  const deep = rotationDeltaFromPointer({ deltaX: 120, deltaY: 80, height: 600, width: 800, zoom: 24 });

  assert.ok(Math.abs(medium.yaw) < Math.abs(base.yaw));
  assert.ok(Math.abs(deep.yaw) < Math.abs(medium.yaw));
  assert.ok(Math.abs(deep.pitch) < Math.abs(medium.pitch));
  assert.equal(rotationSensitivityForZoom(24), coverageGlobeGesture.rotationSensitivityMin);
});

test("camera distance and control steps support the full 24x range", () => {
  const globeRadius = 2.36;
  const worldDistance = globeCameraDistanceForZoom(1, globeRadius);
  const formerMaxDistance = globeCameraDistanceForZoom(12, globeRadius);
  const deepDistance = globeCameraDistanceForZoom(24, globeRadius);

  assert.ok(Math.abs(worldDistance - 7.3) < 0.001);
  assert.ok(Math.abs(formerMaxDistance - 2.85) < 0.02);
  assert.ok(deepDistance > globeRadius + 0.2);
  assert.ok(deepDistance < formerMaxDistance);
  assert.equal(zoomControlStep(1, 0.65), 0.65);
  assert.equal(zoomControlStep(8, 0.65), 1);
  assert.equal(zoomControlStep(18, 0.65), 2);
});

test("orientation control restores north-up before cycling in 45 degree steps", () => {
  assert.equal(nextOrientationStep(null), 0);
  assert.equal(nextOrientationStep(0), 1);
  assert.equal(nextOrientationStep(7), 0);
  assert.equal(orientationDegreesForStep(0), 0);
  assert.equal(orientationDegreesForStep(1), 45);
  assert.equal(orientationDegreesForStep(7), 315);
  assert.equal(orientationDegreesForStep(8), 0);
});

test("two-pointer angles support half turns and wrap without discontinuities", () => {
  const horizontal = pointerPairAngle({ x: -1, y: 0 }, { x: 1, y: 0 });
  const vertical = pointerPairAngle({ x: 0, y: -1 }, { x: 0, y: 1 });
  const reversed = pointerPairAngle({ x: 1, y: 0 }, { x: -1, y: 0 });

  assert.equal(horizontal, 0);
  assert.equal(vertical, Math.PI / 2);
  assert.equal(reversed, Math.PI);
  assert.ok(Math.abs(shortestAngleDelta(reversed, horizontal) - Math.PI) < 0.000001);

  const wrapped = shortestAngleDelta((-179 * Math.PI) / 180, (179 * Math.PI) / 180);
  assert.ok(Math.abs(wrapped - (2 * Math.PI) / 180) < 0.000001);
  assert.equal(pointerPairAngle({ x: 2, y: 2 }, { x: 2, y: 2 }), null);
  assert.equal(shortestAngleDelta(null, horizontal), 0);
});

test("damping and momentum decay are time based", () => {
  const rotationDamping = dampFactor(coverageGlobeGesture.rotationDampingPerSecond, 0.05);
  const zoomDamping = dampFactor(coverageGlobeGesture.zoomDampingPerSecond, 0.05);
  assert.ok(Math.abs(rotationDamping - (1 - Math.exp(-0.7))) < 0.000001);
  assert.ok(Math.abs(zoomDamping - (1 - Math.exp(-1))) < 0.000001);
  assert.ok(rotationDamping < zoomDamping);
  assert.ok(decayVelocity(0.75, 0.1) < 0.75);
  assert.equal(decayVelocity(0.75, 0), 0.75);
  assert.equal(decayVelocity(Number.NaN, 0.1), 0);
});
