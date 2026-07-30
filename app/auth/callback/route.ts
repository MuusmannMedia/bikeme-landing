import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  exchangeAppleCallbackCode,
  getAppleCallbackContext
} from "@/lib/apple-auth";
import { buildLoginPath } from "@/lib/auth";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import { preventAuthCaching } from "@/lib/supabase/proxy";

type PendingCookie = {
  name: string;
  options: CookieOptions;
  value: string;
};

function protectCallbackResponse(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return preventAuthCaching(response);
}

function buildFailureResponse(
  request: NextRequest,
  locale: ReturnType<typeof getAppleCallbackContext>["locale"],
  returnTo: string
): NextResponse {
  const loginUrl = new URL(buildLoginPath(locale, returnTo, "apple"), request.url);
  return protectCallbackResponse(NextResponse.redirect(loginUrl));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { code, locale, returnTo } = getAppleCallbackContext(
    request.nextUrl.searchParams
  );
  const environment = getSupabaseEnvironment();

  if (!code || !environment) {
    return buildFailureResponse(request, locale, returnTo);
  }

  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders = new Map<string, string>();
  const supabase = createServerClient(
    environment.url,
    environment.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          pendingCookies.push(...cookiesToSet);
          Object.entries(headers).forEach(([name, value]) => {
            pendingHeaders.set(name, value);
          });
        }
      }
    }
  );

  const exchanged = await exchangeAppleCallbackCode(
    code,
    supabase.auth.exchangeCodeForSession.bind(supabase.auth)
  );

  if (!exchanged) {
    return buildFailureResponse(request, locale, returnTo);
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url));

  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  pendingHeaders.forEach((value, name) => {
    response.headers.set(name, value);
  });

  return protectCallbackResponse(response);
}
