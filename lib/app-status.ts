import type { Locale } from "./locales";
import type { RideHistorySummary, RoutePoint, StatusHistoryRide, ZoneDistribution } from "./app-model";
import { getLocaleTag } from "./app-format";

export type StatusRange = "7D" | "1M" | "3M" | "6M" | "YTD" | "1Y";
export type StatusMetric = "distance" | "elevation" | "duration";

export type StatusBucket = {
  id: string;
  label: string;
  start: string;
  end: string;
  distanceKm: number;
  elevationMeters: number;
  durationMinutes: number;
  rideCount: number;
};

export type StatusSummary = {
  buckets: StatusBucket[];
  totals: Omit<StatusBucket, "id" | "label" | "start" | "end">;
  comparisonPercent: number | null;
  start: string;
  end: string;
};

export type StatusWeeklySummary = {
  id: string;
  weekNumber: number;
  isCurrent: boolean;
  distanceKm: number;
  elevationMeters: number;
  durationMinutes: number;
};

export type StatusZoneSummary = {
  seconds: number[];
  totalSeconds: number;
  usedAveragePowerFallback: boolean;
  emptyReason: "rides" | "ftp" | "watts" | null;
};

export type StatusPowerSummary = {
  estimatedFtpWatts: number | null;
  wattsPerKg: number | null;
  maxWatts: number | null;
  latestAverageWatts: number | null;
};

export type StatusRecords = {
  estimatedFastestSeconds: Record<1 | 5 | 10, number | null>;
  longestDistanceKm: number | null;
  longestDurationMinutes: number | null;
  mostElevationMeters: number | null;
  topSpeedKmh: number | null;
  highestWatts: number | null;
};

export type StatusInsights = {
  weeks: StatusWeeklySummary[];
  streakWeeks: number;
  streakActivities: number;
  power: StatusPowerSummary;
  zones: StatusZoneSummary;
  records: StatusRecords;
};

export type StatusCalendarDay = {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  rides: StatusHistoryRide[];
};

type StatusRide = RideHistorySummary & Partial<Pick<StatusHistoryRide, "route" | "zones">>;
type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export const statusRanges: readonly StatusRange[] = ["7D", "1M", "3M", "6M", "YTD", "1Y"];
export const statusMetrics: readonly StatusMetric[] = ["distance", "elevation", "duration"];
export const statusFallbackTimeZone = "Europe/Copenhagen";
export const statusZoneColors = ["#C084FC", "#B56AF7", "#A855F7", "#9C4EE8", "#A855F7", "#8A3EC9", "#6D28D9"] as const;

const MAX_REALISTIC_AVERAGE_SPEED_KMH = 90;
const MAX_REALISTIC_TOP_SPEED_KMH = 120;
const FTP_MIN_DURATION_MINUTES = 20;
const MAX_AVERAGE_WATTS = 1200;
const AVERAGE_WATTS_INFLATION_FACTOR = 1.25;
const MAX_WATTS = 2000;
const GPS_OUTLIER_MAX_SPEED_MPS = 100 / 3.6;
const MOVING_SEGMENT_MIN_SPEED_MPS = 0.5;
const MAX_ELEVATION_GAIN_METERS = 9000;
const MAX_ELEVATION_GAIN_METERS_PER_KM = 150;
const MIN_ELEVATION_GAIN_CAP_METERS = 1500;
const WEEK_SUMMARY_COUNT = 12;

function validTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
    return timeZone;
  } catch {
    return statusFallbackTimeZone;
  }
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: validTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

function zonedDate(parts: ZonedParts, timeZone: string, millisecond = 0): Date {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, millisecond);
  let candidate = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedParts(new Date(candidate), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, millisecond);
    const delta = desired - actualAsUtc;
    candidate += delta;
    if (delta === 0) break;
  }
  return new Date(candidate);
}

function shiftCalendarDate(parts: Pick<ZonedParts, "year" | "month" | "day">, days: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function startOfZonedDay(date: Date, timeZone: string): Date {
  const parts = getZonedParts(date, timeZone);
  return zonedDate({ ...parts, hour: 0, minute: 0, second: 0 }, timeZone);
}

function addZonedDays(date: Date, days: number, timeZone: string): Date {
  const parts = getZonedParts(date, timeZone);
  const shifted = shiftCalendarDate(parts, days);
  return zonedDate({ ...shifted, hour: parts.hour, minute: parts.minute, second: parts.second }, timeZone, date.getMilliseconds());
}

function endOfZonedDay(date: Date, timeZone: string): Date {
  const parts = getZonedParts(date, timeZone);
  return zonedDate({ ...parts, hour: 23, minute: 59, second: 59 }, timeZone, 999);
}

export function statusDateKey(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getStatusWindow(range: StatusRange, now = new Date(), timeZone = statusFallbackTimeZone) {
  const todayStart = startOfZonedDay(now, timeZone);
  const todayEnd = endOfZonedDay(now, timeZone);
  const nowParts = getZonedParts(now, timeZone);
  if (range === "7D") return { start: addZonedDays(todayStart, -6, timeZone), end: todayEnd, bucketCount: 7 };
  if (range === "1M") return { start: addZonedDays(todayStart, -29, timeZone), end: todayEnd, bucketCount: 6 };
  if (range === "3M") return { start: addZonedDays(todayStart, -89, timeZone), end: todayEnd, bucketCount: 12 };
  if (range === "6M") return { start: addZonedDays(todayStart, -179, timeZone), end: todayEnd, bucketCount: 12 };
  if (range === "YTD") {
    return {
      start: zonedDate({ year: nowParts.year, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, timeZone),
      end: todayEnd,
      bucketCount: Math.max(1, nowParts.month)
    };
  }
  return { start: addZonedDays(todayStart, -364, timeZone), end: todayEnd, bucketCount: 12 };
}

function metricValue(bucket: Pick<StatusBucket, "distanceKm" | "elevationMeters" | "durationMinutes">, metric: StatusMetric): number {
  return metric === "distance" ? bucket.distanceKm : metric === "elevation" ? bucket.elevationMeters : bucket.durationMinutes;
}

function finitePositive(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function validCoordinate(point: RoutePoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180;
}

export function haversineDistanceMeters(a: RoutePoint, b: RoutePoint): number {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const firstLat = radians(a.latitude);
  const secondLat = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function routeMovingDurationMinutes(route: RoutePoint[]): number | null {
  let seconds = 0;
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    if (current.startsNewSegment || !validCoordinate(previous) || !validCoordinate(current)) continue;
    const previousMs = Date.parse(previous.recordedAt ?? "");
    const currentMs = Date.parse(current.recordedAt ?? "");
    const duration = (currentMs - previousMs) / 1000;
    if (!Number.isFinite(duration) || duration <= 0) continue;
    const distance = haversineDistanceMeters(previous, current);
    const speed = distance / duration;
    if (distance < 1 || speed < MOVING_SEGMENT_MIN_SPEED_MPS || speed > GPS_OUTLIER_MAX_SPEED_MPS) continue;
    seconds += duration;
  }
  return seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null;
}

export function deriveStatusElevationFromRoute(route: RoutePoint[]): number | null {
  if (route.length < 2) return null;
  let window: number[] = [];
  let last: number | null = null;
  let valley: number | null = null;
  let peak: number | null = null;
  let credited = 0;
  let total = 0;
  let samples = 0;

  for (let index = 0; index < route.length; index += 1) {
    const current = route[index];
    if (!validCoordinate(current) || !Number.isFinite(current.elevation)) continue;
    if (current.altitudeAccuracy != null && current.altitudeAccuracy > 100) continue;
    const altitude = Number(current.elevation);
    if (current.startsNewSegment) {
      window = [];
      last = null;
      valley = null;
      peak = null;
      credited = 0;
    }
    let accepted = true;
    if (index > 0) {
      const previous = route[index - 1];
      if (!current.startsNewSegment && validCoordinate(previous) && Number.isFinite(previous.elevation)) {
        const previousMs = Date.parse(previous.recordedAt ?? "");
        const currentMs = Date.parse(current.recordedAt ?? "");
        if (Number.isFinite(previousMs) && Number.isFinite(currentMs) && currentMs > previousMs) {
          const elapsed = (currentMs - previousMs) / 1000;
          const distance = haversineDistanceMeters(previous, current);
          const delta = altitude - Number(previous.elevation);
          accepted = distance >= 5 && Math.abs(delta) / elapsed <= 3 && Math.abs(distance > 0 ? delta / distance : 0) <= 0.35;
        }
      }
    }
    if (!accepted) continue;
    window = [...window, altitude].slice(-5);
    const smoothed = window.reduce((sum, value) => sum + value, 0) / window.length;
    samples += 1;
    if (last == null) {
      last = smoothed;
      valley = smoothed;
      peak = smoothed;
      credited = 0;
      continue;
    }
    let resolvedValley: number = valley ?? last;
    let resolvedPeak: number = peak ?? resolvedValley;
    if (smoothed < resolvedValley) {
      resolvedValley = smoothed;
      resolvedPeak = smoothed;
      credited = 0;
    } else {
      resolvedPeak = Math.max(resolvedPeak, smoothed);
      const climb = resolvedPeak - resolvedValley;
      const uncredited = climb - credited;
      if (climb >= 2 && uncredited >= 0.5) {
        total += uncredited;
        credited += uncredited;
      }
      if (resolvedPeak - smoothed >= 2) {
        resolvedValley = smoothed;
        resolvedPeak = smoothed;
        credited = 0;
      }
    }
    valley = resolvedValley;
    peak = resolvedPeak;
    last = smoothed;
  }
  return samples >= 6 && total > 0 ? Number(total.toFixed(1)) : null;
}

export function resolveStatusElevation(ride: StatusRide): number {
  const fromRoute = deriveStatusElevationFromRoute(ride.route ?? []);
  if (fromRoute != null && fromRoute > 0) return fromRoute;
  const raw = finitePositive(ride.elevationGain);
  if (raw == null) return 0;
  const cap = Math.min(MAX_ELEVATION_GAIN_METERS, ride.distanceKm && ride.distanceKm > 0
    ? Math.max(MIN_ELEVATION_GAIN_CAP_METERS, ride.distanceKm * MAX_ELEVATION_GAIN_METERS_PER_KM)
    : MAX_ELEVATION_GAIN_METERS);
  if (raw <= cap) return raw;
  return [raw / 100, raw / 10].find((value) => value > 0 && value <= cap) ?? 0;
}

export function buildStatusSummary(
  history: StatusRide[],
  range: StatusRange,
  metric: StatusMetric,
  locale: Locale,
  now = new Date(),
  timeZone = statusFallbackTimeZone
): StatusSummary {
  const { start, end, bucketCount } = getStatusWindow(range, now, timeZone);
  const windowMs = Math.max(1, end.getTime() - start.getTime() + 1);
  const bucketMs = windowMs / bucketCount;
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - windowMs + 1);
  const formatter = new Intl.DateTimeFormat(getLocaleTag(locale), {
    timeZone: validTimeZone(timeZone),
    ...(range === "7D" ? { weekday: "short" as const } : range === "1M" ? { day: "numeric" as const, month: "short" as const } : { month: "short" as const })
  });
  const buckets = Array.from({ length: bucketCount }, (_, index): StatusBucket => {
    const bucketStart = new Date(start.getTime() + bucketMs * index);
    const bucketEnd = index === bucketCount - 1 ? end : new Date(start.getTime() + bucketMs * (index + 1) - 1);
    return {
      id: `${range}-${index}`,
      label: formatter.format(bucketStart).replace(".", ""),
      start: bucketStart.toISOString(),
      end: bucketEnd.toISOString(),
      distanceKm: 0,
      elevationMeters: 0,
      durationMinutes: 0,
      rideCount: 0
    };
  });
  const previous = { distanceKm: 0, elevationMeters: 0, durationMinutes: 0, rideCount: 0 };
  const add = (target: typeof previous, ride: StatusRide) => {
    target.distanceKm += finitePositive(ride.distanceKm) ?? 0;
    target.elevationMeters += resolveStatusElevation(ride);
    target.durationMinutes += finitePositive(ride.durationMinutes) ?? 0;
    target.rideCount += 1;
  };
  for (const ride of history) {
    const timestamp = Date.parse(ride.startedAt);
    if (!Number.isFinite(timestamp)) continue;
    if (timestamp >= start.getTime() && timestamp <= end.getTime()) {
      add(buckets[Math.min(bucketCount - 1, Math.max(0, Math.floor((timestamp - start.getTime()) / bucketMs)))], ride);
    } else if (timestamp >= previousStart.getTime() && timestamp <= previousEnd.getTime()) {
      add(previous, ride);
    }
  }
  const totals = buckets.reduce((result, bucket) => ({
    distanceKm: result.distanceKm + bucket.distanceKm,
    elevationMeters: result.elevationMeters + bucket.elevationMeters,
    durationMinutes: result.durationMinutes + bucket.durationMinutes,
    rideCount: result.rideCount + bucket.rideCount
  }), { distanceKm: 0, elevationMeters: 0, durationMinutes: 0, rideCount: 0 });
  const currentValue = metricValue(totals, metric);
  const previousValue = metricValue(previous, metric);
  return {
    buckets,
    totals,
    comparisonPercent: previousValue > 0 ? Math.round(((currentValue - previousValue) / previousValue) * 100) : null,
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function estimatePower(distanceKm: number | null, durationMinutes: number | null, elevationMeters: number, weightKg: number | null, fallbackDurationMinutes?: number | null): number {
  if (!distanceKm || distanceKm <= 0 || !durationMinutes || durationMinutes <= 0) return 0;
  const distanceMeters = distanceKm * 1000;
  const activeSpeed = distanceMeters / (durationMinutes * 60);
  const fallbackSpeed = fallbackDurationMinutes && fallbackDurationMinutes > 0 ? distanceMeters / (fallbackDurationMinutes * 60) : null;
  const duration = activeSpeed > 15 && fallbackSpeed != null && fallbackSpeed <= 15 ? fallbackDurationMinutes! : durationMinutes;
  const speed = Math.min(15, distanceMeters / (duration * 60));
  if (speed < 0.5) return 0;
  const totalMass = (weightKg && weightKg > 0 ? weightKg + 9 : 85);
  const grade = Math.max(0, Math.min(0.25, elevationMeters / distanceMeters));
  const gravity = totalMass * 9.81 * Math.sin(Math.atan(grade));
  const rolling = totalMass * 9.81 * 0.004;
  const aero = 0.5 * 0.32 * 1.225 * speed ** 2;
  return Math.max(0, Math.min(1500, Math.round((gravity + rolling + aero) * speed)));
}

export function resolveStatusAverageWatts(ride: StatusRide, weightKg: number | null): number | null {
  const stored = finitePositive(ride.averageWatts);
  const normalizedStored = stored != null && stored <= MAX_AVERAGE_WATTS ? stored : null;
  const duration = finitePositive(ride.durationMinutes);
  const movingDuration = routeMovingDurationMinutes(ride.route ?? []);
  const estimated = estimatePower(finitePositive(ride.distanceKm), movingDuration ?? duration, resolveStatusElevation(ride), weightKg, duration);
  const normalizedEstimate = estimated > 0 && estimated <= MAX_AVERAGE_WATTS ? estimated : null;
  if (normalizedStored != null && normalizedEstimate != null && normalizedStored > normalizedEstimate * AVERAGE_WATTS_INFLATION_FACTOR) return normalizedEstimate;
  return normalizedStored ?? normalizedEstimate;
}

function isoWeekNumber(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

function startOfWeek(date: Date, timeZone: string): Date {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: validTimeZone(timeZone), weekday: "short" }).format(date);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
  return addZonedDays(startOfZonedDay(date, timeZone), -((index + 6) % 7), timeZone);
}

function routeMaxSpeedKmh(route: RoutePoint[]): number | null {
  let maximum = 0;
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    if (current.startsNewSegment || !validCoordinate(previous) || !validCoordinate(current)) continue;
    const elapsed = (Date.parse(current.recordedAt ?? "") - Date.parse(previous.recordedAt ?? "")) / 1000;
    if (!Number.isFinite(elapsed) || elapsed <= 0) continue;
    const speed = haversineDistanceMeters(previous, current) / elapsed * 3.6;
    if (speed > 0) maximum = Math.max(maximum, speed);
  }
  return maximum > 0 ? maximum : null;
}

function zoneIndex(averageWatts: number, ftp: number): number | null {
  if (averageWatts <= 0 || ftp <= 0) return null;
  const ratio = averageWatts / ftp;
  if (ratio < 0.55) return 0;
  if (ratio <= 0.75) return 1;
  if (ratio <= 0.9) return 2;
  if (ratio <= 1.05) return 3;
  if (ratio <= 1.2) return 4;
  if (ratio <= 1.5) return 5;
  return 6;
}

function zoneValues(zones: ZoneDistribution | null | undefined): number[] {
  return (["z1", "z2", "z3", "z4", "z5", "z6", "z7"] as const).map((key) => Math.max(0, Math.round(finitePositive(zones?.[key]) ?? 0)));
}

export function buildStatusInsights(
  history: StatusHistoryRide[],
  range: StatusRange,
  profile: { weightKg: number | null; ftp: number | null },
  now = new Date(),
  timeZone = statusFallbackTimeZone
): StatusInsights {
  const currentWeek = startOfWeek(now, timeZone);
  const weeks: StatusWeeklySummary[] = Array.from({ length: WEEK_SUMMARY_COUNT }, (_, index) => {
    const start = addZonedDays(currentWeek, -7 * index, timeZone);
    return { id: statusDateKey(start, timeZone), weekNumber: isoWeekNumber(start, timeZone), isCurrent: index === 0, distanceKm: 0, elevationMeters: 0, durationMinutes: 0 };
  });
  const weekMap = new Map(weeks.map((week) => [week.id, week]));
  const weekCounts = new Map<string, number>();
  const candidates: Array<{ distanceKm: number; speedKmh: number }> = [];
  let longestDurationMinutes: number | null = null;
  let mostElevationMeters: number | null = null;
  let topSpeedKmh: number | null = null;
  let highestWatts: number | null = null;

  for (const ride of history) {
    const started = new Date(ride.startedAt);
    if (!Number.isFinite(started.getTime())) continue;
    const weekKey = statusDateKey(startOfWeek(started, timeZone), timeZone);
    weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1);
    const distance = finitePositive(ride.distanceKm) ?? 0;
    const duration = finitePositive(ride.durationMinutes) ?? 0;
    const elevation = resolveStatusElevation(ride);
    const week = weekMap.get(weekKey);
    if (week) {
      week.distanceKm += distance;
      week.durationMinutes += duration;
      week.elevationMeters += elevation;
    }
    if (duration > 0) longestDurationMinutes = Math.max(longestDurationMinutes ?? 0, duration);
    if (elevation > 0) mostElevationMeters = Math.max(mostElevationMeters ?? 0, elevation);
    const averageSpeed = distance > 0 && duration > 0 ? distance / (duration / 60) : null;
    if (averageSpeed && averageSpeed <= MAX_REALISTIC_AVERAGE_SPEED_KMH) candidates.push({ distanceKm: distance, speedKmh: averageSpeed });
    const speedCandidates = [routeMaxSpeedKmh(ride.route), averageSpeed].filter(
      (value): value is number => value != null && value > 0 && value <= MAX_REALISTIC_TOP_SPEED_KMH
    );
    const rideTopSpeed = speedCandidates.length > 0 ? Math.max(...speedCandidates) : 0;
    if (rideTopSpeed > 0) topSpeedKmh = Math.max(topSpeedKmh ?? 0, rideTopSpeed);
    const maxWatts = finitePositive(ride.maxWatts);
    if (maxWatts && maxWatts <= MAX_WATTS) highestWatts = Math.max(highestWatts ?? 0, maxWatts);
  }

  let streakWeeks = 0;
  let streakActivities = 0;
  for (let cursor = currentWeek; ; cursor = addZonedDays(cursor, -7, timeZone)) {
    const count = weekCounts.get(statusDateKey(cursor, timeZone)) ?? 0;
    if (count <= 0) break;
    streakWeeks += 1;
    streakActivities += count;
  }

  const weight = finitePositive(profile.weightKg);
  const rideTimestamp = (ride: StatusHistoryRide) => {
    const started = Date.parse(ride.startedAt);
    if (Number.isFinite(started)) return started;
    const routeStart = Date.parse(ride.route[0]?.recordedAt ?? "");
    return Number.isFinite(routeStart) ? routeStart : 0;
  };
  const sorted = [...history].sort((left, right) => rideTimestamp(right) - rideTimestamp(left));
  const latestAverageWatts = sorted[0] ? resolveStatusAverageWatts(sorted[0], weight) : null;
  const averages = history.flatMap((ride) => {
    const value = resolveStatusAverageWatts(ride, weight);
    return value != null && (ride.durationMinutes ?? 0) > FTP_MIN_DURATION_MINUTES ? [value] : [];
  });
  const estimatedFtpWatts = averages.length ? Math.max(...averages) * 0.95 : null;
  const wattsPerKg = estimatedFtpWatts != null && weight != null ? estimatedFtpWatts / weight : null;

  const { start, end } = getStatusWindow(range, now, timeZone);
  const rangeRides = history.filter((ride) => {
    const timestamp = Date.parse(ride.startedAt);
    return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= end.getTime();
  });
  const seconds = Array.from({ length: 7 }, () => 0);
  rangeRides.forEach((ride) => zoneValues(ride.zones).forEach((value, index) => { seconds[index] += value; }));
  const actualTotal = seconds.reduce((sum, value) => sum + value, 0);
  let usedAveragePowerFallback = false;
  let usableWattRideCount = 0;
  const ftp = finitePositive(profile.ftp);
  if (actualTotal <= 0 && ftp != null) {
    rangeRides.forEach((ride) => {
      const average = resolveStatusAverageWatts(ride, weight);
      const duration = finitePositive(ride.durationMinutes);
      const index = average != null ? zoneIndex(average, ftp) : null;
      if (index == null || duration == null) return;
      seconds[index] += Math.round(duration * 60);
      usableWattRideCount += 1;
      usedAveragePowerFallback = true;
    });
  }
  const totalSeconds = seconds.reduce((sum, value) => sum + value, 0);
  const emptyReason = totalSeconds > 0 ? null : rangeRides.length === 0 ? "rides" : ftp == null ? "ftp" : usableWattRideCount === 0 ? "watts" : null;

  const fastest = (distance: 1 | 5 | 10) => {
    const selected = candidates.filter((candidate) => candidate.distanceKm >= distance).sort((a, b) => b.speedKmh - a.speedKmh)[0];
    return selected ? Math.max(1, Math.round(distance / selected.speedKmh * 3600)) : null;
  };
  const longestDistanceKm = candidates.length ? Math.max(...candidates.map((candidate) => candidate.distanceKm)) : null;

  return {
    weeks,
    streakWeeks,
    streakActivities,
    power: { estimatedFtpWatts, wattsPerKg, maxWatts: highestWatts, latestAverageWatts },
    zones: { seconds, totalSeconds, usedAveragePowerFallback: actualTotal <= 0 && usedAveragePowerFallback, emptyReason },
    records: {
      estimatedFastestSeconds: { 1: fastest(1), 5: fastest(5), 10: fastest(10) },
      longestDistanceKm,
      longestDurationMinutes,
      mostElevationMeters,
      topSpeedKmh,
      highestWatts
    }
  };
}

export function buildStatusCalendar(
  history: StatusHistoryRide[],
  year: number,
  month: number,
  now = new Date(),
  timeZone = statusFallbackTimeZone
): StatusCalendarDay[] {
  const first = zonedDate({ year, month, day: 1, hour: 0, minute: 0, second: 0 }, timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: validTimeZone(timeZone), weekday: "short" }).format(first);
  const offset = (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 7) % 7;
  const gridStart = addZonedDays(first, -offset, timeZone);
  const byDay = new Map<string, StatusHistoryRide[]>();
  history.forEach((ride) => {
    const date = new Date(ride.startedAt);
    if (!Number.isFinite(date.getTime())) return;
    const key = statusDateKey(date, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), ride]);
  });
  const today = statusDateKey(now, timeZone);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addZonedDays(gridStart, index, timeZone);
    const parts = getZonedParts(date, timeZone);
    const dateKey = statusDateKey(date, timeZone);
    return { dateKey, day: parts.day, inMonth: parts.month === month, isToday: dateKey === today, rides: byDay.get(dateKey) ?? [] };
  });
}

export function getStatusZonedParts(date: Date, timeZone: string) {
  return getZonedParts(date, timeZone);
}
