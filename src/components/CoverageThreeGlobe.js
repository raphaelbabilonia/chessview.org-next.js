"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { coverageGlobeGesture, dampFactor, decayVelocity, rotationDeltaFromPointer, zoomFromPinch } from "@/lib/coverageGlobeGesture";
import { trackAnalyticsEvent } from "@/lib/tracking";

const GLOBE_RADIUS = 2.36;
const SURFACE_RADIUS = GLOBE_RADIUS + 0.018;
const COARSE_MARKER_HIT_RADIUS_PX = 22;
const HIT_TARGET_UPDATE_INTERVAL_MS = 1000 / 15;
const MOMENTUM_STALE_AFTER_MS = 90;
const MOMENTUM_STOP_RADIANS_PER_SECOND = 0.01;
const typeColors = {
  blitz: "#ffb02e",
  classical: "#2f80ed",
  other: "#d977d8",
  rapid: "#20b26b",
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

const buildLandBoundaryPositions = () => {
  const countryFeatures = feature(worldAtlas, worldAtlas.objects.countries).features;
  const positions = [];

  for (const country of countryFeatures) {
    const polygons = country.geometry?.type === "MultiPolygon" ? country.geometry.coordinates : [country.geometry?.coordinates || []];

    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (let index = 1; index < ring.length; index += 1) {
          pushLineSegment(positions, ring[index - 1], ring[index]);
        }
      }
    }
  }

  return new Float32Array(positions);
};

const buildGraticulePositions = () => {
  const positions = [];

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    for (let longitude = -180; longitude < 180; longitude += 5) {
      pushLineSegment(positions, [longitude, latitude], [longitude + 5, latitude], GLOBE_RADIUS + 0.008);
    }
  }

  for (let longitude = -150; longitude <= 180; longitude += 30) {
    for (let latitude = -85; latitude < 85; latitude += 5) {
      pushLineSegment(positions, [longitude, latitude], [longitude, latitude + 5], GLOBE_RADIUS + 0.008);
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
  items = [],
  mapSize,
  onHover,
  onLeave,
  onPin,
  onPerformanceIssue,
  onReady,
  onUserInteraction,
  onUnavailable,
  onZoomChange,
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
            scale: clamp(0.022 + Math.sqrt(country.count || 1) * 0.0015, 0.024, 0.034),
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
            scale: 0.02,
          };
        }

        const coordinates = cleanCoordinates(item.event.globeCoordinates);
        if (!coordinates) return null;

        return {
          color: typeColors[item.event.tournamentType] || typeColors.other,
          coordinates,
          event: item.event,
          key: item.key,
          kind: "event",
          scale: item.event.markerSource === "country" ? 0.014 : 0.018,
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
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      callbacksRef.current.onUnavailable?.("init-error");
      return undefined;
    }

    renderer.domElement.className = "coverage-globe-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.5 : 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0, 7.2);

    const globeGroup = new THREE.Group();
    globeGroup.rotation.set(-0.14, -0.36, 0);
    scene.add(globeGroup);

    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64),
      new THREE.MeshPhongMaterial({
        color: 0x061833,
        emissive: 0x031225,
        shininess: 18,
        specular: 0x34506f,
      }),
    );
    globeGroup.add(ocean);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS + 0.055, 96, 64),
      new THREE.MeshBasicMaterial({
        color: 0xba9b4a,
        opacity: 0.07,
        side: THREE.BackSide,
        transparent: true,
      }),
    );
    globeGroup.add(atmosphere);

    const graticule = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(buildGraticulePositions(), 3)),
      new THREE.LineBasicMaterial({ color: 0xfdfcfd, opacity: 0.14, transparent: true }),
    );
    globeGroup.add(graticule);

    const landBoundaries = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(buildLandBoundaryPositions(), 3)),
      new THREE.LineBasicMaterial({ color: 0xfdfcfd, opacity: 0.34, transparent: true }),
    );
    globeGroup.add(landBoundaries);

    const markerGroup = new THREE.Group();
    globeGroup.add(markerGroup);

    scene.add(new THREE.AmbientLight(0xfdfcfd, 0.82));
    const keyLight = new THREE.DirectionalLight(0xfdfcfd, 1.45);
    keyLight.position.set(2.4, 3, 5.5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xba9b4a, 0.82);
    rimLight.position.set(-4.5, -1.8, 2.4);
    scene.add(rimLight);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const cameraDirection = new THREE.Vector3();
    const markerProjectedPosition = new THREE.Vector3();
    const markerWorldPosition = new THREE.Vector3();
    const screenPitchAxis = new THREE.Vector3(1, 0, 0);
    const screenYawAxis = new THREE.Vector3(0, 1, 0);
    const screenPitchRotation = new THREE.Quaternion();
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
      reported: false,
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
      if (!autoRotateRef.current) return;
      autoRotateRef.current = false;
      trackAnalyticsEvent("coverage_map_interaction", {
        routeType: "coverage",
        metadata: {
          input,
          renderer: "3d",
        },
      });
      callbacksRef.current.onUserInteraction?.();
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

      pinchState = {
        startDistance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
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
      if (preciseMatch || !useCoarseHitArea) return preciseMatch;

      let closestObject = null;
      let closestDistance = COARSE_MARKER_HIT_RADIUS_PX;

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
      if (performanceProbe.reported) return;
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

      if (performanceProbe.reported) return;

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

      const targetDistance = clamp(7.3 - Math.min(Math.max(interaction.zoomTarget - 1, 0), 11) * 0.405, 2.85, 7.3);
      const zoomDamping = dampFactor(coverageGlobeGesture.rotationDampingPerSecond, deltaSeconds);
      camera.position.z += (targetDistance - camera.position.z) * zoomDamping;

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
          if (Math.abs(distance - pinchState.startDistance) > coverageGlobeGesture.pinchDeadZonePx) {
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
        const rotationDelta = rotationDeltaFromPointer({ deltaX, deltaY, height: bounds.height, width: bounds.width });
        applyRotationDelta(rotationDelta.pitch, rotationDelta.yaw);
        interaction.momentumYaw = clamp(
          interaction.momentumYaw * 0.6 + (rotationDelta.yaw / deltaSeconds) * 0.4,
          -coverageGlobeGesture.momentumMaxRadiansPerSecond,
          coverageGlobeGesture.momentumMaxRadiansPerSecond,
        );
        interaction.momentumPitch = clamp(
          interaction.momentumPitch * 0.6 + (rotationDelta.pitch / deltaSeconds) * 0.4,
          -coverageGlobeGesture.momentumMaxRadiansPerSecond,
          coverageGlobeGesture.momentumMaxRadiansPerSecond,
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
      interaction.zoomTarget = clamp(startZoom + (event.shiftKey ? -0.85 : 0.85), coverageGlobeGesture.zoomMin, coverageGlobeGesture.zoomMax);
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
      camera,
      frame: 0,
      interaction,
      markerByKey: new Map(),
      markerDefinitions: [],
      markerGroup,
      markerObjects: [],
      renderer,
      scene,
    };
    setGestureMode("idle");
    resetMomentum();
    syncOrientationDataset();
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
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
      delete container.dataset.coverageGestureMode;
      delete container.dataset.coverageMomentum;
      delete container.dataset.coverageZoomTarget;
      sceneRef.current = null;
    };
  }, [mapSize]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;

    state.markerGroup.clear();
    state.markerObjects = [];
    state.markerByKey = new Map();
    state.markerDefinitions = markers;
    state.interaction.hitTargetsDirty = true;

    for (const marker of markers) {
      const position = lonLatToVector3(marker.coordinates, GLOBE_RADIUS + 0.105);
      const basePosition = lonLatToVector3(marker.coordinates, GLOBE_RADIUS + 0.024);
      const color = new THREE.Color(marker.color);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(marker.scale, 20, 14),
        new THREE.MeshBasicMaterial({ color, transparent: true }),
      );
      core.position.copy(position);
      core.userData.marker = marker;

      const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([basePosition, position]),
        new THREE.LineBasicMaterial({ color, opacity: 0.46, transparent: true }),
      );

      state.markerGroup.add(stem, core);
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
  };

  const leaveDomMarker = () => {
    domActiveMarkerRef.current = "";
  };

  return (
    <div className="coverage-globe" data-coverage-globe="ready" ref={containerRef}>
      <div className="coverage-globe-hit-layer" aria-label={copy.coverage.mapLabel}>
        {markers.map((marker) => (
          <button
            aria-label={markerLabel(marker, copy)}
            className={`coverage-globe-hit-target is-${marker.kind}`}
            data-coverage-marker-key={marker.key}
            data-coverage-marker-kind={marker.kind}
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
