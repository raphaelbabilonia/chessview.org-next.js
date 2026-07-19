export const coverageGlobeGesture = Object.freeze({
  momentumDecayPerSecond: 8,
  momentumMaxRadiansPerSecond: 0.75,
  pinchDeadZonePx: 3,
  pinchZoomPerOctave: 4,
  pitchPerFullHeight: 1.2,
  rotationDampingPerSecond: 20,
  rotationStartPx: 4,
  tapSlopPx: 10,
  yawPerFullWidth: 2.1,
  zoomMax: 12,
  zoomMin: 1,
});

export const dampFactor = (ratePerSecond, deltaSeconds) => {
  if (!Number.isFinite(ratePerSecond) || !Number.isFinite(deltaSeconds) || ratePerSecond <= 0 || deltaSeconds <= 0) return 0;
  return 1 - Math.exp(-ratePerSecond * deltaSeconds);
};

export const decayVelocity = (velocity, deltaSeconds, decayPerSecond = coverageGlobeGesture.momentumDecayPerSecond) => {
  if (!Number.isFinite(velocity)) return 0;
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return velocity;
  return velocity * Math.exp(-decayPerSecond * deltaSeconds);
};

export const rotationDeltaFromPointer = ({ deltaX, deltaY, height, width }) => ({
  pitch: (Number(deltaY) / Math.max(Number(height) || 0, 1)) * coverageGlobeGesture.pitchPerFullHeight,
  yaw: (Number(deltaX) / Math.max(Number(width) || 0, 1)) * coverageGlobeGesture.yawPerFullWidth,
});

export const zoomFromPinch = ({ distance, startDistance, startZoom }) => {
  const safeDistance = Math.max(Number(distance) || 0, 1);
  const safeStartDistance = Math.max(Number(startDistance) || 0, 1);
  const ratio = safeDistance / safeStartDistance;
  const zoom = Number(startZoom) + Math.log2(ratio) * coverageGlobeGesture.pinchZoomPerOctave;
  return Math.min(Math.max(zoom, coverageGlobeGesture.zoomMin), coverageGlobeGesture.zoomMax);
};
