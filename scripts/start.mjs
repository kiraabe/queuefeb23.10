import { existsSync } from "node:fs";
import { resolve } from "node:path";

const productionEntry = resolve("dist/server/production.mjs");
const legacyEntry = resolve("dist/server/node-build.mjs");

const entryPath = existsSync(productionEntry)
  ? productionEntry
  : existsSync(legacyEntry)
    ? legacyEntry
    : null;

if (!entryPath) {
  console.error(
    "Unable to find server bundle. Expected dist/server/production.mjs",
  );
  console.error(
    "If you are running on Render, ensure build:server completed successfully.",
  );
  process.exit(1);
}

await import(entryPath);
