import { NextRequest, NextResponse } from "next/server";

import { defaultLocale, isLocale } from "@/lib/locales";

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

export function middleware(request: NextRequest) {
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
  if (localeSegment && isLocale(localeSegment)) {
    return NextResponse.next();
  }

  const locale = detectLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();

  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
