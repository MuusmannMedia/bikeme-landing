import type { RoutePoint } from "./app-model";

export const OPEN_FREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

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

function coordinate(point: RoutePoint): RouteMapCoordinate {
  return [point.longitude, point.latitude];
}

export function buildRouteMapModel(points: RoutePoint[]): RouteMapModel | null {
  const renderedPoints = points.filter(isValidPoint);
  if (renderedPoints.length < 2) return null;

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
    segments: [renderedPoints.map(coordinate)],
    bounds: [[minLongitude, minLatitude], [maxLongitude, maxLatitude]],
    start: coordinate(renderedPoints[0]),
    finish: coordinate(renderedPoints.at(-1)!)
  };
}
