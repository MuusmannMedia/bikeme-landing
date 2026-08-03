import type { AccessLevel, ViewerAccess } from "./app-model";

const accessLevels = new Set<AccessLevel>([
  "basic",
  "premium",
  "tester_premium",
  "founding_rider"
]);

export function normalizeAccessLevel(value: unknown): AccessLevel {
  return typeof value === "string" && accessLevels.has(value as AccessLevel)
    ? (value as AccessLevel)
    : "basic";
}

export function hasProAccess(level: AccessLevel, expiresAt: string | null): boolean {
  if (level === "premium" || level === "tester_premium") return true;
  if (level !== "founding_rider") return false;
  if (!expiresAt) return true;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

export function createViewerAccess(
  levelValue: unknown,
  expiresAtValue: unknown,
  isFoundingRider: boolean
): ViewerAccess {
  const level = normalizeAccessLevel(levelValue);
  const expiresAt = typeof expiresAtValue === "string" && expiresAtValue.length > 0
    ? expiresAtValue
    : null;

  return {
    level,
    expiresAt,
    isFoundingRider: isFoundingRider || level === "founding_rider",
    hasPro: hasProAccess(level, expiresAt)
  };
}
