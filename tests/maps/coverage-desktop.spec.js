import { expect, test } from "@playwright/test";
import { openCoverage, stableVisibleGlobeMarker } from "./helpers.mjs";

test("the canonical maps page is a three-dimensional explorer with no renderer switch", async ({ page }) => {
  const stage = await openCoverage(page);
  const globe = page.locator("[data-coverage-globe=ready]");

  await expect(page).toHaveURL(/\/en\/maps$/);
  await expect(stage).toHaveAttribute("data-coverage-map-renderer", "3d");
  await expect(globe).toHaveAttribute("data-coverage-surface-style", "cartographic-slate");
  await expect(globe).toHaveAttribute("data-coverage-surface-texture", "4096x2048");
  await expect(globe).toHaveAttribute("data-coverage-surface-countries", /^[1-9]\d{2,}$/);
  await expect(globe).toHaveAttribute("data-coverage-surface-detail", "coarse");
  await expect(page.locator("[data-map-renderer-option]")).toHaveCount(0);
  await expect(page.locator("svg.coverage-map")).toHaveCount(0);
  await expect(page.locator(".maps-context-panel")).toHaveCount(0);
  await expect(page.locator(".maps-country-row")).toHaveCount(0);
});

test("desktop marker details open only after selection and stay inside the map", async ({ page }) => {
  await openCoverage(page);

  const marker = await stableVisibleGlobeMarker(page);
  const overlay = page.locator(".maps-marker-overlay");
  const markerBounds = await marker.boundingBox();
  if (!markerBounds) throw new Error("The desktop marker has no measurable bounds");
  await page.mouse.move(markerBounds.x + markerBounds.width / 2, markerBounds.y + markerBounds.height / 2);
  await page.waitForTimeout(150);
  await expect(overlay).toHaveCount(0);

  await marker.focus();
  await marker.press("Enter");
  await expect(overlay).toBeVisible();
  await expect(overlay).toBeFocused();

  const stage = page.locator(".coverage-map-stage");
  const stageBounds = await stage.boundingBox();
  const overlayBounds = await overlay.boundingBox();
  if (!stageBounds || !overlayBounds) throw new Error("The desktop map overlay has no measurable bounds");
  expect(overlayBounds.x).toBeGreaterThanOrEqual(stageBounds.x);
  expect(overlayBounds.y).toBeGreaterThanOrEqual(stageBounds.y);
  expect(overlayBounds.x + overlayBounds.width).toBeLessThanOrEqual(stageBounds.x + stageBounds.width + 1);
  expect(overlayBounds.y + overlayBounds.height).toBeLessThanOrEqual(stageBounds.y + stageBounds.height + 1);

  await overlay.getByRole("button", { name: "Close tournament details" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(stage).toBeFocused();
});

test("reduced-quality devices use the smaller cartographic surface", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 2 });
  });
  const stage = await openCoverage(page);
  const globe = page.locator("[data-coverage-globe=ready]");

  await expect(stage).toHaveAttribute("data-coverage-map-quality", "reduced");
  await expect(globe).toHaveAttribute("data-coverage-surface-style", "cartographic-slate");
  await expect(globe).toHaveAttribute("data-coverage-surface-texture", "2048x1024");
});

test("fullscreen selections open and close inside the fullscreen map", async ({ page }) => {
  await openCoverage(page);
  const shell = page.locator(".coverage-map-shell");
  await page.getByRole("button", { name: "Open fullscreen map" }).click();
  await expect(shell).toHaveClass(/is-fullscreen/);

  const marker = await stableVisibleGlobeMarker(page);
  await marker.focus();
  await marker.press("Enter");

  const overlay = shell.locator(".maps-marker-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toBeFocused();
  await overlay.getByRole("button", { name: "Close tournament details" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator(".coverage-map-stage")).toBeFocused();
});

test("globe markers use compact capped surface beads", async ({ page }) => {
  await openCoverage(page);
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

test("search and filters narrow the map and service summary", async ({ page }) => {
  await openCoverage(page);
  const globe = page.locator("[data-coverage-globe=ready]");

  await page.getByRole("searchbox", { name: "Search tournaments and places" }).fill("Tokyo");
  await expect(page.locator(".coverage-filter-stats")).toContainText("1Active countries");
  await expect(page.locator(".coverage-filter-stats")).toContainText("1Tournaments");
  await expect(globe.locator('[data-coverage-marker-kind="event"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Map filters" }).click();
  await page.getByRole("button", { name: "Blitz" }).click();
  await expect(page.locator(".coverage-filter-stats")).toContainText("0Tournaments");
  await expect(globe.locator("[data-coverage-marker-kind]")).toHaveCount(0);
  await expect(page.locator(".maps-map-empty-state")).toContainText("No tournaments match these filters.");
  await page.locator("#maps-filter-panel").getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator(".coverage-filter-stats")).toContainText("6Tournaments");
  await expect(page.locator(".maps-map-empty-state")).toHaveCount(0);
});

test("country selections open in the map and focus the globe", async ({ page }) => {
  await openCoverage(page);
  const globe = page.locator("[data-coverage-globe=ready]");
  await expect(globe).toHaveAttribute("data-coverage-admin-boundaries", "hidden");
  await expect(globe).not.toHaveAttribute("data-coverage-admin-boundary-scope", /.+/);

  await page.getByRole("searchbox", { name: "Search tournaments and places" }).fill("Argentina");
  await page.getByRole("button", { name: "Map filters" }).click();
  await page.getByRole("checkbox", { name: "Group markers by country" }).check();

  const countryMarker = globe.locator('[data-coverage-marker-kind="country"]');
  await expect(countryMarker).toHaveCount(1);
  await countryMarker.focus();
  await countryMarker.press("Enter");

  const overlay = page.locator('.maps-marker-overlay [data-maps-marker-kind="country"]');
  await expect(overlay).toContainText("Argentina");
  await overlay.getByRole("button", { name: "Focus country" }).click();

  await expect(page.locator(".maps-marker-overlay")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Current map view: Country view: Argentina/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to world" })).toBeVisible();
  await expect.poll(async () => Number(await globe.getAttribute("data-coverage-zoom-target"))).toBeGreaterThan(1);
});

test("events without verified coordinates remain in totals but are never plotted", async ({ page }) => {
  await openCoverage(page);
  await page.getByRole("searchbox", { name: "Search tournaments and places" }).fill("Unmapped Spain Safety Fixture");
  await expect(page.locator(".coverage-filter-stats")).toContainText("1Tournaments");
  await expect(page.locator(".maps-map-empty-state")).toContainText("Matching tournaments do not yet have verified map coordinates.");
  await expect(page.locator('[aria-label^="Unmapped Spain Safety Fixture:"]')).toHaveCount(0);
});

test("rapid wheel input reaches deep zoom and reveals regional boundaries", async ({ page }) => {
  await openCoverage(page);
  const globe = page.locator("[data-coverage-globe=ready]");
  const initialSensitivity = Number(await globe.getAttribute("data-coverage-rotation-sensitivity"));

  await page.locator(".coverage-globe-canvas").evaluate((canvas) => {
    for (let index = 0; index < 40; index += 1) {
      canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -160 }));
    }
  });

  await expect.poll(async () => Number(await globe.getAttribute("data-coverage-zoom-target"))).toBe(24);
  await expect(globe).toHaveAttribute("data-coverage-admin-boundaries", "visible", { timeout: 15000 });
  await expect(globe).toHaveAttribute("data-coverage-admin-boundary-scope", "world");
  await expect(globe).toHaveAttribute("data-coverage-admin-boundary-regions", "2937");
  await expect(globe).toHaveAttribute("data-coverage-surface-detail", "aligned");
  await expect(globe).toHaveAttribute("data-coverage-surface-detail-countries", /^[1-9]\d{2,}$/);
  expect(Number(await globe.getAttribute("data-coverage-rotation-sensitivity"))).toBeLessThan(initialSensitivity * 0.6);
});

test("WebGL context loss shows recovery actions without loading a flat map", async ({ page }) => {
  const stage = await openCoverage(page);
  await page.locator(".coverage-globe-canvas").evaluate((canvas) => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });

  await expect(stage).toHaveAttribute("data-coverage-map-renderer", "unavailable");
  await expect(page.locator(".maps-globe-error")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.locator("svg.coverage-map")).toHaveCount(0);
});
