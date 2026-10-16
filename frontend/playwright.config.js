/* global process */
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173/app/",
    trace: "retain-on-failure",
    launchOptions: process.env.BSM_BROWSER_EXECUTABLE
      ? {
          executablePath: process.env.BSM_BROWSER_EXECUTABLE,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        }
      : {},
  },
  webServer: {
    command: "node tests/support/productionServer.mjs",
    url: "http://127.0.0.1:4173/app/",
    reuseExistingServer: false,
  },
});
