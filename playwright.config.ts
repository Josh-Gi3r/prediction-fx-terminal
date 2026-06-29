import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke configuration.
 *
 * Run against a production build:
 *   bun run build && bun run start -- -p 3199
 *   bunx playwright test
 *
 * Or point at an already-running dev server:
 *   PORT=3199 bun run dev
 *   bunx playwright test
 *
 * The webServer block will start `bun run start -- -p 3199` automatically when
 * no server is already listening on that port (reuseExistingServer: true).
 * If .next does not exist, playwright will fail at the webServer startup step —
 * run `bun run build` first.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3199",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run start -- -p 3199",
    url: "http://localhost:3199",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
