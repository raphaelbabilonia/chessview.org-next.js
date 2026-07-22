import { defineConfig, devices } from "@playwright/test";

const siteUrl = "http://127.0.0.1:3018";
const apiUrl = "http://127.0.0.1:5018/api";

export default defineConfig({
  expect: { timeout: 7000 },
  forbidOnly: Boolean(process.env.CI),
  outputDir: "output/playwright/analytics-results",
  reporter: process.env.CI ? [["github"], ["line"]] : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "tests/analytics",
  timeout: 45_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: siteUrl,
    // Exercise the same SDK path as a real visitor; PostHog intentionally
    // filters Playwright's default HeadlessChrome user agent as bot traffic.
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/fixtures/coverage-api.mjs",
      env: {
        ...process.env,
        TEST_API_PORT: "5018",
      },
      port: 5018,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3018",
      env: {
        ...process.env,
        API_BASE_URL: apiUrl,
        NEXT_PUBLIC_ANALYTICS_ENABLED: "true",
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test_chessview",
        NEXT_PUBLIC_POSTHOG_HOST: "/ingest-test",
        NEXT_PUBLIC_COVERAGE_MAP_PERFORMANCE_PROBE: "false",
        NEXT_PUBLIC_SITE_URL: siteUrl,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: `${siteUrl}/en`,
    },
  ],
});
