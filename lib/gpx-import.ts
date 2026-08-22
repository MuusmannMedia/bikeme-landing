export const gpxImportMaxFileBytes = 3 * 1024 * 1024;
export const gpxImportMaxPoints = 5000;
const serializedRouteMaxLength = 900_000;

type Coordinate = { latitude: number; longitude: number };

export type PlannedRouteCoordinate = Coordinate & { recorded_at: null };

export type PlannedRouteBounds = {
  min_latitude: number;
  max_latitude: number;
  min_longitude: number;
  max_longitude: number;
};

export type ImportedGpxRoute = {
  sourceType: "gpx_import";
  fileName: string | null;
  fileSizeBytes: number | null;
  routeCoordinates: PlannedRouteCoordinate[];
  pointCount: number;
  bounds: PlannedRouteBounds;
};

export type GpxImportErrorCode =
  | "FILE_TOO_LARGE"
  | "FILE_EMPTY"
  | "FILE_READ_FAILED"
  | "INVALID_GPX"
  | "ROUTE_TOO_SHORT";

export class GpxImportError extends Error {
  readonly code: GpxImportErrorCode;

  constructor(code: GpxImportErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "GpxImportError";
  }
}

function parseCoordinateAttribute(attributeValue: string | null): number | null {
  if (!attributeValue) return null;
  const parsed = Number(attributeValue.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function extractCoordinatesFromTag(xml: string, tagName: "trkpt" | "rtept"): Coordinate[] {
  const tagPattern = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  const latitudePattern = /\blat\s*=\s*["']([^"']+)["']/i;
  const longitudePattern = /\blon\s*=\s*["']([^"']+)["']/i;
  const coordinates: Coordinate[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(xml)) !== null) {
    const attributes = match[1] ?? "";
    const latitude = parseCoordinateAttribute(latitudePattern.exec(attributes)?.[1] ?? null);
    const longitude = parseCoordinateAttribute(longitudePattern.exec(attributes)?.[1] ?? null);
    if (latitude == null || longitude == null) continue;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
    coordinates.push({ latitude, longitude });
  }
  return coordinates;
}

function dedupeConsecutiveCoordinates(coordinates: Coordinate[]): Coordinate[] {
  const deduped: Coordinate[] = [];
  for (const coordinate of coordinates) {
    const previous = deduped.at(-1);
    if (
      previous &&
      Math.abs(previous.latitude - coordinate.latitude) < 0.0000001 &&
      Math.abs(previous.longitude - coordinate.longitude) < 0.0000001
    ) continue;
    deduped.push(coordinate);
  }
  return deduped;
}

function downsampleCoordinates(coordinates: Coordinate[], maxPoints: number): Coordinate[] {
  if (coordinates.length <= maxPoints) return coordinates;
  const step = Math.ceil((coordinates.length - 1) / (maxPoints - 1));
  const sampled: Coordinate[] = [];
  for (let index = 0; index < coordinates.length; index += step) sampled.push(coordinates[index]);
  const lastCoordinate = coordinates[coordinates.length - 1];
  const sampledLast = sampled.at(-1);
  if (
    !sampledLast ||
    Math.abs(sampledLast.latitude - lastCoordinate.latitude) >= 0.0000001 ||
    Math.abs(sampledLast.longitude - lastCoordinate.longitude) >= 0.0000001
  ) sampled.push(lastCoordinate);
  return sampled.length <= maxPoints
    ? sampled
    : [...sampled.slice(0, maxPoints - 1), sampled[sampled.length - 1]];
}

function computeBounds(coordinates: Coordinate[]): PlannedRouteBounds {
  let minLatitude = coordinates[0].latitude;
  let maxLatitude = coordinates[0].latitude;
  let minLongitude = coordinates[0].longitude;
  let maxLongitude = coordinates[0].longitude;
  for (const coordinate of coordinates) {
    minLatitude = Math.min(minLatitude, coordinate.latitude);
    maxLatitude = Math.max(maxLatitude, coordinate.latitude);
    minLongitude = Math.min(minLongitude, coordinate.longitude);
    maxLongitude = Math.max(maxLongitude, coordinate.longitude);
  }
  return {
    min_latitude: minLatitude,
    max_latitude: maxLatitude,
    min_longitude: minLongitude,
    max_longitude: maxLongitude
  };
}

function normalizeCoordinates(coordinates: Coordinate[], maxPoints = gpxImportMaxPoints): Coordinate[] {
  const valid = coordinates.filter(({ latitude, longitude }) =>
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
  );
  const normalized = downsampleCoordinates(dedupeConsecutiveCoordinates(valid), maxPoints);
  if (normalized.length < 2) throw new GpxImportError("ROUTE_TOO_SHORT", "GPX route must contain at least two valid points.");
  return normalized;
}

export function parseGpxText(
  xml: string,
  metadata: { fileName?: string | null; fileSizeBytes?: number | null } = {}
): ImportedGpxRoute {
  if (metadata.fileSizeBytes != null && metadata.fileSizeBytes > gpxImportMaxFileBytes) {
    throw new GpxImportError("FILE_TOO_LARGE", "The selected GPX file is too large.");
  }
  const trimmedXml = xml.trim();
  if (!trimmedXml) throw new GpxImportError("FILE_EMPTY", "GPX file is empty.");
  if (!/<gpx\b/i.test(trimmedXml)) throw new GpxImportError("INVALID_GPX", "The selected file is not GPX.");
  const trackCoordinates = extractCoordinatesFromTag(trimmedXml, "trkpt");
  const coordinates = normalizeCoordinates(
    trackCoordinates.length > 0 ? trackCoordinates : extractCoordinatesFromTag(trimmedXml, "rtept")
  );
  const routeCoordinates = coordinates.map((coordinate) => ({ ...coordinate, recorded_at: null as null }));
  return {
    sourceType: "gpx_import",
    fileName: metadata.fileName?.trim() || null,
    fileSizeBytes: metadata.fileSizeBytes != null && metadata.fileSizeBytes >= 0 ? metadata.fileSizeBytes : null,
    routeCoordinates,
    pointCount: routeCoordinates.length,
    bounds: computeBounds(coordinates)
  };
}

export function serializePlannedRoute(route: ImportedGpxRoute): string {
  return JSON.stringify(route);
}

export function parseSerializedPlannedRoute(value: FormDataEntryValue | null): ImportedGpxRoute | null | false {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > serializedRouteMaxLength) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  const candidate = parsed as Record<string, unknown>;
  if (candidate.sourceType !== "gpx_import" || !Array.isArray(candidate.routeCoordinates)) return false;
  const fileName = candidate.fileName == null
    ? null
    : typeof candidate.fileName === "string" && candidate.fileName.trim().length <= 500
      ? candidate.fileName.trim()
      : false;
  if (fileName === false) return false;
  const fileSizeBytes = candidate.fileSizeBytes == null ? null : Number(candidate.fileSizeBytes);
  if (
    fileSizeBytes != null &&
    (!Number.isInteger(fileSizeBytes) || fileSizeBytes < 0 || fileSizeBytes > gpxImportMaxFileBytes)
  ) return false;
  if (candidate.routeCoordinates.length < 2 || candidate.routeCoordinates.length > gpxImportMaxPoints) return false;
  const rawCoordinates: Coordinate[] = [];
  for (const entry of candidate.routeCoordinates) {
    if (!entry || typeof entry !== "object") return false;
    const row = entry as Record<string, unknown>;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
    rawCoordinates.push({ latitude, longitude });
  }
  let coordinates: Coordinate[];
  try {
    coordinates = normalizeCoordinates(rawCoordinates);
  } catch {
    return false;
  }
  const routeCoordinates = coordinates.map((coordinate) => ({ ...coordinate, recorded_at: null as null }));
  return {
    sourceType: "gpx_import",
    fileName,
    fileSizeBytes,
    routeCoordinates,
    pointCount: routeCoordinates.length,
    bounds: computeBounds(coordinates)
  };
}
