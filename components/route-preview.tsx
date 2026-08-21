import type { RoutePoint } from "@/lib/app-model";
import { buildRouteMapModel } from "@/lib/route-map";

function createPath(points: RoutePoint[]): string {
  const model = buildRouteMapModel(points);
  if (!model) return "";
  const coordinates = model.segments[0];
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const longitudes = coordinates.map(([longitude]) => longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latSpan = Math.max(maxLat - minLat, 0.00001);
  const lngSpan = Math.max(maxLng - minLng, 0.00001);
  return coordinates.map(([longitude, latitude], index) => {
    const x = 8 + ((longitude - minLng) / lngSpan) * 84;
    const y = 92 - ((latitude - minLat) / latSpan) * 84;
    const command = index === 0 ? "M" : "L";
    return `${command}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

export function RoutePreview({ points, label }: { points: RoutePoint[]; label: string }) {
  const path = createPath(points);
  if (!path) return null;
  return (
    <div className="bike-app-route" role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="bike-app-route-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8fa8ff" />
            <stop offset="1" stopColor="#c979d1" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="url(#bike-app-route-gradient)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
