import type { FullConfig } from "@playwright/test";
import { rmSync } from "node:fs";
export default async function teardown(config: FullConfig) {
  const path = config.metadata.database as string;
  for (const suffix of ["", "-wal", "-shm"])
    rmSync(path + suffix, { force: true });
}
