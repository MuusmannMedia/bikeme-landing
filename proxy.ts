import { NextRequest, NextResponse } from "next/server";

import {
  buildLoginPath,
  getSafeReturnPath,
  isProtectedRoutePath
} from "@/lib/auth";
import { defaultLocale, isLocale } from "@/lib/locales";
import {
  copyAuthResponseState,
  refreshAuthSession
} from "@/lib/supabase/proxy";

const metadataRoutePrefixes = [
  "/opengraph-image",
  "/twitter-image",
  "/icon",
  "/apple-icon"
] as const;

const exactBypassPaths = new Set([
  "/robots.txt",
  "/sitemap.xml"
]);

function detectLocale(acceptLanguageHeader: string | null): string {
  if (!acceptLanguageHeader) {
    return defaultLocale;
  }

  const accepted = acceptLanguageHeader
    .split(",")
    .map((part) => part.split(";")[0]?.trim().toLowerCase())
    .filter(Boolean);

  for (const lang of accepted) {
    if (isLocale(lang)) {
      return lang;
    }

    const baseLang = lang.split("-")[0];
    if (baseLang && isLocale(baseLang)) {
      return baseLang;
    }
  }

  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isMetadataRoute = metadataRoutePrefixes.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    exactBypassPaths.has(pathname) ||
    isMetadataRoute ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const localeSegment = pathname.split("/")[1];
  if (!localeSegment || !isLocale(localeSegment)) {
    const locale = detectLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();

    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

    return NextResponse.redirect(url);
  }

  const locale = localeSegment;
  const isLoginRoute = pathname === `/${locale}/login`;
  const isProtectedRoute = isProtectedRoutePath(locale, pathname);

  if (!isLoginRoute && !isProtectedRoute) {
    return NextResponse.next();
  }

  const auth = await refreshAuthSession(request);

  if (isLoginRoute && auth.user) {
    const url = new URL(
      getSafeReturnPath(locale, request.nextUrl.searchParams.get("returnTo")),
      request.url
    );

    return copyAuthResponseState(auth.response, NextResponse.redirect(url));
  }

  if (isProtectedRoute && !auth.user) {
    const errorCode = !auth.configured
      ? "generic"
      : auth.hadAuthCookie
        ? "expired"
        : undefined;
    const url = new URL(
      buildLoginPath(
        locale,
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
        errorCode
      ),
      request.url
    );

    return copyAuthResponseState(auth.response, NextResponse.redirect(url));
  }

  return auth.response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
