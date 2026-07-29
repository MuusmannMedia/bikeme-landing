import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseEnvironment } from "./config";

type AuthRefreshResult = {
  configured: boolean;
  hadAuthCookie: boolean;
  response: NextResponse;
  user: User | null;
};

const privateCacheControl = "private, no-cache, no-store, must-revalidate, max-age=0";

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

export function preventAuthCaching(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", privateCacheControl);
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export function copyAuthResponseState(
  source: NextResponse,
  destination: NextResponse
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    destination.cookies.set(cookie.name, cookie.value, cookie);
  });

  for (const headerName of ["cache-control", "expires", "pragma"] as const) {
    const value = source.headers.get(headerName);
    if (value) {
      destination.headers.set(headerName, value);
    }
  }

  return preventAuthCaching(destination);
}

export async function refreshAuthSession(request: NextRequest): Promise<AuthRefreshResult> {
  const environment = getSupabaseEnvironment();
  const hadAuthCookie = hasSupabaseAuthCookie(request);
  let response = preventAuthCaching(NextResponse.next({ request }));

  if (!environment) {
    return {
      configured: false,
      hadAuthCookie,
      response,
      user: null
    };
  }

  try {
    const supabase = createServerClient(environment.url, environment.publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        }
      }
    });

    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    return {
      configured: true,
      hadAuthCookie,
      response: preventAuthCaching(response),
      user: error ? null : user
    };
  } catch {
    return {
      configured: true,
      hadAuthCookie,
      response: preventAuthCaching(response),
      user: null
    };
  }
}
