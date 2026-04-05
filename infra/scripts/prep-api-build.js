#!/usr/bin/env node
/**
 * Builds @comms-lib/db-mongo and @comms-lib/db-elasticsearch before apps/api `tsc`.
 * Docker sets SKIP_DB_DRIVERS_BUILD=1 after building drivers in the same RUN.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

if (process.env.SKIP_DB_DRIVERS_BUILD === "1") {
  process.exit(0);
}

const root = path.resolve(__dirname, "../..");
const marker = path.join(root, "packages/database/mongo/package.json");
if (!fs.existsSync(marker)) {
  console.warn("prep-api-build: packages/database/mongo not found, skipping db driver build");
  process.exit(0);
}

execSync("npm run build -w @comms-lib/db-mongo -w @comms-lib/db-elasticsearch", {
  cwd: root,
  stdio: "inherit",
});
