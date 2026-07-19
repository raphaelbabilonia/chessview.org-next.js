import { expect, test } from "@playwright/test";
import {
  captureMapEvents,
  dispatchTouch,
  lowestFlatMarkerPoint,
  lowestGlobeMarkerPoint,
  openCoverage,
  stopGlobeRotation,
} from "./helpers.mjs";

const readGlobeOrientation = async (globe) => {
  const value = await globe.getAttribute("data-coverage-orientation");
  if (!value) throw new Error("The globe orientation is unavailable");
  return value.split(",").map(Number);
};

const quaternionAngularDistance = (first, second) => {
  const dot = first.reduce((total, value, index) => total + value * second[index], 0);
  return 2 * Math.acos(Math.min(1, Math.abs(dot)));
};

const moveTouchPair = async (page, { centerX, centerY, endAngle, endRadius, startRadius, steps = 12 }) => {
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const angle = endAngle * progress;
    const radius = startRadius + (endRadius - startRadius) * progress;
    const offsetX = Math.cos(angle) * radius;
    const offsetY = Math.sin(angle) * radius;
    await dispatchTouch(page, "pointermove", 1, centerX - offsetX, centerY - offsetY);
    await dispatchTouch(page, "pointermove", 2, centerX + offsetX, centerY + offsetY);
  }
};

test("a low 3D marker needs a separate touch to navigate", async ({ page }) => {
  await openCoverage(page, "3d");
  await stopGlobeRotation(page);
  await captureMapEvents(page, "__globeEvents");

  const marker = await lowestGlobeMarkerPoint(page);
  expect(marker, "an unobstructed globe marker should be visible").not.toBeNull();
  await page.touchscreen.tap(marker.x, marker.y);

  const tooltip = page.locator(".coverage-tooltip");
  await expect(tooltip).toBeVisible();
  await page.waitForTimeout(150);
  await expect(page).toHaveURL(/\/en\/coverage$/);
  await expect(tooltip).toHaveCount(1);
  const events = await page.evaluate(() => window.__globeEvents);
  expect(events.some((event) => event.type === "click" && event.className.includes("coverage-tooltip"))).toBe(false);

  await tooltip.locator("a").first().tap();
  await expect(page).toHaveURL(/\/en\/events\/fixture-/);
});

test("a low 2D marker needs a separate touch to navigate", async ({ page }) => {
  await openCoverage(page, "2d");
  await captureMapEvents(page, "__flatEvents");

  const marker = await lowestFlatMarkerPoint(page);
  expect(marker, "a flat-map tournament marker should be visible").not.toBeNull();
  await page.touchscreen.tap(marker.x, marker.y);

  const tooltip = page.locator(".coverage-tooltip");
  await expect(tooltip).toBeVisible();
  await page.waitForTimeout(150);
  await expect(page).toHaveURL(/\/en\/coverage$/);
  await expect(tooltip).toHaveCount(1);
  const events = await page.evaluate(() => window.__flatEvents);
  expect(events.some((event) => event.type === "click" && event.className.includes("coverage-tooltip"))).toBe(false);

  await tooltip.locator("a").first().tap();
  await expect(page).toHaveURL(/\/en\/events\/fixture-/);
});

test("pinch zoom is logarithmic and finger transitions do not jump", async ({ page }) => {
  await openCoverage(page, "3d");
  await stopGlobeRotation(page);
  const globe = page.locator("[data-coverage-globe=ready]");
  const canvas = page.locator(".coverage-globe-canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("The 3D canvas has no bounding box");
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const initialZoom = Number(await globe.getAttribute("data-coverage-zoom-target"));

  await dispatchTouch(page, "pointerdown", 1, centerX - 40, centerY);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "pending-rotation");
  await dispatchTouch(page, "pointerdown", 2, centerX + 40, centerY);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "pinching");
  expect(Number(await globe.getAttribute("data-coverage-zoom-target"))).toBe(initialZoom);

  await dispatchTouch(page, "pointermove", 1, centerX - 70, centerY);
  await dispatchTouch(page, "pointermove", 2, centerX + 70, centerY);
  await page.waitForTimeout(50);
  const pinchedZoom = Number(await globe.getAttribute("data-coverage-zoom-target"));
  expect(pinchedZoom).toBeGreaterThan(initialZoom + 3);
  expect(pinchedZoom).toBeLessThan(initialZoom + 3.5);

  await dispatchTouch(page, "pointerup", 1, centerX - 70, centerY);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "pending-rotation");
  await dispatchTouch(page, "pointerup", 2, centerX + 70, centerY);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "idle");
  await expect(page.locator(".coverage-tooltip")).toHaveCount(0);
});

test("a two-finger half turn rolls the globe in place without changing zoom", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCoverage(page, "3d");
  await stopGlobeRotation(page);
  const globe = page.locator("[data-coverage-globe=ready]");
  const bounds = await page.locator(".coverage-globe-canvas").boundingBox();
  if (!bounds) throw new Error("The 3D canvas has no bounding box");

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const radius = 52;
  const initialOrientation = await readGlobeOrientation(globe);
  const initialZoom = Number(await globe.getAttribute("data-coverage-zoom-target"));

  await dispatchTouch(page, "pointerdown", 1, centerX - radius, centerY);
  await dispatchTouch(page, "pointerdown", 2, centerX + radius, centerY);
  await moveTouchPair(page, {
    centerX,
    centerY,
    endAngle: Math.PI,
    endRadius: radius,
    startRadius: radius,
  });

  const rolledOrientation = await readGlobeOrientation(globe);
  expect(quaternionAngularDistance(initialOrientation, rolledOrientation)).toBeGreaterThan(2.9);
  expect(Number(await globe.getAttribute("data-coverage-zoom-target"))).toBeCloseTo(initialZoom, 2);

  await dispatchTouch(page, "pointerup", 1, centerX + radius, centerY);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "pending-rotation");
  const transitionOrientation = await readGlobeOrientation(globe);
  expect(quaternionAngularDistance(rolledOrientation, transitionOrientation)).toBeLessThan(0.01);

  await dispatchTouch(page, "pointermove", 2, centerX - radius + 2, centerY);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "pending-rotation");
  expect(quaternionAngularDistance(transitionOrientation, await readGlobeOrientation(globe))).toBeLessThan(0.01);
  await dispatchTouch(page, "pointerup", 2, centerX - radius + 2, centerY);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "idle");
  await expect(page.locator(".coverage-tooltip")).toHaveCount(0);
});

test("pinch and twist update zoom and roll in the same gesture", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCoverage(page, "3d");
  await stopGlobeRotation(page);
  const globe = page.locator("[data-coverage-globe=ready]");
  const bounds = await page.locator(".coverage-globe-canvas").boundingBox();
  if (!bounds) throw new Error("The 3D canvas has no bounding box");

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const startRadius = 40;
  const endRadius = 70;
  const initialOrientation = await readGlobeOrientation(globe);
  const initialZoom = Number(await globe.getAttribute("data-coverage-zoom-target"));

  await dispatchTouch(page, "pointerdown", 1, centerX - startRadius, centerY);
  await dispatchTouch(page, "pointerdown", 2, centerX + startRadius, centerY);
  await moveTouchPair(page, {
    centerX,
    centerY,
    endAngle: Math.PI / 2,
    endRadius,
    startRadius,
  });

  expect(quaternionAngularDistance(initialOrientation, await readGlobeOrientation(globe))).toBeGreaterThan(1.4);
  expect(Number(await globe.getAttribute("data-coverage-zoom-target"))).toBeGreaterThan(initialZoom + 3);
  await dispatchTouch(page, "pointerup", 1, centerX, centerY - endRadius);
  await dispatchTouch(page, "pointerup", 2, centerX, centerY + endRadius);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "idle");
  await expect(page.locator(".coverage-tooltip")).toHaveCount(0);
});

test("rotation waits for intent and cancellation clears the gesture", async ({ page }) => {
  await openCoverage(page, "3d");
  await stopGlobeRotation(page);
  const globe = page.locator("[data-coverage-globe=ready]");
  const bounds = await page.locator(".coverage-globe-canvas").boundingBox();
  if (!bounds) throw new Error("The 3D canvas has no bounding box");
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;

  await dispatchTouch(page, "pointerdown", 1, x, y);
  await dispatchTouch(page, "pointermove", 1, x + 3, y);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "pending-rotation");
  await dispatchTouch(page, "pointermove", 1, x + 30, y + 10);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "rotating");
  await dispatchTouch(page, "pointercancel", 1, x + 30, y + 10);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "idle");
  await expect(page.locator(".coverage-tooltip")).toHaveCount(0);
});

test("rotation crosses both poles and stays responsive in every direction", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCoverage(page, "3d");
  const globe = page.locator("[data-coverage-globe=ready]");
  const bounds = await page.locator(".coverage-globe-canvas").boundingBox();
  if (!bounds) throw new Error("The 3D canvas has no bounding box");

  const drag = async (pointerId, startX, startY, endX, endY) => {
    await dispatchTouch(page, "pointerdown", pointerId, startX, startY);
    await dispatchTouch(page, "pointermove", pointerId, endX, endY);
    await dispatchTouch(page, "pointerup", pointerId, endX, endY);
  };

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const initialOrientation = await readGlobeOrientation(globe);

  for (let index = 0; index < 6; index += 1) {
    await drag(index + 1, centerX, centerY + bounds.height * 0.25, centerX, centerY - bounds.height * 0.25);
  }
  const beyondBothPoles = await readGlobeOrientation(globe);
  expect(quaternionAngularDistance(initialOrientation, beyondBothPoles)).toBeGreaterThan(2.4);

  await drag(20, centerX, centerY + bounds.height * 0.25, centerX, centerY - bounds.height * 0.25);
  const continuedVerticalRotation = await readGlobeOrientation(globe);
  expect(quaternionAngularDistance(beyondBothPoles, continuedVerticalRotation)).toBeGreaterThan(0.45);

  await drag(21, centerX - bounds.width * 0.25, centerY, centerX + bounds.width * 0.25, centerY);
  const horizontalRotationAfterPole = await readGlobeOrientation(globe);
  expect(quaternionAngularDistance(continuedVerticalRotation, horizontalRotationAfterPole)).toBeGreaterThan(0.8);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "idle");
  await expect(page.locator(".coverage-tooltip")).toHaveCount(0);
});

test("tap slop activates once while a deliberate drag never activates", async ({ page }) => {
  await openCoverage(page, "3d");
  await stopGlobeRotation(page);
  let marker = await lowestGlobeMarkerPoint(page);
  expect(marker).not.toBeNull();

  await dispatchTouch(page, "pointerdown", 1, marker.x, marker.y);
  await dispatchTouch(page, "pointermove", 1, marker.x + 6, marker.y);
  await dispatchTouch(page, "pointerup", 1, marker.x + 6, marker.y);
  await page.locator(".coverage-globe-canvas").evaluate(
    (canvas, point) => canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: point.x, clientY: point.y })),
    { x: marker.x + 6, y: marker.y },
  );
  await expect(page.locator(".coverage-tooltip")).toHaveCount(1);

  await openCoverage(page, "3d");
  await stopGlobeRotation(page);
  marker = await lowestGlobeMarkerPoint(page);
  expect(marker).not.toBeNull();
  await dispatchTouch(page, "pointerdown", 1, marker.x, marker.y);
  await dispatchTouch(page, "pointermove", 1, marker.x + 16, marker.y);
  await dispatchTouch(page, "pointerup", 1, marker.x + 16, marker.y);
  await page.locator(".coverage-globe-canvas").evaluate(
    (canvas, point) => canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: point.x, clientY: point.y })),
    { x: marker.x + 16, y: marker.y },
  );
  await page.waitForTimeout(100);
  await expect(page.locator(".coverage-tooltip")).toHaveCount(0);
});

test("reduced motion suppresses release momentum", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCoverage(page, "3d");
  const globe = page.locator("[data-coverage-globe=ready]");
  const bounds = await page.locator(".coverage-globe-canvas").boundingBox();
  if (!bounds) throw new Error("The 3D canvas has no bounding box");
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;

  await dispatchTouch(page, "pointerdown", 1, x, y);
  await dispatchTouch(page, "pointermove", 1, x + 60, y + 15);
  await dispatchTouch(page, "pointerup", 1, x + 60, y + 15);
  await expect(globe).toHaveAttribute("data-coverage-gesture-mode", "idle");
  await expect(globe).toHaveAttribute("data-coverage-momentum", "none");
});

test("coarse-pointer marker targets meet the 44px minimum", async ({ page }) => {
  await openCoverage(page, "3d");
  await stopGlobeRotation(page);
  const globeTarget = page.locator(".coverage-globe-hit-target:not([hidden])").first();
  const globeBounds = await globeTarget.boundingBox();
  expect(globeBounds?.width).toBeGreaterThanOrEqual(44);
  expect(globeBounds?.height).toBeGreaterThanOrEqual(44);

  await openCoverage(page, "2d");
  const flatTarget = page.locator(".coverage-world-dot-target, .coverage-world-cluster-target").first();
  await expect(flatTarget).toHaveCSS("stroke-width", "44px");
  await expect(flatTarget).toHaveCSS("pointer-events", "all");
});
