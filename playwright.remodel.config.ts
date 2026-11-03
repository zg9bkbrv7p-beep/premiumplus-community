import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
const database = join(
  tmpdir(),
  "vision-remodel-e2e-" + randomUUID() + ".sqlite",
);
const webkit = process.env.REMODEL_TEST_BROWSER === "webkit";
export default defineConfig({
  testDir: "tests/remodel-browser",
  timeout: 60000,
  workers: 1,
  metadata: { database },
  globalTeardown: "./tests/db-teardown.ts",
  outputDir: "test-results-remodel",
  use: {
    baseURL: "http://localhost:3101",
    headless: true,
    browserName: webkit ? "webkit" : "chromium",
    launchOptions: webkit
      ? {}
      : {
          executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `NODE_ENV=test DATABASE_PATH=${database} node --import tsx tests/remodel-server.ts`,
    url: "http://localhost:3101/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
