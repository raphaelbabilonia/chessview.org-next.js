"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";

const GLOBE_RADIUS = 2.36;
const SURFACE_RADIUS = GLOBE_RADIUS + 0.018;
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
    const hoveredRef = { object: null };
    const activePointers = new Map();
    let pinchState = null;
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
      active: false,
      moved: 0,
      pointerId: null,
      startX: 0,
      startY: 0,
      startObject: null,
      x: 0,
      y: 0,
    };

    const stopAutoRotate = () => {
      if (!autoRotateRef.current) return;
      autoRotateRef.current = false;
      callbacksRef.current.onUserInteraction?.();
    };

    const eventPoint = (event) => ({
      x: event.clientX,
      y: event.clientY,
    });

    const startPinch = () => {
      const points = [...activePointers.values()];
      if (points.length < 2) {
        pinchState = null;
        return;
      }

      pinchState = {
        distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
        zoom: zoomRef.current,
      };
      dragState.active = false;
      dragState.pointerId = null;
      dragState.startObject = null;
    };

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const raycast = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(sceneRef.current?.markerObjects || [], false)[0]?.object || null;
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
      hoveredRef.object = object;
      callbacksRef.current.onLeave?.();

      if (!object) {
        renderer.domElement.style.cursor = dragState.active ? "grabbing" : "grab";
        return;
      }

      renderer.domElement.style.cursor = "pointer";
    };

    const updateHitTargets = () => {
      const cameraDirection = camera.position.clone().normalize();

      for (const marker of sceneRef.current?.markerDefinitions || []) {
        const button = buttonRefs.current.get(marker.key);
        const object = sceneRef.current?.markerByKey.get(marker.key);
        if (!button || !object) continue;

        const worldPosition = object.getWorldPosition(new THREE.Vector3());
        const facingCamera = worldPosition.clone().normalize().dot(cameraDirection) > 0.03;
        const projected = worldPosition.clone().project(camera);
        const visible =
          facingCamera &&
          projected.z < 1 &&
          projected.x >= -0.96 &&
          projected.x <= 0.96 &&
          projected.y >= -0.84 &&
          projected.y <= 0.94;

        button.hidden = !visible;
        if (!visible) continue;

        button.style.left = `${((projected.x + 1) / 2) * 100}%`;
        button.style.top = `${((1 - projected.y) / 2) * 100}%`;
      }
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

    const animate = () => {
      const state = sceneRef.current;
      state.frame = window.requestAnimationFrame(animate);

      const targetDistance = clamp(7.3 - Math.min(Math.max(zoomRef.current - 1, 0), 11) * 0.405, 2.85, 7.3);
      camera.position.z += (targetDistance - camera.position.z) * 0.12;
      camera.updateProjectionMatrix();

      if (autoRotateRef.current && !reducedMotion && !dragState.active && !pinchState && !hoveredRef.object && !domActiveMarkerRef.current) {
        globeGroup.rotation.y += 0.0012;
      }

      renderer.render(scene, camera);
      updateHitTargets();
      measurePerformance(performance.now());
    };

    const onPointerDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      stopAutoRotate();
      activePointers.set(event.pointerId, eventPoint(event));
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture can fail if the browser has already retargeted focus.
      }

      if (activePointers.size >= 2) {
        startPinch();
        setInteractiveObject(null);
        renderer.domElement.style.cursor = "grabbing";
        return;
      }

      dragState.active = true;
      dragState.moved = 0;
      dragState.pointerId = event.pointerId;
      dragState.startObject = raycast(event);
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
        const points = [...activePointers.values()];
        if (!pinchState) startPinch();
        if (pinchState) {
          const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
          const nextZoom = clamp(pinchState.zoom * (distance / pinchState.distance), 1, 12);
          callbacksRef.current.onZoomChange?.(nextZoom, { input: "pinch" });
          setInteractiveObject(null);
        }
        return;
      }

      if (dragState.active && dragState.pointerId === event.pointerId) {
        const deltaX = event.clientX - dragState.x;
        const deltaY = event.clientY - dragState.y;
        dragState.x = event.clientX;
        dragState.y = event.clientY;
        dragState.moved += Math.abs(deltaX) + Math.abs(deltaY);
        globeGroup.rotation.y += deltaX * 0.0058;
        globeGroup.rotation.x = clamp(globeGroup.rotation.x + deltaY * 0.0034, -0.86, 0.78);
        setInteractiveObject(null);
        return;
      }

      setInteractiveObject(raycast(event));
    };

    const onPointerUp = (event) => {
      try {
        if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId);
        }
      } catch {
        // The click fallback below still handles activation if capture is gone.
      }
      const wasClick = (dragState.active || dragState.startObject) && dragState.moved < 7;
      activePointers.delete(event.pointerId);
      dragState.active = false;
      dragState.pointerId = null;
      pinchState = null;
      renderer.domElement.style.cursor = "grab";

      const object = raycast(event);
      dragState.startObject = null;
      if (wasClick && object) {
        const payload = markerPayload(object);
        if (payload) callbacksRef.current.onPin?.(payload);
      }

      if (activePointers.size === 1) {
        const [remainingPoint] = activePointers.values();
        dragState.active = true;
        dragState.moved = 0;
        dragState.pointerId = [...activePointers.keys()][0];
        dragState.startX = remainingPoint.x;
        dragState.startY = remainingPoint.y;
        dragState.x = remainingPoint.x;
        dragState.y = remainingPoint.y;
      }
    };

    const onCanvasClick = (event) => {
      if (dragState.moved >= 7) return;
      const object = raycast(event);
      const payload = markerPayload(object);
      if (payload) callbacksRef.current.onPin?.(payload);
    };

    const onPointerLeave = () => {
      if (!dragState.active) setInteractiveObject(null);
    };

    const onWheel = (event) => {
      event.preventDefault();
      stopAutoRotate();
      const delta = clamp(event.deltaY, -160, 160);
      callbacksRef.current.onZoomChange?.(zoomRef.current - delta * 0.0045, { input: "wheel" });
    };

    const onDoubleClick = (event) => {
      event.preventDefault();
      stopAutoRotate();
      callbacksRef.current.onZoomChange?.(zoomRef.current + (event.shiftKey ? -0.85 : 0.85), { input: "double_click" });
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
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
      markerByKey: new Map(),
      markerDefinitions: [],
      markerGroup,
      markerObjects: [],
      renderer,
      scene,
    };
    animate();

    return () => {
      const state = sceneRef.current;
      if (state?.frame) window.cancelAnimationFrame(state.frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
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
