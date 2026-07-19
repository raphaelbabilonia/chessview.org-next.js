import { expect, test } from "@playwright/test";
import { openCoverage, stableVisibleGlobeMarker } from "./helpers.mjs";

test("the canonical maps page is a three-dimensional explorer with no renderer switch", async ({ page }) => {
  const stage = await openCoverage(page);

  await expect(page).toHaveURL(/\/en\/maps$/);
  await expect(stage).toHaveAttribute("data-coverage-map-renderer", "3d");
  await expect(page.locator("[data-map-renderer-option]")).toHaveCount(0);
  await expect(page.locator("svg.coverage-map")).toHaveCount(0);
  await expect(page.locator(".maps-context-panel")).toBeVisible();
  await expect(page.locator(".maps-country-row")).toHaveCount(5);
});

test("desktop keyboard users get persistent marker details in the context panel", async ({ page }) => {
  await openCoverage(page);

  const marker = await stableVisibleGlobeMarker(page);
  await marker.focus();
  await marker.press("Enter");
  await expect(page.locator(".maps-marker-card")).toBeVisible();

  const stage = page.locator(".coverage-map-stage");
  await stage.focus();
  await stage.press("Escape");
  await expect(page.locator(".maps-marker-card")).toHaveCount(0);
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

test("search and filters narrow both the service summary and country context", async ({ page }) => {
  await openCoverage(page);

  await page.getByRole("searchbox", { name: "Search tournaments and places" }).fill("Tokyo");
  await expect(page.locator(".maps-country-row")).toHaveCount(1);
  await expect(page.locator(".maps-country-row")).toContainText("Japan");
  await expect(page.locator(".coverage-filter-stats")).toContainText("1Active countries");
  await expect(page.locator(".coverage-filter-stats")).toContainText("1Tournaments");

  await page.getByRole("button", { name: "Map filters" }).click();
  await page.getByRole("button", { name: "Blitz" }).click();
  await expect(page.locator(".maps-country-row")).toHaveCount(0);
  await page.locator("#maps-filter-panel").getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator(".maps-country-row")).toHaveCount(5);
});

test("country and region selection focus the globe and update navigable context", async ({ page }) => {
  await openCoverage(page);
  const globe = page.locator("[data-coverage-globe=ready]");
  await expect(globe).toHaveAttribute("data-coverage-admin-boundaries", "hidden");
  await expect(globe).not.toHaveAttribute("data-coverage-admin-boundary-scope", /.+/);

  await page.locator(".maps-country-row", { hasText: "Argentina" }).click();
  await expect(page.locator(".maps-context-panel h2")).toContainText("Argentina");
  await expect.poll(async () => Number(await globe.getAttribute("data-coverage-zoom-target"))).toBeGreaterThan(1);
  await expect(globe).toHaveAttribute("data-coverage-admin-boundaries", /loading|fading|visible/, { timeout: 15000 });
  await expect(globe).toHaveAttribute("data-coverage-admin-boundary-scope", "argentina");
  await expect(globe).toHaveAttribute("data-coverage-admin-boundary-regions", "24");

  await page.locator(".coverage-region-card", { hasText: "Chubut" }).click();
  await expect(page.locator(".maps-breadcrumbs")).toContainText("Chubut");
  await expect(page.locator(".maps-context-panel h2")).toContainText("Chubut");
  await expect.poll(async () => Number(await globe.getAttribute("data-coverage-zoom-target"))).toBeGreaterThanOrEqual(6);
});

test("events without verified coordinates stay available in lists but are never plotted", async ({ page }) => {
  await openCoverage(page);
  await expect(page.getByText("Unmapped Spain Safety Fixture").first()).toBeVisible();
  await expect(page.locator('[aria-label^="Unmapped Spain Safety Fixture:"]')).toHaveCount(0);
});

test("rapid wheel input reaches deep zoom and reveals regional boundaries", async ({ page }) => {
  await openCoverage(page);
  await page.locator(".maps-country-row", { hasText: "Argentina" }).click();
  const globe = page.locator("[data-coverage-globe=ready]");
  const initialSensitivity = Number(await globe.getAttribute("data-coverage-rotation-sensitivity"));

  await page.locator(".coverage-globe-canvas").evaluate((canvas) => {
    for (let index = 0; index < 40; index += 1) {
      canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -160 }));
    }
  });

  await expect.poll(async () => Number(await globe.getAttribute("data-coverage-zoom-target"))).toBe(24);
  await expect(globe).toHaveAttribute("data-coverage-admin-boundaries", "visible", { timeout: 15000 });
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
