/* global process */
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/backend",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4180/app/",
    trace: "retain-on-failure",
    launchOptions: process.env.BSM_BROWSER_EXECUTABLE
      ? {
          executablePath: process.env.BSM_BROWSER_EXECUTABLE,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        }
      : {},
  },
  webServer: {
    command: "node tests/support/backendServer.mjs",
    url: "http://127.0.0.1:4180/api/setup/status",
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
