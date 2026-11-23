import { version } from "maplibre-gl/package.json";

export async function loadMapLibre() {
  const maplibre = await import("maplibre-gl");
  maplibre.setWorkerUrl(`/maplibre/${version}/maplibre-gl-worker.mjs`);
  return maplibre;
}
