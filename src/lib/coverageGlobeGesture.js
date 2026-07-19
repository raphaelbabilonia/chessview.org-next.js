export const coverageGlobeGesture = Object.freeze({
  momentumDecayPerSecond: 8,
  momentumMaxRadiansPerSecond: 0.75,
  momentumTrackingPerSecond: 18,
  pinchDeadZonePx: 3,
  pinchZoomPerOctave: 4,
  pitchPerFullHeight: 1.2,
  rotationDampingPerSecond: 14,
  rotationStartPx: 4,
  tapSlopPx: 10,
  twistDeadZoneRadians: Math.PI / 180,
  yawPerFullWidth: 2.1,
  zoomDampingPerSecond: 20,
  zoomMax: 24,
  zoomMin: 1,
  cameraBaseClearance: 4.94,
  cameraZoomExponent: 0.9303,
  rotationSensitivityMin: 0.22,
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const dampFactor = (ratePerSecond, deltaSeconds) => {
  if (!Number.isFinite(ratePerSecond) || !Number.isFinite(deltaSeconds) || ratePerSecond <= 0 || deltaSeconds <= 0) return 0;
  return 1 - Math.exp(-ratePerSecond * deltaSeconds);
};

export const decayVelocity = (velocity, deltaSeconds, decayPerSecond = coverageGlobeGesture.momentumDecayPerSecond) => {
  if (!Number.isFinite(velocity)) return 0;
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return velocity;
  return velocity * Math.exp(-decayPerSecond * deltaSeconds);
};

export const rotationSensitivityForZoom = (zoom) =>
  Math.max(
    coverageGlobeGesture.rotationSensitivityMin,
    1 / Math.sqrt(clamp(Number(zoom) || coverageGlobeGesture.zoomMin, coverageGlobeGesture.zoomMin, coverageGlobeGesture.zoomMax)),
  );

export const rotationDeltaFromPointer = ({ deltaX, deltaY, height, width, zoom = coverageGlobeGesture.zoomMin }) => {
  const sensitivity = rotationSensitivityForZoom(zoom);
  return {
    pitch: (Number(deltaY) / Math.max(Number(height) || 0, 1)) * coverageGlobeGesture.pitchPerFullHeight * sensitivity,
    yaw: (Number(deltaX) / Math.max(Number(width) || 0, 1)) * coverageGlobeGesture.yawPerFullWidth * sensitivity,
  };
};

export const globeCameraDistanceForZoom = (zoom, globeRadius) => {
  const safeZoom = clamp(Number(zoom) || coverageGlobeGesture.zoomMin, coverageGlobeGesture.zoomMin, coverageGlobeGesture.zoomMax);
  const safeRadius = Math.max(Number(globeRadius) || 0, 0);
  return safeRadius + coverageGlobeGesture.cameraBaseClearance / safeZoom ** coverageGlobeGesture.cameraZoomExponent;
};

export const zoomControlStep = (zoom, fineStep) => {
  const safeZoom = clamp(Number(zoom) || coverageGlobeGesture.zoomMin, coverageGlobeGesture.zoomMin, coverageGlobeGesture.zoomMax);
  if (safeZoom >= 12) return 2;
  if (safeZoom >= 4) return 1;
  return Math.max(Number(fineStep) || 0, 0.1);
};

export const pointerPairAngle = (first, second) => {
  const deltaX = Number(second?.x) - Number(first?.x);
  const deltaY = Number(second?.y) - Number(first?.y);
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) || Math.hypot(deltaX, deltaY) < 1) return null;
  return Math.atan2(deltaY, deltaX);
};

export const shortestAngleDelta = (currentAngle, startAngle) => {
  if (!Number.isFinite(currentAngle) || !Number.isFinite(startAngle)) return 0;
  const difference = currentAngle - startAngle;
  return Math.atan2(Math.sin(difference), Math.cos(difference));
};

export const zoomFromPinch = ({ distance, startDistance, startZoom }) => {
  const safeDistance = Math.max(Number(distance) || 0, 1);
  const safeStartDistance = Math.max(Number(startDistance) || 0, 1);
  const ratio = safeDistance / safeStartDistance;
  const zoom = Number(startZoom) + Math.log2(ratio) * coverageGlobeGesture.pinchZoomPerOctave;
  return Math.min(Math.max(zoom, coverageGlobeGesture.zoomMin), coverageGlobeGesture.zoomMax);
};
