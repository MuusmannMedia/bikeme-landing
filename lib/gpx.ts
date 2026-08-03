import type { RoutePoint } from "./app-model";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

export function buildGpx(title: string, route: RoutePoint[]): string | null {
  const valid = route.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  if (valid.length < 2) return null;
  const segments: RoutePoint[][] = [];
  let current: RoutePoint[] = [];
  for (const point of valid) {
    if (point.startsNewSegment && current.length > 0) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length >= 2) segments.push(current);
  if (segments.length === 0) return null;
  const segmentXml = segments.map((segment) => `    <trkseg>\n${segment.map((point) => {
    const children = [
      point.elevation == null ? "" : `<ele>${Number(point.elevation.toFixed(2))}</ele>`,
      point.recordedAt ? `<time>${escapeXml(new Date(point.recordedAt).toISOString())}</time>` : ""
    ].join("");
    return `      <trkpt lat="${point.latitude}" lon="${point.longitude}">${children}</trkpt>`;
  }).join("\n")}\n    </trkseg>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Bike ME" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>${escapeXml(title.trim() || "Bike ME ride")}</name>\n${segmentXml}\n  </trk>\n</gpx>`;
}
