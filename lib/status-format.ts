import { getLocaleTag } from "./app-format";
import { getAppText, type AppTextKey } from "./app-i18n";
import type { UnitSystem } from "./app-model";
import type { Locale } from "./locales";

const kilometersPerMile = 1.609344;
const feetPerMeter = 3.280839895;

export function statusText(locale: Locale, key: AppTextKey, values: Record<string, string | number> = {}): string {
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)),
    getAppText(locale, key)
  );
}

export function statusDistanceValue(distanceKm: number, unitSystem: UnitSystem): number {
  return Math.max(0, distanceKm) / (unitSystem === "imperial" ? kilometersPerMile : 1);
}

export function statusElevationValue(elevationMeters: number, unitSystem: UnitSystem): number {
  return Math.max(0, elevationMeters) * (unitSystem === "imperial" ? feetPerMeter : 1);
}

export function statusDistanceUnit(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "mi" : "km";
}

export function statusElevationUnit(unitSystem: UnitSystem): string {
  return unitSystem === "imperial" ? "ft" : "m";
}

export function statusSpeedUnit(locale: Locale, unitSystem: UnitSystem): string {
  if (unitSystem === "imperial") return "mph";
  if (locale === "da") return "km/t";
  if (locale === "nl") return "km/u";
  return "km/h";
}

export function formatStatusDistance(locale: Locale, distanceKm: number, unitSystem: UnitSystem, mode: "hero" | "weekly" | "tooltip" = "hero"): string {
  const value = statusDistanceValue(distanceKm, unitSystem);
  const options: Intl.NumberFormatOptions = mode === "tooltip"
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : mode === "hero"
      ? value >= 100
        ? { minimumFractionDigits: 1, maximumFractionDigits: 1 }
        : { minimumFractionDigits: 0, maximumFractionDigits: 1 }
      : { minimumFractionDigits: 0, maximumFractionDigits: value >= 100 ? 0 : 1 };
  return `${new Intl.NumberFormat(getLocaleTag(locale), options).format(value)} ${statusDistanceUnit(unitSystem)}`;
}

export function formatStatusElevation(locale: Locale, elevationMeters: number, unitSystem: UnitSystem): string {
  return `${new Intl.NumberFormat(getLocaleTag(locale), { maximumFractionDigits: 0 }).format(statusElevationValue(elevationMeters, unitSystem))} ${statusElevationUnit(unitSystem)}`;
}

export function formatStatusDuration(locale: Locale, totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(Number.isFinite(totalMinutes) ? totalMinutes : 0));
  return statusText(locale, "status.durationHoursMinutes", {
    hours: Math.floor(minutes / 60),
    minutes: String(minutes % 60).padStart(2, "0")
  });
}

export function formatStatusZoneDuration(locale: Locale, totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  if (seconds < 60) return statusText(locale, "status.durationSeconds", { seconds });
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return statusText(locale, "status.durationMinutes", { minutes });
  return statusText(locale, "status.durationHoursMinutes", {
    hours: Math.floor(minutes / 60),
    minutes: String(minutes % 60).padStart(2, "0")
  });
}

export function formatStatusSpeed(locale: Locale, speedKmh: number | null, unitSystem: UnitSystem): string {
  if (speedKmh == null || !Number.isFinite(speedKmh) || speedKmh <= 0) return "—";
  const value = speedKmh / (unitSystem === "imperial" ? kilometersPerMile : 1);
  return `${new Intl.NumberFormat(getLocaleTag(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} ${statusSpeedUnit(locale, unitSystem)}`;
}

export function formatStatusWatts(value: number | null): string {
  return value != null && Number.isFinite(value) && value > 0 ? `${Math.round(value)} W` : "—";
}

export function formatStatusWkg(locale: Locale, value: number | null): string {
  return value != null && Number.isFinite(value) && value > 0
    ? new Intl.NumberFormat(getLocaleTag(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
    : "—";
}

export function formatEstimatedSplit(locale: Locale, totalSeconds: number | null): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "—";
  const seconds = Math.max(1, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? statusText(locale, "status.splitTimeHours", { hours, minutes: String(minutes).padStart(2, "0"), seconds: String(remainder).padStart(2, "0") })
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
