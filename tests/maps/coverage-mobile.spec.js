import { expect, test } from "@playwright/test";
import {
  captureMapEvents,
  dispatchTouch,
  lowestFlatMarkerPoint,
  lowestGlobeMarkerPoint,
  openCoverage,
  stopGlobeRotation,
} from "./helpers.mjs";

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
