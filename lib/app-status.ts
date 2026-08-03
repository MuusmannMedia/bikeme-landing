import type { Locale } from "./locales";
import type { RideHistorySummary } from "./app-model";
import { getLocaleTag } from "./app-format";

export type StatusRange = "7D" | "1M" | "3M" | "6M" | "YTD" | "1Y";
export type StatusMetric = "distance" | "elevation" | "duration";

export type StatusBucket = {
  id: string;
  label: string;
  distanceKm: number;
  elevationMeters: number;
  durationMinutes: number;
  rideCount: number;
};

export type StatusSummary = {
  buckets: StatusBucket[];
  totals: Omit<StatusBucket, "id" | "label">;
  comparisonPercent: number | null;
};

export const statusRanges: readonly StatusRange[] = ["7D", "1M", "3M", "6M", "YTD", "1Y"];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function getStatusWindow(range: StatusRange, now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  if (range === "7D") return { start: addDays(todayStart, -6), end: todayEnd, bucketCount: 7 };
  if (range === "1M") return { start: addDays(todayStart, -29), end: todayEnd, bucketCount: 6 };
  if (range === "3M") return { start: addDays(todayStart, -89), end: todayEnd, bucketCount: 12 };
  if (range === "6M") return { start: addDays(todayStart, -179), end: todayEnd, bucketCount: 12 };
  if (range === "YTD") return { start: new Date(now.getFullYear(), 0, 1), end: todayEnd, bucketCount: Math.max(1, now.getMonth() + 1) };
  return { start: addDays(todayStart, -364), end: todayEnd, bucketCount: 12 };
}

function metricValue(bucket: StatusBucket, metric: StatusMetric): number {
  return metric === "distance" ? bucket.distanceKm : metric === "elevation" ? bucket.elevationMeters : bucket.durationMinutes;
}

export function buildStatusSummary(
  history: RideHistorySummary[],
  range: StatusRange,
  metric: StatusMetric,
  locale: Locale,
  now = new Date()
): StatusSummary {
  const { start, end, bucketCount } = getStatusWindow(range, now);
  const windowMs = Math.max(1, end.getTime() - start.getTime() + 1);
  const bucketMs = windowMs / bucketCount;
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - windowMs + 1);
  const formatter = new Intl.DateTimeFormat(getLocaleTag(locale), range === "7D" ? { weekday: "short" } : range === "1M" ? { day: "numeric", month: "short" } : { month: "short" });
  const buckets = Array.from({ length: bucketCount }, (_, index): StatusBucket => ({
    id: `${range}-${index}`,
    label: formatter.format(new Date(start.getTime() + bucketMs * index)).replace(".", ""),
    distanceKm: 0,
    elevationMeters: 0,
    durationMinutes: 0,
    rideCount: 0
  }));
  const previous: StatusBucket = { id: "previous", label: "", distanceKm: 0, elevationMeters: 0, durationMinutes: 0, rideCount: 0 };
  const add = (target: StatusBucket, ride: RideHistorySummary) => {
    target.distanceKm += ride.distanceKm && ride.distanceKm > 0 ? ride.distanceKm : 0;
    target.elevationMeters += ride.elevationGain && ride.elevationGain > 0 ? ride.elevationGain : 0;
    target.durationMinutes += ride.durationMinutes && ride.durationMinutes > 0 ? ride.durationMinutes : 0;
    target.rideCount += 1;
  };
  for (const ride of history) {
    const timestamp = Date.parse(ride.startedAt);
    if (!Number.isFinite(timestamp)) continue;
    const date = new Date(timestamp);
    if (date >= start && date <= end) {
      const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((timestamp - start.getTime()) / bucketMs)));
      add(buckets[index], ride);
    } else if (date >= previousStart && date <= previousEnd) {
      add(previous, ride);
    }
  }
  const totals = buckets.reduce((result, bucket) => ({
    distanceKm: result.distanceKm + bucket.distanceKm,
    elevationMeters: result.elevationMeters + bucket.elevationMeters,
    durationMinutes: result.durationMinutes + bucket.durationMinutes,
    rideCount: result.rideCount + bucket.rideCount
  }), { distanceKm: 0, elevationMeters: 0, durationMinutes: 0, rideCount: 0 });
  const currentValue = metric === "distance" ? totals.distanceKm : metric === "elevation" ? totals.elevationMeters : totals.durationMinutes;
  const previousValue = metricValue(previous, metric);
  return {
    buckets,
    totals,
    comparisonPercent: previousValue > 0 ? Math.round(((currentValue - previousValue) / previousValue) * 100) : null
  };
}
