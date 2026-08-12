import type { RoutePoint } from "./app-model";

export const OPEN_FREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const EARTH_RADIUS_METERS = 6_371_000;
const GPS_OUTLIER_MAX_SPEED_MPS = 100 / 3.6;

export type RouteMapCoordinate = [longitude: number, latitude: number];

export type RouteMapModel = {
  segments: RouteMapCoordinate[][];
  bounds: [southWest: RouteMapCoordinate, northEast: RouteMapCoordinate];
  start: RouteMapCoordinate;
  finish: RouteMapCoordinate;
};

function isValidPoint(point: RoutePoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function recordedAtMs(point: RoutePoint): number | null {
  if (!point.recordedAt) return null;
  const value = Date.parse(point.recordedAt);
  return Number.isFinite(value) ? value : null;
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

function distanceMeters(previous: RoutePoint, current: RoutePoint): number {
  const deltaLatitude = toRadians(current.latitude - previous.latitude);
  const deltaLongitude = toRadians(current.longitude - previous.longitude);
  const previousLatitude = toRadians(previous.latitude);
  const currentLatitude = toRadians(current.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.sin(deltaLongitude / 2) ** 2 * Math.cos(previousLatitude) * Math.cos(currentLatitude);
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function continuesSegment(previous: RoutePoint, current: RoutePoint): boolean {
  if (current.startsNewSegment) return false;
  const distance = distanceMeters(previous, current);
  if (!Number.isFinite(distance) || distance <= 0) return false;

  const previousAt = recordedAtMs(previous);
  const currentAt = recordedAtMs(current);
  if (previousAt != null && currentAt != null) {
    const durationSeconds = (currentAt - previousAt) / 1000;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
    if (distance / durationSeconds > GPS_OUTLIER_MAX_SPEED_MPS) return false;
  }
  return true;
}

function coordinate(point: RoutePoint): RouteMapCoordinate {
  return [point.longitude, point.latitude];
}

export function buildRouteMapModel(points: RoutePoint[]): RouteMapModel | null {
  const pointSegments: RoutePoint[][] = [];
  let currentSegment: RoutePoint[] = [];
  const finishSegment = () => {
    if (currentSegment.length >= 2) pointSegments.push(currentSegment);
    currentSegment = [];
  };

  for (const point of points) {
    if (!isValidPoint(point)) {
      finishSegment();
      continue;
    }
    const previous = currentSegment.at(-1);
    if (previous && !continuesSegment(previous, point)) finishSegment();
    currentSegment.push(point);
  }
  finishSegment();

  if (pointSegments.length === 0) return null;

  const renderedPoints = pointSegments.flat();

  let minLatitude = renderedPoints[0].latitude;
  let maxLatitude = renderedPoints[0].latitude;
  let minLongitude = renderedPoints[0].longitude;
  let maxLongitude = renderedPoints[0].longitude;
  for (const point of renderedPoints.slice(1)) {
    minLatitude = Math.min(minLatitude, point.latitude);
    maxLatitude = Math.max(maxLatitude, point.latitude);
    minLongitude = Math.min(minLongitude, point.longitude);
    maxLongitude = Math.max(maxLongitude, point.longitude);
  }

  return {
    segments: pointSegments.map((segment) => segment.map(coordinate)),
    bounds: [[minLongitude, minLatitude], [maxLongitude, maxLatitude]],
    start: coordinate(renderedPoints[0]),
    finish: coordinate(renderedPoints.at(-1)!)
  };
}
