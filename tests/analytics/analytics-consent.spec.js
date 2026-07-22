import { expect, test } from "@playwright/test";

const installPostHogStub = async (page, eventBodies, { doNotTrack = false } = {}) => {
  // PostHog correctly filters automated browsers. This suite intentionally
  // exercises the visitor capture path, so emulate a non-automated navigator.
  await page.addInitScript(({ shouldEnableDnt }) => {
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => false });
    if (shouldEnableDnt) {
      Object.defineProperty(navigator, "doNotTrack", { configurable: true, get: () => "1" });
      Object.defineProperty(window, "doNotTrack", { configurable: true, get: () => "1" });
    }
    const originalUserAgentData = navigator.userAgentData;
    if (originalUserAgentData) {
      Object.defineProperty(navigator, "userAgentData", {
        configurable: true,
        get: () => ({
          brands: [
            { brand: "Google Chrome", version: "138" },
            { brand: "Chromium", version: "138" },
          ],
          mobile: false,
          platform: "Windows",
          getHighEntropyValues: originalUserAgentData.getHighEntropyValues.bind(originalUserAgentData),
          toJSON: () => ({ brands: [], mobile: false, platform: "Windows" }),
        }),
      });
    }
  }, { shouldEnableDnt: doNotTrack });
  await page.route("**/ingest-test/**", async (route) => {
    const request = route.request();
    const body = request.postData() || "";
    if (body) eventBodies.push(body);

    if (request.url().includes("/flags")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ featureFlags: {}, flags: [], supportedCompression: [] }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
};

const pageviewCount = (bodies) => bodies.filter((body) => body.includes("%24pageview") || body.includes("$pageview")).length;

test("requires consent, persists the choice, and stops after withdrawal", async ({ page }) => {
  const eventBodies = [];
  await installPostHogStub(page, eventBodies);
  await page.goto("/en?email=private@example.com&utm_source=analytics-test");

  const consent = page.getByRole("dialog", { name: "Help us improve ChessView" });
  await expect(consent).toBeVisible();
  await page.waitForTimeout(300);
  expect(pageviewCount(eventBodies)).toBe(0);

  await consent.getByRole("button", { name: "Accept analytics" }).click();
  await expect(consent).toBeHidden();
  await expect.poll(() => pageviewCount(eventBodies)).toBe(1);
  expect(eventBodies.join(" ")).not.toContain("private@example.com");

  await page.goto("/en/events");
  await expect.poll(() => pageviewCount(eventBodies)).toBe(2);
  await expect(page.getByRole("dialog", { name: "Help us improve ChessView" })).toHaveCount(0);

  const beforeBusinessEvent = eventBodies.length;
  await page.getByRole("link", { name: "See more" }).first().click();
  await expect.poll(() => eventBodies.slice(beforeBusinessEvent).join(" ")).toContain("event_view_details");
  await expect.poll(() => pageviewCount(eventBodies)).toBe(3);
  expect(eventBodies.slice(beforeBusinessEvent).join(" ")).not.toContain("Southern Classical Open");

  const settingsTrigger = page.getByRole("button", { name: "Cookie settings" });
  await settingsTrigger.focus();
  await settingsTrigger.press("Enter");
  const settings = page.getByRole("dialog", { name: "Analytics settings" });
  await expect(settings).toContainText("Analytics accepted");
  await expect(settings.getByRole("button", { name: "Accept analytics" })).toBeFocused();
  await settings.press("Escape");
  await expect(settings).toBeHidden();
  await expect(settingsTrigger).toBeFocused();
  await settingsTrigger.press("Enter");
  await settings.getByRole("button", { name: "Reject analytics" }).click();

  const persistence = await page.evaluate(() => ({
    cookies: document.cookie,
    local: Object.keys(localStorage).filter((key) => key.startsWith("ph_")),
    session: Object.keys(sessionStorage).filter((key) => key.startsWith("ph_")),
  }));
  expect(persistence.cookies).not.toContain("ph_");
  expect(persistence.local).toEqual([]);
  expect(persistence.session).toEqual([]);

  await page.goto("/en/news");
  await page.waitForTimeout(300);
  expect(pageviewCount(eventBodies)).toBe(3);
});

test("rejects analytics without sending a pageview", async ({ page }) => {
  const eventBodies = [];
  await installPostHogStub(page, eventBodies);
  await page.goto("/it");

  const consent = page.getByRole("dialog", { name: "Aiutaci a migliorare ChessView" });
  await consent.getByRole("button", { name: "Rifiuta statistiche" }).click();
  await page.waitForTimeout(300);
  expect(pageviewCount(eventBodies)).toBe(0);
});

test("respects Do Not Track even if analytics is accepted", async ({ page }) => {
  const eventBodies = [];
  await installPostHogStub(page, eventBodies, { doNotTrack: true });
  await page.goto("/en");

  const consent = page.getByRole("dialog", { name: "Help us improve ChessView" });
  await consent.getByRole("button", { name: "Accept analytics" }).click();
  await page.waitForTimeout(300);
  expect(pageviewCount(eventBodies)).toBe(0);
});

test("localizes consent and shows the anonymous survey only when eligible", async ({ page }) => {
  const eventBodies = [];
  await installPostHogStub(page, eventBodies);
  await page.addInitScript(() => {
    localStorage.setItem(
      "chessview_analytics_consent",
      JSON.stringify({ version: 1, status: "granted", updatedAt: new Date().toISOString() })
    );
    sessionStorage.setItem("chessview_analytics_pageviews", "2");
    sessionStorage.setItem("chessview_analytics_session_started", new Date(Date.now() - 31_000).toISOString());
  });

  await page.goto("/es");
  const survey = page.getByRole("dialog", { name: "¿Qué te trae a ChessView?" });
  await expect(survey).toBeVisible();
  await survey.getByText("Organizador/a", { exact: true }).click();
  await survey.getByText("Organizar o publicar un evento", { exact: true }).click();
  await survey.getByRole("button", { name: "Enviar respuestas anónimas" }).click();
  await expect(survey).toContainText("Tus comentarios anónimos");
  expect(eventBodies.join(" ")).not.toContain("visitor-role");
});
