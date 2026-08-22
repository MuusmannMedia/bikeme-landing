import type { UnitSystem } from "./app-model";
import type { Locale } from "./locales";

export const kilometersPerMile = 1.609344;
export const rideTitleMaxLength = 120;

export const rideNowStartOffsets = [10, 20, 30, 45, 60, 90] as const;
export const rideNowDurationMinutes = 120;

export const rideMoodKeys = [
  "map.presetCozy",
  "map.presetSweat",
  "map.presetPush",
  "map.presetMaxWatt",
  "map.presetSocial",
  "map.presetSteady",
  "map.presetIntervals",
  "map.presetShortHard",
  "map.presetLongCoffee",
  "map.presetHills"
] as const;

export type RideMoodKey = (typeof rideMoodKeys)[number];
export type RideCreateType = "PING" | "EVENT";
export type RideNowStartMode = "OM" | "KL";

export type FreeMeetingLocation = {
  latitude: number;
  longitude: number;
  address: string;
};

const danishMoodLabels: Record<RideMoodKey, string> = {
  "map.presetCozy": "Hurtigt rul med kort opvarmning.",
  "map.presetSweat": "Roligt tempo med fokus på gode ben.",
  "map.presetPush": "Tempo i blokke med korte pauser.",
  "map.presetMaxWatt": "Intervaller med høj intensitet hele vejen.",
  "map.presetSocial": "Bakker i kontrolleret men hårdt tempo.",
  "map.presetSteady": "Stabil zone 2 fra start til mål.",
  "map.presetIntervals": "Social tur med plads til alle niveauer.",
  "map.presetShortHard": "Gravel-runde på blandet underlag.",
  "map.presetLongCoffee": "MTB-spor med teknik og flow.",
  "map.presetHills": "Lang tur i jævnt udholdenhedstempo."
};

const englishMoodLabels: Record<RideMoodKey, string> = {
  "map.presetCozy": "Fast rolling pace with a short warm-up.",
  "map.presetSweat": "Easy pace with focus on smooth legs.",
  "map.presetPush": "Tempo blocks with short recoveries.",
  "map.presetMaxWatt": "Intervals with high intensity throughout.",
  "map.presetSocial": "Hills at a controlled but hard pace.",
  "map.presetSteady": "Steady zone 2 from start to finish.",
  "map.presetIntervals": "Social ride with room for all levels.",
  "map.presetShortHard": "Gravel loop on mixed terrain.",
  "map.presetLongCoffee": "MTB trails with technique and flow.",
  "map.presetHills": "Long ride at a steady endurance pace."
};

const danishTitleSuggestions = [
  "Hurtig tur i dag",
  "Rolig tur i dag",
  "Tempo-tur i dag",
  "Interval-tur i dag",
  "Bakke-tur i dag",
  "Zone 2 tur i dag",
  "Social tur i dag",
  "Gravel-tur i dag",
  "MTB-tur i dag",
  "Lang tur i dag"
] as const;

const englishTitleSuggestions = [
  "Fast ride today",
  "Easy ride today",
  "Tempo ride today",
  "Interval ride today",
  "Hill ride today",
  "Zone 2 ride today",
  "Social ride today",
  "Gravel ride today",
  "MTB ride today",
  "Long ride today"
] as const;

export function getRideMoodOptions(locale: Locale): { key: RideMoodKey; label: string }[] {
  const labels = locale === "da" ? danishMoodLabels : englishMoodLabels;
  return rideMoodKeys.map((key) => ({ key, label: labels[key] }));
}

export function getRideTitleSuggestions(locale: Locale): readonly string[] {
  return locale === "da" ? danishTitleSuggestions : englishTitleSuggestions;
}

export function isRideMoodKey(value: string): value is RideMoodKey {
  return (rideMoodKeys as readonly string[]).includes(value);
}

export function distanceToKilometers(value: number, unitSystem: UnitSystem): number {
  return unitSystem === "imperial" ? value * kilometersPerMile : value;
}

export function distanceFromKilometers(distanceKm: number, unitSystem: UnitSystem): number {
  return unitSystem === "imperial" ? distanceKm / kilometersPerMile : distanceKm;
}

export function getDistanceUnit(unitSystem: UnitSystem): "km" | "mi" {
  return unitSystem === "imperial" ? "mi" : "km";
}

export function buildRideNowTitle(title: string, distanceKm: number, unitSystem: UnitSystem): string {
  const displayDistance = distanceFromKilometers(distanceKm, unitSystem);
  const formattedDistance = displayDistance.toFixed(1).replace(/\.0$/u, "");
  return `${formattedDistance} ${getDistanceUnit(unitSystem)} • ${title}`;
}

export function getRideNowTitleInputMaxLength(displayDistance: number, unitSystem: UnitSystem): number {
  if (!Number.isFinite(displayDistance) || displayDistance <= 0) return rideTitleMaxLength;
  const prefixLength = buildRideNowTitle(
    "",
    distanceToKilometers(displayDistance, unitSystem),
    unitSystem
  ).length;
  return Math.max(3, rideTitleMaxLength - prefixLength);
}

export function resolveFreeMeetingLocation({
  latitude,
  longitude,
  address
}: {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}): FreeMeetingLocation | null {
  if (
    latitude == null || longitude == null ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return null;
  const normalizedAddress = address?.trim().replace(/\r\n/g, "\n") ?? "";
  if (normalizedAddress.length > 500) return null;
  return {
    latitude,
    longitude,
    address: normalizedAddress || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
  };
}

export function getNextRoundedTenMinuteTimeValue(now: Date = new Date()): string {
  const rounded = new Date(now);
  rounded.setSeconds(0, 0);
  const nextMinute = Math.ceil((rounded.getMinutes() + 1) / 10) * 10;
  if (nextMinute >= 60) rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  else rounded.setMinutes(nextMinute, 0, 0);
  return `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes()).padStart(2, "0")}`;
}

export function getTenMinuteTimeOptions(): string[] {
  return Array.from({ length: 24 * 6 }, (_, index) => {
    const hour = Math.floor(index / 6);
    const minute = (index % 6) * 10;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  });
}

export function resolveExactRideNowStart(timeValue: string, now: Date = new Date()): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const startAt = new Date(now);
  startAt.setHours(hours, minutes, 0, 0);
  if (startAt.getTime() <= now.getTime()) startAt.setDate(startAt.getDate() + 1);
  return startAt;
}

type RideScheduleInput = {
  type: RideCreateType;
  startTimeIso?: string | null;
  startMode?: string | null;
  startOffsetMinutes?: number | null;
  durationHours?: number | null;
};

export type RideScheduleResult =
  | { ok: true; startTime: Date; durationMinutes: number }
  | { ok: false; error: "INVALID_START" | "START_NOT_FUTURE" | "INVALID_DURATION" };

export function resolveRideSchedule(
  input: RideScheduleInput,
  now: Date = new Date()
): RideScheduleResult {
  if (input.type === "PING" && input.startMode === "OM") {
    const offset = input.startOffsetMinutes;
    if (typeof offset !== "number" || !rideNowStartOffsets.some((candidate) => candidate === offset)) {
      return { ok: false, error: "INVALID_START" };
    }
    return {
      ok: true,
      startTime: new Date(now.getTime() + offset * 60_000),
      durationMinutes: rideNowDurationMinutes
    };
  }

  const startTime = input.startTimeIso ? new Date(input.startTimeIso) : null;
  if (!startTime || !Number.isFinite(startTime.getTime())) return { ok: false, error: "INVALID_START" };
  if (startTime.getTime() <= now.getTime()) return { ok: false, error: "START_NOT_FUTURE" };

  if (input.type === "PING") {
    if (input.startMode !== "KL" || startTime.getTime() > now.getTime() + 26 * 60 * 60_000) {
      return { ok: false, error: "INVALID_START" };
    }
    return { ok: true, startTime, durationMinutes: rideNowDurationMinutes };
  }

  const durationHours = input.durationHours;
  if (durationHours == null || !Number.isFinite(durationHours) || durationHours <= 0) {
    return { ok: false, error: "INVALID_DURATION" };
  }
  const durationMinutes = durationHours * 60;
  const expiresAtMilliseconds = startTime.getTime() + durationMinutes * 60_000;
  if (!Number.isFinite(durationMinutes) || !Number.isFinite(expiresAtMilliseconds) || Math.abs(expiresAtMilliseconds) > 8.64e15) {
    return { ok: false, error: "INVALID_DURATION" };
  }
  return { ok: true, startTime, durationMinutes };
}
