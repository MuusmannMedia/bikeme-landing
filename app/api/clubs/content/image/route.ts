import { NextRequest, NextResponse } from "next/server";
import { createClubContentApi } from "@/lib/clubs/content-api";
import { contentError } from "@/lib/clubs/content-contract";
import { preventAuthCaching } from "@/lib/supabase/proxy";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unavailable = (status: number) => preventAuthCaching(new NextResponse(null, { status }));
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return unavailable(error && ![400, 401, 403].includes(error.status ?? 0) ? 503 : 401);
    const query = request.nextUrl.searchParams;
    const bytes = await createClubContentApi(client, data.user.id).image(
      query.get("clubId") ?? "", query.get("postId") ?? "", query.get("revision") ?? "",
      query.get("source") === "true",
    );
    return preventAuthCaching(new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    }));
  } catch (error) {
    const { kind } = contentError(error);
    return unavailable(kind === "auth" ? 401 : kind === "network" ? 503 : 404);
  }
}
