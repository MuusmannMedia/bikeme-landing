import { getSafeLocale, getSafeReturnPath } from "./auth";
import type { Locale } from "./locales";

export const appleAuthCallbackPath = "/auth/callback";

type AppleOAuthClient = {
  auth: {
    signInWithOAuth(input: {
      provider: "apple";
      options: {
        redirectTo: string;
      };
    }): Promise<{
      error: unknown;
    }>;
  };
};

export type AppleCallbackContext = {
  code: string | null;
  locale: Locale;
  returnTo: string;
};

export function isAppleAuthCallbackPath(pathname: string): boolean {
  return pathname === appleAuthCallbackPath;
}

export function getAppleCallbackContext(
  searchParams: URLSearchParams
): AppleCallbackContext {
  const locale = getSafeLocale(searchParams.get("locale"));
  const codeValue = searchParams.get("code");

  return {
    code: codeValue && codeValue.trim().length > 0 ? codeValue : null,
    locale,
    returnTo: getSafeReturnPath(locale, searchParams.get("returnTo"))
  };
}

export function buildAppleCallbackUrl(
  origin: string,
  locale: Locale,
  returnTo: unknown
): string {
  const parsedOrigin = new URL(origin);

  if (
    parsedOrigin.origin !== origin ||
    (parsedOrigin.protocol !== "https:" && parsedOrigin.protocol !== "http:")
  ) {
    throw new Error("Invalid web origin.");
  }

  const callbackUrl = new URL(appleAuthCallbackPath, parsedOrigin.origin);
  callbackUrl.searchParams.set("locale", locale);
  callbackUrl.searchParams.set("returnTo", getSafeReturnPath(locale, returnTo));

  return callbackUrl.toString();
}

export async function startAppleOAuth(
  client: AppleOAuthClient,
  origin: string,
  locale: Locale,
  returnTo: unknown
): Promise<boolean> {
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: buildAppleCallbackUrl(origin, locale, returnTo)
      }
    });

    return !error;
  } catch {
    return false;
  }
}

export async function exchangeAppleCallbackCode(
  code: string | null,
  exchangeCodeForSession: (value: string) => Promise<{ error: unknown }>
): Promise<boolean> {
  if (!code) {
    return false;
  }

  try {
    const { error } = await exchangeCodeForSession(code);
    return !error;
  } catch {
    return false;
  }
}
