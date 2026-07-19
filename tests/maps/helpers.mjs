import { expect } from "@playwright/test";

export async function openCoverage(page, renderer) {
  await page.goto("/en/coverage", { waitUntil: "domcontentloaded" });
  const stage = page.locator(".coverage-map-stage");
  await expect(stage).toBeVisible();
  await page.locator(`button[data-map-renderer-option="${renderer}"]`).click();
  await expect(stage).toHaveAttribute("data-coverage-map-renderer", renderer);

  if (renderer === "3d") {
    await expect(page.locator("[data-coverage-globe=ready] .coverage-globe-canvas")).toBeVisible();
  } else {
    await expect(stage.locator("svg.coverage-map")).toBeVisible();
  }

  await stage.scrollIntoViewIfNeeded();
  return stage;
}

export async function stopGlobeRotation(page) {
  const canvas = page.locator(".coverage-globe-canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("The 3D canvas has no bounding box");
  await page.touchscreen.tap(bounds.x + 4, bounds.y + 4);
  await page.waitForTimeout(120);
}

export async function lowestGlobeMarkerPoint(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(".coverage-globe-canvas");
    const canvasBounds = canvas?.getBoundingClientRect();
    if (!canvasBounds) return null;

    return [...document.querySelectorAll(".coverage-globe-hit-target:not([hidden])")]
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        const x = bounds.left + bounds.width / 2;
        const y = bounds.top + bounds.height / 2;
        return {
          key: element.dataset.coverageMarkerKey,
          topClass: document.elementFromPoint(x, y)?.className || "",
          x,
          y,
        };
      })
      .filter(
        ({ topClass, x, y }) =>
          x >= canvasBounds.left &&
          x <= canvasBounds.right &&
          y >= canvasBounds.top &&
          y <= canvasBounds.bottom &&
          String(topClass).includes("coverage-globe-canvas"),
      )
      .sort((first, second) => second.y - first.y)[0] || null;
  });
}

export async function lowestFlatMarkerPoint(page) {
  return page.evaluate(() => {
    const stageBounds = document.querySelector(".coverage-map-stage")?.getBoundingClientRect();
    if (!stageBounds) return null;

    return [...document.querySelectorAll('[data-coverage-marker-kind="event"], [data-coverage-marker-kind="event-cluster"]')]
      .filter((element) => element.closest("svg.coverage-map"))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          key: element.dataset.coverageMarkerKey,
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        };
      })
      .filter(({ x, y }) => x >= stageBounds.left && x <= stageBounds.right && y >= stageBounds.top && y <= stageBounds.bottom)
      .sort((first, second) => second.y - first.y)[0] || null;
  });
}

export async function captureMapEvents(page, property = "__coverageMapEvents") {
  await page.evaluate((eventProperty) => {
    window[eventProperty] = [];
    for (const type of ["pointerdown", "pointerup", "click"]) {
      document.addEventListener(
        type,
        (event) => {
          window[eventProperty].push({
            className: typeof event.target?.className === "string" ? event.target.className : event.target?.className?.baseVal || "",
            tagName: event.target?.tagName || "",
            type,
          });
        },
        true,
      );
    }
  }, property);
}

export async function dispatchTouch(page, type, pointerId, x, y) {
  await page.locator(".coverage-globe-canvas").evaluate(
    (canvas, eventInit) => {
      canvas.dispatchEvent(
        new PointerEvent(eventInit.type, {
          bubbles: true,
          cancelable: true,
          clientX: eventInit.x,
          clientY: eventInit.y,
          isPrimary: eventInit.pointerId === 1,
          pointerId: eventInit.pointerId,
          pointerType: "touch",
        }),
      );
    },
    { pointerId, type, x, y },
  );
}
