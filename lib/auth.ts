import { isLocale, type Locale } from "./locales";

export const authErrorCodes = ["invalid", "generic", "expired"] as const;

export type AuthErrorCode = (typeof authErrorCodes)[number];

export function getAuthErrorCode(value: unknown): AuthErrorCode | null {
  return typeof value === "string" && authErrorCodes.includes(value as AuthErrorCode)
    ? (value as AuthErrorCode)
    : null;
}

export function getSafeLocale(value: unknown): Locale {
  return typeof value === "string" && isLocale(value) ? value : "en";
}

export function isProtectedRoutePath(locale: Locale, pathname: string): boolean {
  const protectedRoot = `/${locale}/app`;
  return pathname === protectedRoot || pathname.startsWith(`${protectedRoot}/`);
}

export function getSafeReturnPath(locale: Locale, value: unknown): string {
  const fallback = `/${locale}/app`;

  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://bikeme.invalid");

    if (parsed.origin !== "https://bikeme.invalid") {
      return fallback;
    }

    if (!isProtectedRoutePath(locale, parsed.pathname)) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildLoginPath(
  locale: Locale,
  returnPath: unknown = `/${locale}/app`,
  errorCode?: AuthErrorCode
): string {
  const searchParams = new URLSearchParams({
    returnTo: getSafeReturnPath(locale, returnPath)
  });

  if (errorCode) {
    searchParams.set("error", errorCode);
  }

  return `/${locale}/login?${searchParams.toString()}`;
}

export function getSafeDisplayName(userMetadata: unknown): string | null {
  if (!userMetadata || typeof userMetadata !== "object") {
    return null;
  }

  const metadata = userMetadata as Record<string, unknown>;

  for (const key of ["full_name", "display_name", "name"] as const) {
    const value = metadata[key];

    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.replace(/\s+/g, " ").trim();

    if (normalized.length >= 2 && normalized.length <= 80 && !normalized.includes("@")) {
      return normalized;
    }
  }

  return null;
}
