import { expect, test } from "@playwright/test";
import { openCoverage, stableVisibleGlobeMarker } from "./helpers.mjs";

test("desktop keyboard users can open and close 3D marker previews", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openCoverage(page, "3d");

  const marker = await stableVisibleGlobeMarker(page);
  await marker.focus();
  await marker.press("Enter");
  await expect(page.locator(".coverage-tooltip")).toBeVisible();
  await marker.press("Escape");
  await expect(page.locator(".coverage-tooltip")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("2D keyboard pan, zoom, reset, and marker activation remain available", async ({ page }) => {
  const stage = await openCoverage(page, "2d");
  const transformGroup = page.locator("svg.coverage-map > g").first();
  const initialTransform = await transformGroup.getAttribute("transform");

  await stage.focus();
  await stage.press("ArrowRight");
  await expect(transformGroup).not.toHaveAttribute("transform", initialTransform);
  await stage.press("+");
  await expect(page.locator(".coverage-zoom-badge")).not.toContainText("1.00");
  await page.getByRole("button", { name: "Reset map" }).click();
  await expect(page.locator(".coverage-zoom-badge")).toContainText("1.00");

  const marker = page.locator('svg [data-coverage-marker-kind="event"], svg [data-coverage-marker-kind="event-cluster"]').first();
  await marker.focus();
  await marker.press(" ");
  await expect(page.locator(".coverage-tooltip")).toBeVisible();
  await marker.press("Escape");
  await expect(page.locator(".coverage-tooltip")).toHaveCount(0);
});

test("existing clusters remain while marker dimensions stay compact", async ({ page }) => {
  const stage = await openCoverage(page, "2d");
  const clusters = page.locator('svg [data-coverage-marker-kind="event-cluster"]');
  const events = page.locator('svg [data-coverage-marker-kind="event"]');

  await expect(clusters).toHaveCount(1);
  await expect(events).toHaveCount(3);
  expect(Number(await clusters.first().getAttribute("data-coverage-visual-radius"))).toBeLessThanOrEqual(3.4);
  const eventRadii = await events.evaluateAll((markers) => markers.map((marker) => Number(marker.dataset.coverageVisualRadius)));
  expect(eventRadii.every((radius) => radius >= 0.7 && radius <= 1.65)).toBe(true);
  const initialClusterRadius = Number(await clusters.first().locator(".coverage-world-cluster-core").getAttribute("r"));
  const initialEventRadius = Number(await events.first().locator(".coverage-world-dot-core").getAttribute("r"));

  await clusters.first().focus();
  await clusters.first().press("Enter");
  await expect(page.locator(".coverage-tooltip")).toContainText(/2\s*Tournaments/i);
  await clusters.first().press("Escape");

  await stage.focus();
  await stage.press("+");
  await stage.press("+");
  await stage.press("+");
  await expect(page.locator(".coverage-zoom-badge")).toContainText("2.35");
  await expect(clusters).toHaveCount(1);
  await expect(events).toHaveCount(3);
  const zoomedClusterRadius = Number(await clusters.first().locator(".coverage-world-cluster-core").getAttribute("r"));
  const zoomedEventRadius = Number(await events.first().locator(".coverage-world-dot-core").getAttribute("r"));
  expect(Math.abs(initialClusterRadius - zoomedClusterRadius * 2.35)).toBeLessThan(0.01);
  expect(Math.abs(initialEventRadius - zoomedEventRadius * 2.35)).toBeLessThan(0.01);
});

test("3D markers use capped surface beads without changing cluster membership", async ({ page }) => {
  await openCoverage(page, "3d");
  const globe = page.locator("[data-coverage-globe=ready]");
  await expect(globe).toHaveAttribute("data-coverage-marker-style", "surface-beads");

  const clusters = globe.locator('[data-coverage-marker-kind="cluster"]');
  const events = globe.locator('[data-coverage-marker-kind="event"]');
  await expect(clusters).toHaveCount(1);
  await expect(events).toHaveCount(3);

  const clusterRadii = await clusters.evaluateAll((markers) => markers.map((marker) => Number(marker.dataset.coverageVisualRadiusPx)));
  const eventRadii = await events.evaluateAll((markers) => markers.map((marker) => Number(marker.dataset.coverageVisualRadiusPx)));
  expect(clusterRadii.every((radius) => radius >= 2.6 && radius <= 3.6)).toBe(true);
  expect(eventRadii.every((radius) => radius >= 1.1 && radius <= 2.4)).toBe(true);
});

test("renderer preference survives reload", async ({ page }) => {
  await openCoverage(page, "2d");
  await page.reload();
  await expect(page.locator(".coverage-map-stage")).toHaveAttribute("data-coverage-map-renderer", "2d");
  await expect(page.locator('button[data-map-renderer-option="2d"]')).toHaveAttribute("aria-pressed", "true");
});

test("an event without verified coordinates is never plotted at its country center", async ({ page }) => {
  await openCoverage(page, "2d");
  await expect(page.locator('[aria-label^="Unmapped Spain Safety Fixture:"]')).toHaveCount(0);

  await openCoverage(page, "3d");
  await expect(page.locator('[aria-label^="Unmapped Spain Safety Fixture:"]')).toHaveCount(0);
});

test("rapid 3D wheel input accumulates without waiting for React renders", async ({ page }) => {
  await openCoverage(page, "3d");
  const globe = page.locator("[data-coverage-globe=ready]");
  const initialZoom = Number(await globe.getAttribute("data-coverage-zoom-target"));
  await page.locator(".coverage-globe-canvas").evaluate((canvas) => {
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -160 }));
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -160 }));
  });

  await expect
    .poll(async () => Number(await globe.getAttribute("data-coverage-zoom-target")))
    .toBeGreaterThan(initialZoom + 1.4);
});

test("3D zoom reaches 24x, damps rotation, and reveals regional boundaries", async ({ page }) => {
  await openCoverage(page, "3d");
  const globe = page.locator("[data-coverage-globe=ready]");
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  const initialSensitivity = Number(await globe.getAttribute("data-coverage-rotation-sensitivity"));

  await expect(globe).toHaveAttribute("data-coverage-admin-boundaries", "hidden");
  for (let index = 0; index < 20; index += 1) await zoomIn.click();

  await expect.poll(async () => Number(await globe.getAttribute("data-coverage-zoom-target"))).toBe(24);
  await expect(globe).toHaveAttribute("data-coverage-admin-boundaries", "visible", { timeout: 15000 });
  expect(Number(await globe.getAttribute("data-coverage-rotation-sensitivity"))).toBeLessThan(initialSensitivity * 0.3);
  await zoomIn.click();
  await expect.poll(async () => Number(await globe.getAttribute("data-coverage-zoom-target"))).toBe(24);
});

test("2D regional boundaries fade in while deep-zoom markers stay screen-sized", async ({ page }) => {
  await openCoverage(page, "2d");
  const zoomIn = page.getByRole("button", { name: "Zoom in" });

  await expect(page.locator(".coverage-admin-boundaries")).toHaveCount(0);
  await page.getByRole("button", { name: "Argentina 2" }).click();
  await expect(page.locator(".coverage-zoom-badge")).toContainText("1.00");
  await expect(page.locator(".coverage-admin-boundaries")).toHaveCount(0);

  const regionCore = page.locator(".coverage-region-core").first();
  const initialBounds = await regionCore.boundingBox();
  if (!initialBounds) throw new Error("A selected-country region marker should be visible");

  await zoomIn.click();
  await zoomIn.click();
  await expect(page.locator(".coverage-admin-boundaries")).toHaveAttribute("data-coverage-admin-boundaries", "fading", { timeout: 15000 });
  await zoomIn.click();
  await zoomIn.click();
  await expect(page.locator(".coverage-admin-boundaries")).toHaveAttribute("data-coverage-admin-boundaries", "visible");

  const zoomedBounds = await regionCore.boundingBox();
  if (!zoomedBounds) throw new Error("The region marker should remain visible after zooming");
  expect(Math.abs(zoomedBounds.width - initialBounds.width)).toBeLessThan(1);
  expect(Math.abs(zoomedBounds.height - initialBounds.height)).toBeLessThan(1);
});

test("WebGL context loss falls back to 2D and records the reason", async ({ page }) => {
  const stage = await openCoverage(page, "3d");
  await page.locator(".coverage-globe-canvas").evaluate((canvas) => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });

  await expect(stage).toHaveAttribute("data-coverage-map-renderer", "2d");
  await expect(stage).toHaveAttribute("data-coverage-map-fallback-reason", "context-lost");
  const fallback = await page.evaluate(() => JSON.parse(localStorage.getItem("chessview_coverage_3d_disabled_until")));
  expect(fallback.reason).toBe("context-lost");
  expect(fallback.disabledUntil).toBeGreaterThan(Date.now());
});
