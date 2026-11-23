const { copyFileSync, mkdirSync } = require("node:fs");
const { dirname, join } = require("node:path");

const manifest = require.resolve("maplibre-gl/package.json");
const { version } = require(manifest);
const distribution = join(dirname(manifest), "dist");
const target = join(__dirname, "..", "public", "maplibre", version);

mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(distribution, file), join(target, file));
}
