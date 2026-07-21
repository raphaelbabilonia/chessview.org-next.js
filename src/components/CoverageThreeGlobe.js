"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { geoEquirectangular, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import {
  coverageGlobeGesture,
  dampFactor,
  decayVelocity,
  globeCameraDistanceForZoom,
  orientationDegreesForStep,
  pointerPairAngle,
  rotationDeltaFromPointer,
  rotationSensitivityForZoom,
  shortestAngleDelta,
  zoomControlStep,
  zoomFromPinch,
} from "@/lib/coverageGlobeGesture";
import {
  coverageAdminBoundaries,
  coverageAdminBoundaryOpacity,
  coverageBoundaryCountry,
  decodedCoverageBoundaryLines,
  loadCoverageAdminBoundaries,
  normalizeCoverageCountryName,
  shouldLoadCoverageAdminBoundaries,
} from "@/lib/coverageAdminBoundaries";
import {
  coverageMarkerSizing,
  globeClusterMarkerRadiusPx,
  globeCountryMarkerRadiusPx,
  globeEventMarkerRadiusPx,
  markerFanoutOffset,
  surfaceBeadCenterRadius,
  worldUnitsPerPixel,
} from "@/lib/coverageMarkerSizing";
import {
  coverageCountryShadeIndex,
  coverageGlobeSurface,
  coverageGlobeTextureSize,
  normalizeCoverageAtlasFeature,
} from "@/lib/coverageGlobeSurface";
import { trackAnalyticsEvent } from "@/lib/tracking";

const GLOBE_RADIUS = 2.36;
const SURFACE_RADIUS = GLOBE_RADIUS + coverageGlobeSurface.lineLifts.boundary;
const ADMIN_BOUNDARY_RADIUS = GLOBE_RADIUS + coverageGlobeSurface.lineLifts.adminBoundary;
const LAND_BOUNDARY_OPACITY = 0.52;
const COARSE_MARKER_HIT_RADIUS_PX = 22;
const FINE_MARKER_HIT_RADIUS_PX = 8;
const HIT_TARGET_UPDATE_INTERVAL_MS = 1000 / 15;
const MOMENTUM_STALE_AFTER_MS = 90;
const MOMENTUM_STOP_RADIANS_PER_SECOND = 0.01;
const PERFORMANCE_PROBE_ENABLED = process.env.NEXT_PUBLIC_COVERAGE_MAP_PERFORMANCE_PROBE !== "false";
const typeColors = {
  blitz: "#ffb02e",
  classical: "#2f80ed",
  other: "#d977d8",
  rapid: "#20b26b",
};

let detailedWorldAtlasPromise;

const loadDetailedWorldAtlas = () => {
  if (!detailedWorldAtlasPromise) {
    detailedWorldAtlasPromise = import("world-atlas/countries-10m.json")
      .then((module) => module.default || module)
      .catch((error) => {
        detailedWorldAtlasPromise = undefined;
        throw error;
      });
  }
  return detailedWorldAtlasPromise;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const northUpQuaternionFor = (rotationTarget) => {
  const screenForward = new THREE.Vector3(0, 0, 1);
  const localCenter = screenForward.clone().applyQuaternion(rotationTarget.clone().invert()).normalize();
  const localNorth = new THREE.Vector3(0, 1, 0).addScaledVector(localCenter, -localCenter.y);

  if (localNorth.lengthSq() < 0.000001) {
    localNorth.set(0, 0, localCenter.y >= 0 ? -1 : 1);
  }
  localNorth.normalize();

  const northUp = new THREE.Quaternion().setFromUnitVectors(localCenter, screenForward);
  const projectedNorth = localNorth.applyQuaternion(northUp);
  const correction = Math.atan2(projectedNorth.x, projectedNorth.y);
  const correctionRotation = new THREE.Quaternion().setFromAxisAngle(screenForward, correction);
  return correctionRotation.multiply(northUp).normalize();
};

const quaternionDatasetValue = (quaternion) =>
  quaternion
    .toArray()
    .map((value) => value.toFixed(6))
    .join(",");

const supportsWebGl = () => {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
};

const cleanCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [longitude, latitude] = coordinates.map(Number);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return null;
  return [longitude, latitude];
};

const lonLatToVector3 = (coordinates, radius = GLOBE_RADIUS) => {
  const [longitude, latitude] = coordinates;
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
};

const averageCoordinates = (coordinatesList) => {
  const coordinates = coordinatesList.map(cleanCoordinates).filter(Boolean);
  if (!coordinates.length) return null;

  const vector = coordinates.reduce(
    (sum, [longitude, latitude]) => {
      const lat = THREE.MathUtils.degToRad(latitude);
      const lon = THREE.MathUtils.degToRad(longitude);
      sum.x += Math.cos(lat) * Math.cos(lon);
      sum.y += Math.cos(lat) * Math.sin(lon);
      sum.z += Math.sin(lat);
      return sum;
    },
    { x: 0, y: 0, z: 0 },
  );
  const longitude = THREE.MathUtils.radToDeg(Math.atan2(vector.y, vector.x));
  const hypotenuse = Math.hypot(vector.x, vector.y);
  const latitude = THREE.MathUtils.radToDeg(Math.atan2(vector.z, hypotenuse));

  return [Number(longitude.toFixed(4)), Number(latitude.toFixed(4))];
};

const pushLineSegment = (positions, first, second, radius = SURFACE_RADIUS) => {
  const firstCoordinates = cleanCoordinates(first);
  const secondCoordinates = cleanCoordinates(second);
  if (!firstCoordinates || !secondCoordinates) return;
  if (Math.abs(firstCoordinates[0] - secondCoordinates[0]) > 180) return;

  const start = lonLatToVector3(firstCoordinates, radius);
  const end = lonLatToVector3(secondCoordinates, radius);
  positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
};

const atlasCountries = (atlas) => feature(atlas, atlas.objects.countries).features;

const buildLandBoundaryPositions = (atlas = worldAtlas) => {
  const positions = [];

  for (const line of mesh(atlas, atlas.objects.countries).coordinates || []) {
    for (let index = 1; index < line.length; index += 1) {
      pushLineSegment(positions, line[index - 1], line[index]);
    }
  }

  return new Float32Array(positions);
};

const buildGraticulePositions = () => {
  const positions = [];

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    for (let longitude = -180; longitude < 180; longitude += 5) {
      pushLineSegment(
        positions,
        [longitude, latitude],
        [longitude + 5, latitude],
        GLOBE_RADIUS + coverageGlobeSurface.lineLifts.graticule,
      );
    }
  }

  for (let longitude = -150; longitude <= 180; longitude += 30) {
    for (let latitude = -85; latitude < 85; latitude += 5) {
      pushLineSegment(
        positions,
        [longitude, latitude],
        [longitude, latitude + 5],
        GLOBE_RADIUS + coverageGlobeSurface.lineLifts.graticule,
      );
    }
  }

  return new Float32Array(positions);
};

const buildGlobeSurfaceTexture = (renderer, quality, atlas = worldAtlas) => {
  const { height, width } = coverageGlobeTextureSize(quality);
  const canvas = document.createElement("canvas");
  canvas.height = height;
  canvas.width = width;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("The globe surface canvas is unavailable");

  context.fillStyle = coverageGlobeSurface.oceanColor;
  context.fillRect(0, 0, width, height);

  const projection = geoEquirectangular()
    .translate([width / 2, height / 2])
    .scale(width / (2 * Math.PI))
    .precision(0.1);
  const drawPath = geoPath(projection, context);
  const countries = atlasCountries(atlas);

  for (const country of countries) {
    const identity = country.id ?? country.properties?.name ?? "";
    const shade = coverageCountryShadeIndex(identity);
    context.beginPath();
    drawPath(normalizeCoverageAtlasFeature(country));
    context.fillStyle = coverageGlobeSurface.landPalette[shade];
    context.fill("evenodd");
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.name = "coverage-cartographic-surface";
  texture.needsUpdate = true;

  return { countryCount: countries.length, height, texture, width };
};

const createGlobeSurfaceMaterial = (texture, overrides = {}) =>
  new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0x010814,
    map: texture,
    ...overrides,
  });

const buildAdminBoundaryPositions = (lines) => {
  const positions = [];
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      pushLineSegment(positions, line[index - 1], line[index], ADMIN_BOUNDARY_RADIUS);
    }
  }
  return new Float32Array(positions);
};

const disposeObject = (object) => {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
};

const pointForObject = (object, camera, mapSize) => {
  if (!object) {
    return { x: mapSize.width / 2, y: mapSize.height / 2 };
  }

  const projected = object.getWorldPosition(new THREE.Vector3()).project(camera);
  return {
    x: Number((((projected.x + 1) / 2) * mapSize.width).toFixed(2)),
    y: Number((((1 - projected.y) / 2) * mapSize.height).toFixed(2)),
  };
};

const markerLabel = (marker, copy) => {
  if (marker.kind === "country") return `${marker.country.label}: ${marker.country.count} ${copy.coverage.tournaments}`;
  if (marker.kind === "cluster") return `${marker.count} ${copy.coverage.tournaments}: ${marker.countryLabels.slice(0, 4).join(", ")}`;
  return [marker.event.title, marker.event.city, marker.event.region, marker.event.countryLabel].filter(Boolean).join(", ");
};

const payloadForMarker = (marker) => {
  if (marker.kind === "country") {
    return {
      country: marker.country,
      kind: "country",
    };
  }

  if (marker.kind === "cluster") {
    return {
      cluster: marker.cluster,
      kind: "eventCluster",
    };
  }

  return {
    country: marker.event.country,
    event: marker.event,
    kind: "event",
  };
};

const trackMarkerSelection = (marker, input, trackedMarkerRef) => {
  const now = Date.now();
  if (trackedMarkerRef.current.key === marker.key && now - trackedMarkerRef.current.at < 500) return;
  trackedMarkerRef.current = { at: now, key: marker.key };

  const entity = marker.kind === "event" ? marker.event : marker.kind === "country" ? marker.country : null;
  trackAnalyticsEvent("coverage_marker_select", {
    entityId: entity?._id || entity?.countryKey,
    entitySlug: entity?.slug,
    entityType: marker.kind === "cluster" ? "event_cluster" : marker.kind,
    routeType: "coverage",
    metadata: {
      input,
      renderer: "3d",
    },
  });
};

export function CoverageThreeGlobe({
  autoRotate = true,
  copy,
  countries = [],
  focusTarget = null,
  items = [],
  keyboardCommand = null,
  mapSize,
  orientationCommand = null,
  onHover,
  onLeave,
  onPin,
  onPerformanceIssue,
  onReady,
  onUserInteraction,
  onUnavailable,
  onZoomChange,
  quality = "full",
  showCountryMarkers,
  zoom,
}) {
  const containerRef = useRef(null);
  const buttonRefs = useRef(new Map());
  const callbacksRef = useRef({ onHover, onLeave, onPerformanceIssue, onPin, onReady, onUnavailable, onUserInteraction, onZoomChange });
  const domActiveMarkerRef = useRef("");
  const autoRotateRef = useRef(autoRotate);
  const sceneRef = useRef(null);
  const trackedMarkerRef = useRef({ at: 0, key: "" });
  const zoomRef = useRef(zoom);
  const boundaryCountryNames = useMemo(
    () => (focusTarget?.view === "world" ? [] : [...new Set((focusTarget?.countryNames || []).filter(Boolean))]),
    [focusTarget],
  );
  const boundaryCountryMode = boundaryCountryNames.length > 0;
  const boundaryScopeKey = boundaryCountryMode
    ? boundaryCountryNames.map(normalizeCoverageCountryName).filter(Boolean).join("|")
    : "world";
  const boundariesShouldLoad = shouldLoadCoverageAdminBoundaries(zoom, boundaryCountryMode);

  const markers = useMemo(() => {
    if (showCountryMarkers) {
      return countries
        .map((country) => {
          const coordinates = cleanCoordinates(country.globeCoordinates);
          if (!coordinates) return null;

          return {
            color: "#ba9b4a",
            coordinates,
            count: country.count,
            country,
            key: `country-${country.countryKey}`,
            kind: "country",
            visualRadiusPx: globeCountryMarkerRadiusPx(country.count),
          };
        })
        .filter(Boolean);
    }

    return items
      .map((item) => {
        if (item.kind === "cluster") {
          const coordinates = averageCoordinates(item.events.map((event) => event.globeCoordinates));
          if (!coordinates) return null;

          return {
            cluster: item,
            color: "#ba9b4a",
            coordinates,
            count: item.count,
            countryLabels: item.countryLabels,
            key: item.key,
            kind: "cluster",
            visualRadiusPx: globeClusterMarkerRadiusPx(item.count),
          };
        }

        const coordinates = cleanCoordinates(item.event.globeCoordinates);
        if (!coordinates) return null;

        return {
          color: typeColors[item.event.tournamentType] || typeColors.other,
          coordinates,
          event: item.event,
          fanout: markerFanoutOffset(item.event),
          key: item.key,
          kind: "event",
          visualRadiusPx: globeEventMarkerRadiusPx(item.densityScale),
        };
      })
      .filter(Boolean);
  }, [countries, items, showCountryMarkers]);

  useEffect(() => {
    callbacksRef.current = { onHover, onLeave, onPerformanceIssue, onPin, onReady, onUnavailable, onUserInteraction, onZoomChange };
  }, [onHover, onLeave, onPerformanceIssue, onPin, onReady, onUnavailable, onUserInteraction, onZoomChange]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    zoomRef.current = zoom;
    const interaction = sceneRef.current?.interaction;
    if (interaction && interaction.mode !== "pinching") {
      interaction.zoomTarget = zoom;
      interaction.hitTargetsDirty = true;
      if (containerRef.current) containerRef.current.dataset.coverageZoomTarget = zoom.toFixed(3);
    }
  }, [zoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    if (!supportsWebGl()) {
      callbacksRef.current.onUnavailable?.("webgl-missing");
      return undefined;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    let renderer;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: quality !== "reduced",
        powerPreference: quality === "reduced" ? "low-power" : "high-performance",
      });
    } catch {
      callbacksRef.current.onUnavailable?.("init-error");
      return undefined;
    }

    renderer.domElement.className = "coverage-globe-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(quality === "reduced" ? 1 : Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.5 : 2));
    container.appendChild(renderer.domElement);

    let globeSurface;
    try {
      globeSurface = buildGlobeSurfaceTexture(renderer, quality);
    } catch {
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
      callbacksRef.current.onUnavailable?.("surface-error");
      return undefined;
    }

    container.dataset.coverageSurfaceCountries = String(globeSurface.countryCount);
    container.dataset.coverageSurfaceDetail = "coarse";
    container.dataset.coverageSurfaceStyle = coverageGlobeSurface.style;
    container.dataset.coverageSurfaceTexture = `${globeSurface.width}x${globeSurface.height}`;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0, 7.2);

    const globeGroup = new THREE.Group();
    globeGroup.rotation.set(-0.14, -0.36, 0);
    scene.add(globeGroup);

    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, quality === "reduced" ? 64 : 96, quality === "reduced" ? 40 : 64),
      createGlobeSurfaceMaterial(globeSurface.texture),
    );
    ocean.renderOrder = 0;
    globeGroup.add(ocean);

    if (quality !== "reduced") {
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS + 0.055, 96, 64),
        new THREE.MeshBasicMaterial({
          color: 0x78a4c4,
          opacity: 0.075,
          side: THREE.BackSide,
          transparent: true,
        }),
      );
      globeGroup.add(atmosphere);
    }

    const graticule = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(buildGraticulePositions(), 3)),
      new THREE.LineBasicMaterial({ color: 0xb9ccdc, depthWrite: false, opacity: 0.1, transparent: true }),
    );
    globeGroup.add(graticule);

    const landBoundaries = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(buildLandBoundaryPositions(), 3)),
      new THREE.LineBasicMaterial({ color: 0xd9e6f0, depthWrite: false, opacity: LAND_BOUNDARY_OPACITY, transparent: true }),
    );
    globeGroup.add(landBoundaries);

    const adminBoundaryGroup = new THREE.Group();
    globeGroup.add(adminBoundaryGroup);

    const markerGroup = new THREE.Group();
    globeGroup.add(markerGroup);

    scene.add(new THREE.AmbientLight(0xeaf3fa, 0.78));
    const keyLight = new THREE.DirectionalLight(0xf4f8fb, 0.48);
    keyLight.position.set(2.4, 3, 5.5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x6f96b4, 0.28);
    rimLight.position.set(-4.5, -1.8, 2.4);
    scene.add(rimLight);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const cameraDirection = new THREE.Vector3();
    const markerAnchorWorld = new THREE.Vector3();
    const markerDirection = new THREE.Vector3();
    const markerProjectedPosition = new THREE.Vector3();
    const markerWorldPosition = new THREE.Vector3();
    const screenPitchAxis = new THREE.Vector3(1, 0, 0);
    const screenRollAxis = new THREE.Vector3(0, 0, 1);
    const screenYawAxis = new THREE.Vector3(0, 1, 0);
    const screenPitchRotation = new THREE.Quaternion();
    const screenRollRotation = new THREE.Quaternion();
    const screenYawRotation = new THREE.Quaternion();
    const hoveredRef = { object: null };
    const activePointers = new Map();
    let pinchState = null;
    let pendingActivation = null;
    let usedMultiTouch = false;
    const interaction = {
      hitTargetsDirty: true,
      lastFrameTime: 0,
      lastHitTargetUpdate: 0,
      mode: "idle",
      momentumPitch: 0,
      momentumYaw: 0,
      pendingZoomReport: null,
      rotationTarget: globeGroup.quaternion.clone(),
      zoomTarget: zoomRef.current,
    };
    const performanceProbe = {
      elapsed: 0,
      frames: 0,
      lastTime: 0,
      ready: false,
      reported: quality === "reduced",
      slowFrames: 0,
      totalDelta: 0,
    };
    const dragState = {
      lastTime: 0,
      moved: 0,
      pointerId: null,
      rotationTarget: globeGroup.quaternion.clone(),
      startX: 0,
      startY: 0,
      startObject: null,
      x: 0,
      y: 0,
    };

    const stopAutoRotate = (input) => {
      if (autoRotateRef.current) {
        autoRotateRef.current = false;
        trackAnalyticsEvent("coverage_map_interaction", {
          routeType: "coverage",
          metadata: {
            input,
            renderer: "3d",
          },
        });
      }
      if (input === "pointer" || input === "touch") {
        container.dataset.coverageOrientationStep = "manual";
      }
      callbacksRef.current.onUserInteraction?.({ input });
    };

    const eventPoint = (event) => ({
      x: event.clientX,
      y: event.clientY,
    });

    const setGestureMode = (mode) => {
      interaction.mode = mode;
      container.dataset.coverageGestureMode = mode;
    };

    const resetMomentum = () => {
      interaction.momentumPitch = 0;
      interaction.momentumYaw = 0;
      if (container.dataset.coverageMomentum !== "none") container.dataset.coverageMomentum = "none";
    };

    const syncOrientationDataset = () => {
      container.dataset.coverageOrientation = interaction.rotationTarget
        .toArray()
        .map((value) => value.toFixed(6))
        .join(",");
    };

    const applyRotationDelta = (pitch, yaw, syncDataset = true) => {
      if (yaw) {
        screenYawRotation.setFromAxisAngle(screenYawAxis, yaw);
        interaction.rotationTarget.premultiply(screenYawRotation);
      }
      if (pitch) {
        screenPitchRotation.setFromAxisAngle(screenPitchAxis, pitch);
        interaction.rotationTarget.premultiply(screenPitchRotation);
      }
      interaction.rotationTarget.normalize();
      if (syncDataset) syncOrientationDataset();
    };

    const commitPinchZoom = () => {
      if (!pinchState) return;
      interaction.pendingZoomReport = null;
      callbacksRef.current.onZoomChange?.(interaction.zoomTarget, {
        input: "pinch",
        phase: "commit",
        startZoom: pinchState.startZoom,
      });
    };

    const startPinch = () => {
      const points = [...activePointers.values()];
      if (points.length < 2) {
        pinchState = null;
        return;
      }

      const startAngle = pointerPairAngle(points[0], points[1]);
      pinchState = {
        didTwist: false,
        didZoom: false,
        startAngle,
        startDistance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
        startRotationTarget: interaction.rotationTarget.clone(),
        startZoom: interaction.zoomTarget,
      };
      pendingActivation = null;
      resetMomentum();
      setGestureMode("pinching");
      dragState.pointerId = null;
      dragState.startObject = null;
      interaction.hitTargetsDirty = true;
    };

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      interaction.hitTargetsDirty = true;
    };

    const isFrontFacing = (worldPosition) => {
      cameraDirection.copy(camera.position).normalize();
      return worldPosition.dot(cameraDirection) / Math.max(worldPosition.length(), 0.0001) > 0.03;
    };

    const raycast = (event, useCoarseHitArea = false) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const objects = sceneRef.current?.markerObjects || [];
      const preciseMatch =
        raycaster
          .intersectObjects(objects, false)
          .find(({ object }) => {
            object.getWorldPosition(markerWorldPosition);
            return isFrontFacing(markerWorldPosition);
          })?.object || null;
      if (preciseMatch) return preciseMatch;

      let closestObject = null;
      let closestDistance = useCoarseHitArea ? COARSE_MARKER_HIT_RADIUS_PX : FINE_MARKER_HIT_RADIUS_PX;

      for (const object of objects) {
        object.getWorldPosition(markerWorldPosition);
        if (!isFrontFacing(markerWorldPosition)) continue;

        markerProjectedPosition.copy(markerWorldPosition).project(camera);
        if (markerProjectedPosition.z >= 1) continue;

        const markerX = bounds.left + ((markerProjectedPosition.x + 1) / 2) * bounds.width;
        const markerY = bounds.top + ((1 - markerProjectedPosition.y) / 2) * bounds.height;
        const distance = Math.hypot(event.clientX - markerX, event.clientY - markerY);
        if (distance > closestDistance) continue;

        closestDistance = distance;
        closestObject = object;
      }

      return closestObject;
    };

    const updateMarkerMeshes = () => {
      const objects = sceneRef.current?.markerObjects || [];
      if (!objects.length) return;

      const viewportHeight = Math.max(renderer.domElement.clientHeight, 1);
      globeGroup.updateMatrixWorld(true);

      for (const object of objects) {
        const { baseNormal, east, fanout, marker, north } = object.userData;
        if (!baseNormal || !east || !marker || !north) continue;

        markerAnchorWorld.copy(baseNormal).multiplyScalar(GLOBE_RADIUS).applyMatrix4(globeGroup.matrixWorld);
        const unitsPerPixel = worldUnitsPerPixel({
          distance: camera.position.distanceTo(markerAnchorWorld),
          fovDegrees: camera.fov,
          viewportHeight,
        });
        const isActive = hoveredRef.object === object || domActiveMarkerRef.current === marker.key;
        const visualRadiusPx = marker.visualRadiusPx * (isActive ? coverageMarkerSizing.hoverScale : 1);
        const beadRadius = Math.max(unitsPerPixel * visualRadiusPx, 0.0001);

        markerDirection.copy(baseNormal);
        if (fanout?.x || fanout?.y) {
          const tangentScale = unitsPerPixel / GLOBE_RADIUS;
          markerDirection.addScaledVector(east, fanout.x * tangentScale);
          markerDirection.addScaledVector(north, -fanout.y * tangentScale);
          markerDirection.normalize();
        }

        object.position
          .copy(markerDirection)
          .multiplyScalar(surfaceBeadCenterRadius({ beadRadius, globeRadius: GLOBE_RADIUS }));
        object.scale.setScalar(beadRadius);
      }
    };

    const updateAdminBoundaries = () => {
      const currentState = sceneRef.current;
      if (!currentState) return;
      const fade = coverageAdminBoundaryOpacity(interaction.zoomTarget, currentState.adminBoundaryCountryMode);
      const worldOutlineLine = currentState.worldOutlineLine;
      if (worldOutlineLine) {
        currentState.landBoundaries.visible = fade < 1;
        currentState.landBoundaries.material.opacity = LAND_BOUNDARY_OPACITY * (1 - fade);
        worldOutlineLine.visible = fade > 0;
        worldOutlineLine.material.opacity = LAND_BOUNDARY_OPACITY * fade;
      }
      const detailedSurface = currentState.detailedSurface;
      if (detailedSurface) {
        detailedSurface.visible = fade > 0;
        detailedSurface.material.opacity = fade;
      }

      const boundaryLine = currentState?.adminBoundaryLine;
      if (!boundaryLine) return;
      boundaryLine.visible = fade > 0;
      boundaryLine.material.opacity = coverageAdminBoundaries.globeOpacity * fade;
      const boundaryState = fade <= 0 ? "hidden" : fade >= 1 ? "visible" : "fading";
      if (container.dataset.coverageAdminBoundaries !== boundaryState) {
        container.dataset.coverageAdminBoundaries = boundaryState;
      }
    };

    const markerPayload = (object) => {
      const marker = object?.userData?.marker;
      if (!marker) return null;
      return {
        ...payloadForMarker(marker),
        point: pointForObject(object, camera, mapSize),
      };
    };

    const setInteractiveObject = (object) => {
      if (hoveredRef.object === object) return;
      const previousObject = hoveredRef.object;
      hoveredRef.object = object;
      if (previousObject) callbacksRef.current.onLeave?.();

      if (!object) {
        renderer.domElement.style.cursor = activePointers.size ? "grabbing" : "grab";
        return;
      }

      renderer.domElement.style.cursor = "pointer";
      const payload = markerPayload(object);
      if (payload) callbacksRef.current.onHover?.(payload);
    };

    const updateHitTargets = () => {
      cameraDirection.copy(camera.position).normalize();

      for (const marker of sceneRef.current?.markerDefinitions || []) {
        const button = buttonRefs.current.get(marker.key);
        const object = sceneRef.current?.markerByKey.get(marker.key);
        if (!button || !object) continue;

        object.getWorldPosition(markerWorldPosition);
        const facingCamera = markerWorldPosition.dot(cameraDirection) / Math.max(markerWorldPosition.length(), 0.0001) > 0.03;
        markerProjectedPosition.copy(markerWorldPosition).project(camera);
        const visible =
          facingCamera &&
          markerProjectedPosition.z < 1 &&
          markerProjectedPosition.x >= -0.96 &&
          markerProjectedPosition.x <= 0.96 &&
          markerProjectedPosition.y >= -0.84 &&
          markerProjectedPosition.y <= 0.94;

        button.hidden = !visible;
        if (!visible) continue;

        button.style.left = `${((markerProjectedPosition.x + 1) / 2) * 100}%`;
        button.style.top = `${((1 - markerProjectedPosition.y) / 2) * 100}%`;
      }

      interaction.hitTargetsDirty = false;
    };

    const reportPerformanceIssue = () => {
      if (!PERFORMANCE_PROBE_ENABLED || performanceProbe.reported) return;
      performanceProbe.reported = true;
      callbacksRef.current.onPerformanceIssue?.("low-fps");
    };

    const measurePerformance = (time) => {
      if (document.visibilityState !== "visible") {
        performanceProbe.lastTime = time;
        return;
      }

      if (!performanceProbe.ready) {
        performanceProbe.ready = true;
        performanceProbe.lastTime = time;
        callbacksRef.current.onReady?.();
        return;
      }

      if (!PERFORMANCE_PROBE_ENABLED || performanceProbe.reported) return;

      const delta = time - performanceProbe.lastTime;
      performanceProbe.lastTime = time;
      if (delta <= 0 || delta > 1000) return;

      performanceProbe.elapsed += delta;
      performanceProbe.frames += 1;
      performanceProbe.totalDelta += delta;
      if (delta > 150) performanceProbe.slowFrames += 1;

      if (performanceProbe.elapsed < 3000 || performanceProbe.frames < 20) return;

      const averageFps = performanceProbe.frames / (performanceProbe.totalDelta / 1000);
      if (averageFps < 24 || performanceProbe.slowFrames > 6) {
        reportPerformanceIssue();
        return;
      }

      performanceProbe.reported = true;
    };

    const animate = (time) => {
      const state = sceneRef.current;
      state.frame = window.requestAnimationFrame(animate);
      const deltaSeconds = interaction.lastFrameTime ? clamp((time - interaction.lastFrameTime) / 1000, 0, 0.05) : 1 / 60;
      interaction.lastFrameTime = time;

      const targetDistance = globeCameraDistanceForZoom(interaction.zoomTarget, GLOBE_RADIUS);
      const zoomDamping = dampFactor(coverageGlobeGesture.zoomDampingPerSecond, deltaSeconds);
      camera.position.z += (targetDistance - camera.position.z) * zoomDamping;
      const rotationSensitivity = rotationSensitivityForZoom(interaction.zoomTarget).toFixed(3);
      if (container.dataset.coverageRotationSensitivity !== rotationSensitivity) {
        container.dataset.coverageRotationSensitivity = rotationSensitivity;
      }

      const isAutoRotating = autoRotateRef.current && !reducedMotion && interaction.mode === "idle" && !hoveredRef.object && !domActiveMarkerRef.current;
      if (isAutoRotating) {
        applyRotationDelta(0, 0.072 * deltaSeconds, false);
      }

      if (interaction.mode === "idle" && (Math.abs(interaction.momentumYaw) > MOMENTUM_STOP_RADIANS_PER_SECOND || Math.abs(interaction.momentumPitch) > MOMENTUM_STOP_RADIANS_PER_SECOND)) {
        applyRotationDelta(interaction.momentumPitch * deltaSeconds, interaction.momentumYaw * deltaSeconds, false);
        interaction.momentumYaw = decayVelocity(interaction.momentumYaw, deltaSeconds);
        interaction.momentumPitch = decayVelocity(interaction.momentumPitch, deltaSeconds);
      } else if (interaction.mode === "idle") {
        resetMomentum();
      }

      const rotationDamping = dampFactor(coverageGlobeGesture.rotationDampingPerSecond, deltaSeconds);
      globeGroup.quaternion.slerp(interaction.rotationTarget, rotationDamping);
      const rotationMoving =
        globeGroup.quaternion.angleTo(interaction.rotationTarget) > 0.0001 ||
        Math.abs(interaction.momentumPitch) > MOMENTUM_STOP_RADIANS_PER_SECOND ||
        Math.abs(interaction.momentumYaw) > MOMENTUM_STOP_RADIANS_PER_SECOND ||
        isAutoRotating;
      const zoomMoving = Math.abs(targetDistance - camera.position.z) > 0.001;
      if (rotationMoving || zoomMoving) interaction.hitTargetsDirty = true;

      updateMarkerMeshes();
      updateAdminBoundaries();
      renderer.render(scene, camera);
      if (
        interaction.hitTargetsDirty &&
        activePointers.size === 0 &&
        time - interaction.lastHitTargetUpdate >= HIT_TARGET_UPDATE_INTERVAL_MS
      ) {
        updateHitTargets();
        interaction.lastHitTargetUpdate = time;
      }

      if (interaction.pendingZoomReport) {
        const report = interaction.pendingZoomReport;
        interaction.pendingZoomReport = null;
        callbacksRef.current.onZoomChange?.(report.zoom, report.metadata);
      }

      measurePerformance(time);
    };

    const onPointerDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (activePointers.size === 0) usedMultiTouch = false;
      pendingActivation = null;
      stopAutoRotate(event.pointerType === "touch" ? "touch" : "pointer");
      activePointers.set(event.pointerId, eventPoint(event));
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture can fail if the browser has already retargeted focus.
      }

      if (activePointers.size >= 2) {
        usedMultiTouch = true;
        startPinch();
        setInteractiveObject(null);
        renderer.domElement.style.cursor = "grabbing";
        return;
      }

      resetMomentum();
      setGestureMode("pending-rotation");
      dragState.lastTime = event.timeStamp;
      dragState.moved = 0;
      dragState.pointerId = event.pointerId;
      dragState.rotationTarget.copy(interaction.rotationTarget);
      dragState.startObject = raycast(event, event.pointerType === "touch");
      dragState.startX = event.clientX;
      dragState.startY = event.clientY;
      dragState.x = event.clientX;
      dragState.y = event.clientY;
      renderer.domElement.style.cursor = "grabbing";
    };

    const onPointerMove = (event) => {
      if (activePointers.has(event.pointerId)) {
        activePointers.set(event.pointerId, eventPoint(event));
      }

      if (activePointers.size >= 2) {
        usedMultiTouch = true;
        const points = [...activePointers.values()];
        if (interaction.mode !== "pinching" || !pinchState) startPinch();
        if (pinchState) {
          const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
          if (pinchState.didZoom || Math.abs(distance - pinchState.startDistance) > coverageGlobeGesture.pinchDeadZonePx) {
            pinchState.didZoom = true;
            const nextZoom = zoomFromPinch({
              distance,
              startDistance: pinchState.startDistance,
              startZoom: pinchState.startZoom,
            });
            interaction.zoomTarget = nextZoom;
            interaction.pendingZoomReport = {
              metadata: {
                input: "pinch",
                phase: "update",
                startZoom: pinchState.startZoom,
              },
              zoom: nextZoom,
            };
            container.dataset.coverageZoomTarget = nextZoom.toFixed(3);
            interaction.hitTargetsDirty = true;
          }

          const currentAngle = pointerPairAngle(points[0], points[1]);
          const twistDelta = shortestAngleDelta(currentAngle, pinchState.startAngle);
          if (pinchState.didTwist || Math.abs(twistDelta) > coverageGlobeGesture.twistDeadZoneRadians) {
            pinchState.didTwist = true;
            interaction.rotationTarget.copy(pinchState.startRotationTarget);
            if (twistDelta) {
              screenRollRotation.setFromAxisAngle(screenRollAxis, -twistDelta);
              interaction.rotationTarget.premultiply(screenRollRotation).normalize();
            }
            syncOrientationDataset();
            interaction.hitTargetsDirty = true;
          }
          setInteractiveObject(null);
        }
        return;
      }

      if (dragState.pointerId === event.pointerId && activePointers.has(event.pointerId)) {
        const totalDistance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
        dragState.moved = Math.max(dragState.moved, totalDistance);

        if (interaction.mode === "pending-rotation" && dragState.moved <= coverageGlobeGesture.rotationStartPx) return;

        const startingRotation = interaction.mode === "pending-rotation";
        if (startingRotation) setGestureMode("rotating");
        const deltaX = event.clientX - (startingRotation ? dragState.startX : dragState.x);
        const deltaY = event.clientY - (startingRotation ? dragState.startY : dragState.y);
        const deltaSeconds = clamp((event.timeStamp - dragState.lastTime) / 1000, 1 / 240, 0.08);
        dragState.x = event.clientX;
        dragState.y = event.clientY;
        dragState.lastTime = event.timeStamp;

        const bounds = renderer.domElement.getBoundingClientRect();
        const rotationDelta = rotationDeltaFromPointer({
          deltaX,
          deltaY,
          height: bounds.height,
          width: bounds.width,
          zoom: interaction.zoomTarget,
        });
        applyRotationDelta(rotationDelta.pitch, rotationDelta.yaw);
        const momentumBlend = dampFactor(coverageGlobeGesture.momentumTrackingPerSecond, deltaSeconds);
        const momentumMax = coverageGlobeGesture.momentumMaxRadiansPerSecond * rotationSensitivityForZoom(interaction.zoomTarget);
        interaction.momentumYaw = clamp(
          interaction.momentumYaw + (rotationDelta.yaw / deltaSeconds - interaction.momentumYaw) * momentumBlend,
          -momentumMax,
          momentumMax,
        );
        interaction.momentumPitch = clamp(
          interaction.momentumPitch + (rotationDelta.pitch / deltaSeconds - interaction.momentumPitch) * momentumBlend,
          -momentumMax,
          momentumMax,
        );
        if (
          container.dataset.coverageMomentum !== "active" &&
          (Math.abs(interaction.momentumPitch) > MOMENTUM_STOP_RADIANS_PER_SECOND ||
            Math.abs(interaction.momentumYaw) > MOMENTUM_STOP_RADIANS_PER_SECOND)
        ) {
          container.dataset.coverageMomentum = "active";
        }
        interaction.hitTargetsDirty = true;
        setInteractiveObject(null);
        return;
      }

      setInteractiveObject(raycast(event));
    };

    const onPointerUp = (event) => {
      const wasPinching = interaction.mode === "pinching";
      const wasRotating = interaction.mode === "rotating";
      const isGesturePointer = !wasPinching && dragState.pointerId === event.pointerId;
      const startObject = dragState.startObject;
      const endObject = isGesturePointer ? raycast(event, event.pointerType === "touch") : null;
      const canActivate =
        isGesturePointer &&
        !usedMultiTouch &&
        dragState.moved <= coverageGlobeGesture.tapSlopPx &&
        startObject &&
        endObject === startObject;

      try {
        if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId);
        }
      } catch {
        // The click fallback below still handles activation if capture is gone.
      }
      activePointers.delete(event.pointerId);
      renderer.domElement.style.cursor = "grab";

      if (wasPinching && activePointers.size < 2) commitPinchZoom();
      pinchState = null;
      if (canActivate) {
        interaction.rotationTarget.copy(dragState.rotationTarget);
        syncOrientationDataset();
      }
      const hasFreshMomentum = event.timeStamp - dragState.lastTime <= MOMENTUM_STALE_AFTER_MS;
      if (!wasRotating || canActivate || reducedMotion || !hasFreshMomentum) resetMomentum();

      pendingActivation = canActivate
        ? {
            input: event.pointerType === "touch" ? "touch" : "pointer",
            object: endObject,
          }
        : null;

      if (activePointers.size >= 2) {
        startPinch();
      } else if (activePointers.size === 1) {
        const [remainingPoint] = activePointers.values();
        setGestureMode("pending-rotation");
        resetMomentum();
        dragState.lastTime = event.timeStamp;
        dragState.moved = 0;
        dragState.pointerId = [...activePointers.keys()][0];
        dragState.rotationTarget.copy(interaction.rotationTarget);
        dragState.startObject = null;
        dragState.startX = remainingPoint.x;
        dragState.startY = remainingPoint.y;
        dragState.x = remainingPoint.x;
        dragState.y = remainingPoint.y;
      } else {
        setGestureMode("idle");
        dragState.pointerId = null;
        dragState.startObject = null;
      }
      interaction.hitTargetsDirty = true;
    };

    const onPointerCancel = () => {
      pendingActivation = null;
      usedMultiTouch = true;

      for (const pointerId of activePointers.keys()) {
        try {
          if (renderer.domElement.hasPointerCapture?.(pointerId)) {
            renderer.domElement.releasePointerCapture(pointerId);
          }
        } catch {
          // Pointer capture may already have been released by the browser.
        }
      }

      activePointers.clear();
      if (interaction.pendingZoomReport) {
        callbacksRef.current.onZoomChange?.(interaction.zoomTarget, interaction.pendingZoomReport.metadata);
      }
      interaction.pendingZoomReport = null;
      pinchState = null;
      dragState.moved = 0;
      dragState.pointerId = null;
      dragState.startObject = null;
      resetMomentum();
      setGestureMode("idle");
      interaction.hitTargetsDirty = true;
      renderer.domElement.style.cursor = "grab";
      setInteractiveObject(null);
    };

    const onCanvasClick = () => {
      const activation = pendingActivation;
      pendingActivation = null;
      if (!activation) return;

      const payload = markerPayload(activation.object);
      if (payload) {
        trackMarkerSelection(activation.object.userData.marker, activation.input, trackedMarkerRef);
        callbacksRef.current.onPin?.(payload);
      }
    };

    const onPointerLeave = () => {
      if (!activePointers.size) setInteractiveObject(null);
    };

    const onWheel = (event) => {
      event.preventDefault();
      stopAutoRotate("wheel");
      const delta = clamp(event.deltaY, -160, 160);
      const startZoom = interaction.zoomTarget;
      interaction.zoomTarget = clamp(startZoom - delta * 0.0045, coverageGlobeGesture.zoomMin, coverageGlobeGesture.zoomMax);
      interaction.hitTargetsDirty = true;
      container.dataset.coverageZoomTarget = interaction.zoomTarget.toFixed(3);
      callbacksRef.current.onZoomChange?.(interaction.zoomTarget, { input: "wheel", phase: "commit", startZoom });
    };

    const onDoubleClick = (event) => {
      event.preventDefault();
      stopAutoRotate("double_click");
      const startZoom = interaction.zoomTarget;
      const step = zoomControlStep(startZoom, 0.85);
      interaction.zoomTarget = clamp(startZoom + (event.shiftKey ? -step : step), coverageGlobeGesture.zoomMin, coverageGlobeGesture.zoomMax);
      interaction.hitTargetsDirty = true;
      container.dataset.coverageZoomTarget = interaction.zoomTarget.toFixed(3);
      callbacksRef.current.onZoomChange?.(interaction.zoomTarget, { input: "double_click", phase: "commit", startZoom });
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerCancel);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("click", onCanvasClick);
    renderer.domElement.addEventListener("dblclick", onDoubleClick);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.style.cursor = "grab";

    const onContextLost = (event) => {
      event.preventDefault();
      callbacksRef.current.onUnavailable?.("context-lost");
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    sceneRef.current = {
      adminBoundaryGroup,
      adminBoundaryLine: null,
      adminBoundaryCountryMode: false,
      adminBoundaryLoadScope: "",
      adminBoundaryScope: "",
      camera,
      detailedSurface: null,
      detailedSurfaceTexture: null,
      frame: 0,
      globeGroup,
      initialQuaternion: globeGroup.quaternion.clone(),
      interaction,
      landBoundaries,
      markerByKey: new Map(),
      markerDefinitions: [],
      markerGroup,
      markerObjects: [],
      renderer,
      reducedMotion,
      scene,
      worldOutlineLine: null,
    };
    setGestureMode("idle");
    resetMomentum();
    syncOrientationDataset();
    container.dataset.coverageOrientationStep = "manual";
    container.dataset.coverageZoomTarget = interaction.zoomTarget.toFixed(3);
    sceneRef.current.frame = window.requestAnimationFrame(animate);

    return () => {
      const state = sceneRef.current;
      if (state?.frame) window.cancelAnimationFrame(state.frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      disposeObject(scene);
      state?.detailedSurfaceTexture?.dispose();
      globeSurface.texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
      delete container.dataset.coverageGestureMode;
      delete container.dataset.coverageAdminBoundaries;
      delete container.dataset.coverageAdminBoundaryRegions;
      delete container.dataset.coverageAdminBoundaryScope;
      delete container.dataset.coverageWorldBoundaries;
      delete container.dataset.coverageWorldOutlineCountries;
      delete container.dataset.coverageMomentum;
      delete container.dataset.coverageOrientationStep;
      delete container.dataset.coverageRotationSensitivity;
      delete container.dataset.coverageSurfaceCountries;
      delete container.dataset.coverageSurfaceDetail;
      delete container.dataset.coverageSurfaceDetailCountries;
      delete container.dataset.coverageSurfaceStyle;
      delete container.dataset.coverageSurfaceTexture;
      delete container.dataset.coverageZoomTarget;
      sceneRef.current = null;
    };
  }, [mapSize, quality]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state || !focusTarget) return;

    const targetQuaternion = state.initialQuaternion.clone();
    const coordinates = cleanCoordinates(focusTarget.coordinates);
    if (focusTarget.view !== "world" && coordinates) {
      const direction = lonLatToVector3(coordinates, 1).normalize();
      targetQuaternion.setFromUnitVectors(direction, new THREE.Vector3(0, 0, 1));
    }

    state.interaction.rotationTarget.copy(targetQuaternion);
    state.interaction.momentumPitch = 0;
    state.interaction.momentumYaw = 0;
    state.interaction.hitTargetsDirty = true;
    if (containerRef.current) {
      containerRef.current.dataset.coverageOrientation = quaternionDatasetValue(targetQuaternion);
      containerRef.current.dataset.coverageOrientationStep = "manual";
    }
    if (state.reducedMotion) state.globeGroup.quaternion.copy(targetQuaternion);
  }, [focusTarget, quality]);

  useEffect(() => {
    const container = containerRef.current;
    const state = sceneRef.current;
    if (!container || !state || !orientationCommand) return;

    const northUp = northUpQuaternionFor(state.interaction.rotationTarget);
    const roll = THREE.MathUtils.degToRad(orientationDegreesForStep(orientationCommand.step));
    const rollRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -roll);
    const targetQuaternion = rollRotation.multiply(northUp).normalize();

    state.interaction.rotationTarget.copy(targetQuaternion);
    state.interaction.momentumPitch = 0;
    state.interaction.momentumYaw = 0;
    state.interaction.hitTargetsDirty = true;
    container.dataset.coverageMomentum = "none";
    container.dataset.coverageOrientation = quaternionDatasetValue(targetQuaternion);
    container.dataset.coverageOrientationStep = String(orientationCommand.step);
    if (state.reducedMotion) state.globeGroup.quaternion.copy(targetQuaternion);
  }, [orientationCommand]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state || !keyboardCommand) return;

    const sensitivity = rotationSensitivityForZoom(state.interaction.zoomTarget);
    const yaw = Number(keyboardCommand.yaw || 0) * sensitivity;
    const pitch = Number(keyboardCommand.pitch || 0) * sensitivity;
    if (!yaw && !pitch) return;

    const yawRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const pitchRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
    state.interaction.rotationTarget.premultiply(yawRotation).premultiply(pitchRotation).normalize();
    state.interaction.momentumPitch = 0;
    state.interaction.momentumYaw = 0;
    state.interaction.hitTargetsDirty = true;
    if (containerRef.current) {
      containerRef.current.dataset.coverageOrientation = quaternionDatasetValue(state.interaction.rotationTarget);
      containerRef.current.dataset.coverageOrientationStep = "manual";
    }
    if (state.reducedMotion) state.globeGroup.quaternion.copy(state.interaction.rotationTarget);
  }, [keyboardCommand]);

  useEffect(() => {
    const container = containerRef.current;
    const state = sceneRef.current;
    if (!container || !state) return undefined;

    const clearBoundaryLine = () => {
      if (!state.adminBoundaryLine) return;
      state.adminBoundaryGroup.remove(state.adminBoundaryLine);
      disposeObject(state.adminBoundaryLine);
      state.adminBoundaryLine = null;
    };

    if (!boundariesShouldLoad) {
      clearBoundaryLine();
      state.adminBoundaryCountryMode = boundaryCountryMode;
      state.adminBoundaryLoadScope = "";
      state.adminBoundaryScope = "";
      container.dataset.coverageAdminBoundaries = "hidden";
      delete container.dataset.coverageAdminBoundaryRegions;
      delete container.dataset.coverageAdminBoundaryScope;
      return undefined;
    }

    if (state.adminBoundaryScope === boundaryScopeKey) return undefined;
    if (state.adminBoundaryLoadScope === boundaryScopeKey) return undefined;

    clearBoundaryLine();
    state.adminBoundaryCountryMode = boundaryCountryMode;
    state.adminBoundaryLoadScope = boundaryScopeKey;
    state.adminBoundaryScope = "";
    let active = true;
    container.dataset.coverageAdminBoundaries = "loading";
    container.dataset.coverageAdminBoundaryScope = boundaryScopeKey;
    if (!state.detailedSurface) container.dataset.coverageSurfaceDetail = "loading";
    delete container.dataset.coverageAdminBoundaryRegions;
    Promise.all([loadCoverageAdminBoundaries(), loadDetailedWorldAtlas()])
      .then(([data, detailedAtlas]) => {
        if (!active || sceneRef.current !== state || state.adminBoundaryLoadScope !== boundaryScopeKey) return;

        if (!state.detailedSurface) {
          const detailedSurfaceData = buildGlobeSurfaceTexture(state.renderer, quality, detailedAtlas);
          const detailedSurface = new THREE.Mesh(
            new THREE.SphereGeometry(
              GLOBE_RADIUS + coverageGlobeSurface.lineLifts.detailedSurface,
              quality === "reduced" ? 64 : 96,
              quality === "reduced" ? 40 : 64,
            ),
            createGlobeSurfaceMaterial(detailedSurfaceData.texture, {
              depthWrite: false,
              opacity: 0,
              transparent: true,
            }),
          );
          detailedSurface.renderOrder = 1;
          detailedSurface.visible = false;
          state.globeGroup.add(detailedSurface);
          state.detailedSurface = detailedSurface;
          state.detailedSurfaceTexture = detailedSurfaceData.texture;
          container.dataset.coverageSurfaceDetail = "aligned";
          container.dataset.coverageSurfaceDetailCountries = String(detailedSurfaceData.countryCount);
        }

        if (!state.worldOutlineLine) {
          const detailedWorldPositions = buildLandBoundaryPositions(detailedAtlas);
          if (detailedWorldPositions.length) {
            const worldOutlineLine = new THREE.LineSegments(
              new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(detailedWorldPositions, 3)),
              new THREE.LineBasicMaterial({
                color: 0xd9e6f0,
                depthWrite: false,
                opacity: 0,
                toneMapped: false,
                transparent: true,
              }),
            );
            worldOutlineLine.renderOrder = 2;
            worldOutlineLine.visible = false;
            state.globeGroup.add(worldOutlineLine);
            state.worldOutlineLine = worldOutlineLine;
            container.dataset.coverageWorldBoundaries = "aligned";
            container.dataset.coverageWorldOutlineCountries = String(atlasCountries(detailedAtlas).length);
          }
        }

        const country = boundaryCountryMode ? coverageBoundaryCountry(data, boundaryCountryNames) : null;
        const positions = buildAdminBoundaryPositions(
          decodedCoverageBoundaryLines(data, boundaryCountryMode ? boundaryCountryNames : undefined),
        );
        if ((boundaryCountryMode && !country) || !positions.length) {
          state.adminBoundaryLoadScope = "";
          state.adminBoundaryScope = boundaryScopeKey;
          container.dataset.coverageAdminBoundaries = "hidden";
          container.dataset.coverageAdminBoundaryRegions = "0";
          return;
        }
        const boundaryLine = new THREE.LineSegments(
          new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(positions, 3)),
          new THREE.LineBasicMaterial({
            color: 0xb9d1e2,
            depthWrite: false,
            opacity: 0,
            toneMapped: false,
            transparent: true,
          }),
        );
        boundaryLine.visible = false;
        boundaryLine.renderOrder = 3;
        state.adminBoundaryGroup.add(boundaryLine);
        state.adminBoundaryLine = boundaryLine;
        state.adminBoundaryLoadScope = "";
        state.adminBoundaryScope = boundaryScopeKey;
        container.dataset.coverageAdminBoundaryScope = boundaryCountryMode
          ? normalizeCoverageCountryName(country.name)
          : "world";
        container.dataset.coverageAdminBoundaryRegions = String(
          boundaryCountryMode
            ? country.regionNames?.length || 0
            : Object.values(data.countries || {}).reduce((total, entry) => total + (entry.regionNames?.length || 0), 0),
        );
      })
      .catch(() => {
        if (active && containerRef.current === container) {
          state.adminBoundaryLoadScope = "";
          container.dataset.coverageAdminBoundaries = "error";
          if (!state.detailedSurface) container.dataset.coverageSurfaceDetail = "error";
        }
      });

    return () => {
      active = false;
    };
  }, [boundariesShouldLoad, boundaryCountryMode, boundaryCountryNames, boundaryScopeKey, mapSize, quality]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;

    state.markerGroup.clear();
    state.markerObjects = [];
    state.markerByKey = new Map();
    state.markerDefinitions = markers;
    state.interaction.hitTargetsDirty = true;

    const globeNorthAxis = new THREE.Vector3(0, 1, 0);
    const globePoleFallbackAxis = new THREE.Vector3(0, 0, 1);

    for (const marker of markers) {
      const baseNormal = lonLatToVector3(marker.coordinates, 1).normalize();
      const east = new THREE.Vector3().crossVectors(globeNorthAxis, baseNormal);
      if (east.lengthSq() < 0.000001) east.crossVectors(globePoleFallbackAxis, baseNormal);
      east.normalize();
      const north = new THREE.Vector3().crossVectors(baseNormal, east).normalize();
      const color = new THREE.Color(marker.color);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true }),
      );
      core.position.copy(baseNormal).multiplyScalar(GLOBE_RADIUS + 0.01);
      core.scale.setScalar(0.01);
      core.userData = {
        baseNormal,
        east,
        fanout: marker.fanout || { x: 0, y: 0 },
        marker,
        north,
      };

      state.markerGroup.add(core);
      state.markerObjects.push(core);
      state.markerByKey.set(marker.key, core);
    }

    return () => {
      state.markerGroup.children.forEach(disposeObject);
      state.markerGroup.clear();
    };
  }, [markers]);

  const pinMarker = (marker) => {
    const state = sceneRef.current;
    const object = state?.markerByKey.get(marker.key);
    autoRotateRef.current = false;
    trackMarkerSelection(marker, "button", trackedMarkerRef);
    callbacksRef.current.onUserInteraction?.();
    callbacksRef.current.onPin?.({
      ...payloadForMarker(marker),
      point: pointForObject(object, state?.camera || { position: { z: 7.2 } }, mapSize),
    });
  };

  const focusDomMarker = (marker) => {
    domActiveMarkerRef.current = marker.key;
    if (!autoRotateRef.current) return;

    autoRotateRef.current = false;
    trackAnalyticsEvent("coverage_map_interaction", {
      routeType: "coverage",
      metadata: {
        input: "keyboard",
        renderer: "3d",
      },
    });
    callbacksRef.current.onUserInteraction?.();
  };

  const leaveDomMarker = () => {
    domActiveMarkerRef.current = "";
  };

  return (
    <div className="coverage-globe" data-coverage-globe="ready" data-coverage-marker-style="surface-beads" ref={containerRef}>
      <div className="coverage-globe-hit-layer" aria-label={copy.coverage.mapLabel}>
        {markers.map((marker) => (
          <button
            aria-label={markerLabel(marker, copy)}
            className={`coverage-globe-hit-target is-${marker.kind}`}
            data-coverage-marker-key={marker.key}
            data-coverage-marker-kind={marker.kind}
            data-coverage-visual-radius-px={marker.visualRadiusPx}
            key={marker.key}
            ref={(node) => {
              if (node) buttonRefs.current.set(marker.key, node);
              else buttonRefs.current.delete(marker.key);
            }}
            type="button"
            onBlur={leaveDomMarker}
            onClick={() => pinMarker(marker)}
            onFocus={() => focusDomMarker(marker)}
          />
        ))}
      </div>
    </div>
  );
}
