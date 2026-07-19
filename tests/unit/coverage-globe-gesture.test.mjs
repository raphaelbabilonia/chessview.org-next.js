import assert from "node:assert/strict";
import test from "node:test";
import {
  coverageGlobeGesture,
  dampFactor,
  decayVelocity,
  rotationDeltaFromPointer,
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

test("damping and momentum decay are time based", () => {
  const damping = dampFactor(coverageGlobeGesture.rotationDampingPerSecond, 0.05);
  assert.ok(Math.abs(damping - (1 - Math.exp(-1))) < 0.000001);
  assert.ok(decayVelocity(0.75, 0.1) < 0.75);
  assert.equal(decayVelocity(0.75, 0), 0.75);
  assert.equal(decayVelocity(Number.NaN, 0.1), 0);
});
