import { defineConfig, devices } from "@playwright/test";

const siteUrl = "http://127.0.0.1:3017";
const apiUrl = "http://127.0.0.1:5017/api";

export default defineConfig({
  expect: {
    timeout: 5000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "output/playwright/test-results",
  reporter: process.env.CI ? [["github"], ["line"]] : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "tests/maps",
  timeout: process.env.CI ? 60000 : 30000,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: siteUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/fixtures/coverage-api.mjs",
      port: 5017,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3017",
      env: {
        ...process.env,
        API_BASE_URL: apiUrl,
        NEXT_PUBLIC_COVERAGE_MAP_PERFORMANCE_PROBE: "false",
        NEXT_PUBLIC_SITE_URL: siteUrl,
        NEXT_PUBLIC_TRACKING_ENABLED: "false",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      url: `${siteUrl}/en/maps`,
    },
  ],
  projects: [
    {
      name: "mobile-webkit",
      testMatch: /coverage-mobile\.spec\.js/,
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
      },
    },
    {
      name: "desktop-chromium",
      testMatch: /coverage-desktop\.spec\.js/,
      use: {
        browserName: "chromium",
        viewport: { height: 900, width: 1440 },
      },
    },
  ],
});
