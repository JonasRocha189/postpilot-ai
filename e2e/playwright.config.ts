import { defineConfig, devices } from "@playwright/test";

/**
 * Acceptance tests (Playwright).
 *
 * - Default: starts the frontend on :5174 with the mock API and mock login
 *   (no backend needed; deterministic).
 * - E2E_BASE_URL=http://localhost:5173: runs against an app that is already
 *   running, e.g. the local full stack (frontend + FastAPI + Postgres +
 *   LocalStack) or, later, the published environment.
 */
const externalUrl = process.env.E2E_BASE_URL;
const port = 5174;

export default defineConfig({
  testDir: "./tests",
  // The flows create and delete their own data; keep one worker so they never race
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  // The Vite dev server compiles each lazy page on its first visit
  expect: { timeout: 15_000 },
  use: {
    baseURL: externalUrl ?? `http://localhost:${port}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /responsive\.spec\.ts/,
    },
    // Mobile-first requirement: the main flow must also work on a phone
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: externalUrl
    ? undefined
    : {
        command: `npm run dev -- --port ${port} --strictPort`,
        cwd: "../frontend",
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Empty values beat frontend/.env: mock API and mock login
        env: {
          VITE_API_URL: "",
          VITE_AUTH0_DOMAIN: "",
          VITE_AUTH0_CLIENT_ID: "",
        },
      },
});
