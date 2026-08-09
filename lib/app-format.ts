import type { Locale } from "./locales";
import type { RoutePoint, UnitSystem } from "./app-model";

const localeTags: Record<Locale, string> = {
  en: "en-GB",
  da: "da-DK",
  de: "de-DE",
  es: "es-ES",
  it: "it-IT",
  fr: "fr-FR",
  nl: "nl-NL"
};

const kilometersPerMile = 1.609344;

export function getLocaleTag(locale: Locale): string {
  return localeTags[locale];
}

export function formatDateTime(locale: Locale, value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatDate(locale: Locale, value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(getLocaleTag(locale), { dateStyle: "medium" }).format(date);
}

export function formatNumber(locale: Locale, value: number, digits = 1): string {
  return new Intl.NumberFormat(getLocaleTag(locale), {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  }).format(value);
}

export function formatDistance(
  locale: Locale,
  distanceKm: number | null,
  unitSystem: UnitSystem
): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return "—";
  const value = unitSystem === "imperial" ? distanceKm / kilometersPerMile : distanceKm;
  return `${formatNumber(locale, value, 1)} ${unitSystem === "imperial" ? "mi" : "km"}`;
}

export function formatElevation(
  locale: Locale,
  elevationMeters: number | null,
  unitSystem: UnitSystem
): string {
  if (elevationMeters == null || !Number.isFinite(elevationMeters)) return "—";
  const value = unitSystem === "imperial" ? elevationMeters * 3.280839895 : elevationMeters;
  return `${formatNumber(locale, value, 0)} ${unitSystem === "imperial" ? "ft" : "m"}`;
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "—";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  if (hours === 0) return `${remaining} min`;
  return remaining === 0 ? `${hours} h` : `${hours} h ${remaining} min`;
}

export function formatSpeed(locale: Locale, distanceKm: number | null, durationMinutes: number | null, unitSystem: UnitSystem): string {
  if (distanceKm == null || durationMinutes == null || distanceKm <= 0 || durationMinutes <= 0) return "—";
  const speedKmh = distanceKm / (durationMinutes / 60);
  const speed = unitSystem === "imperial" ? speedKmh / kilometersPerMile : speedKmh;
  return `${formatNumber(locale, speed, 1)} ${unitSystem === "imperial" ? "mph" : locale === "da" ? "km/t" : locale === "nl" ? "km/u" : "km/h"}`;
}

export function trimRouteForPrivacy(points: RoutePoint[], enabled: boolean): RoutePoint[] {
  if (!enabled || points.length < 3) return points;
  const trimCount = Math.floor(points.length * 0.05);
  if (trimCount <= 0 || points.length - trimCount * 2 < 2) return points;
  return points.slice(trimCount, points.length - trimCount);
}
