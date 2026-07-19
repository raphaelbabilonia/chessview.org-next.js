import { expect, test } from "@playwright/test";
import { openCoverage } from "./helpers.mjs";

test("desktop keyboard users can open and close 3D marker previews", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openCoverage(page, "3d");

  const marker = page.locator(".coverage-globe-hit-target:not([hidden])").first();
  await expect(marker).toHaveAttribute("data-coverage-marker-key", /.+/);
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

test("renderer preference survives reload", async ({ page }) => {
  await openCoverage(page, "2d");
  await page.reload();
  await expect(page.locator(".coverage-map-stage")).toHaveAttribute("data-coverage-map-renderer", "2d");
  await expect(page.locator('button[data-map-renderer-option="2d"]')).toHaveAttribute("aria-pressed", "true");
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
