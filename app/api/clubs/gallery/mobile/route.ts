import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { GalleryError, type GalleryErrorCode } from "@/lib/clubs/gallery-contract";
import { saveGalleryUpload } from "@/lib/clubs/gallery-server";
import { isClubId } from "@/lib/clubs/types";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import { preventAuthCaching } from "@/lib/supabase/proxy";

export const runtime = "nodejs";
export const maxDuration = 60;

const status: Record<GalleryErrorCode, number> = {
  auth: 401, access: 403, invalid: 400, image: 422, size: 413, quota: 429,
  capacity: 413, conflict: 409, busy: 409, unavailable: 404,
  uploadUnavailable: 503, network: 503, contentRejected: 422,
};

export async function POST(request: NextRequest) {
  const json = (body: object, code = 200) =>
    preventAuthCaching(NextResponse.json(body, { status: code }));

  try {
    // This endpoint never authenticates via cookies.
    const token = request.headers.get("authorization")?.match(/^Bearer ([^\s,]+)$/i)?.[1];
    if (!token) throw new GalleryError("auth");

    const club = request.nextUrl.searchParams.get("clubId") ?? "";
    const mime = request.headers.get("content-type") ?? "";
    if (!isClubId(club) || !mime.startsWith("multipart/form-data;")) {
      throw new GalleryError("invalid");
    }
    const env = getSupabaseEnvironment();
    if (!env) throw new GalleryError("uploadUnavailable");

    const client = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      accessToken: async () => token,
    });
    // The SDK's accessToken mode disables client.auth. Validate with a separate
    // Supabase client; reservation and commit then run as the verified caller.
    const validator = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await validator.auth.getUser(token);
    if (error && ![400, 401, 403].includes(error.status ?? 401)) throw new GalleryError("network");
    if (!data.user || data.user.id !== request.headers.get("x-gallery-actor")) {
      throw new GalleryError("auth");
    }
    await saveGalleryUpload(request, client, data.user.id, club, mime, "mobile");
    return json({ userId: data.user.id });
  } catch (error) {
    const kind = error instanceof GalleryError ? error.kind : "network";
    return json({ error: kind }, status[kind]);
  }
}
