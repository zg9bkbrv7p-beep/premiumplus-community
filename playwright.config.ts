import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
const database = join(tmpdir(), "vision-e2e-" + randomUUID() + ".sqlite");
export default defineConfig({
  testDir: "tests/browser",
  timeout: 45000,
  metadata: { database },
  globalTeardown: "./tests/db-teardown.ts",
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `PORT=3100 DATABASE_PATH=${database} node --import tsx server/index.ts`,
    url: "http://localhost:3100/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
