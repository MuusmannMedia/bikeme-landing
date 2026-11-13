import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { preventAuthCaching } from "@/lib/supabase/proxy";
import { isClubRequestOrigin } from "@/lib/clubs/request-origin";
import { executeClubCommand } from "@/lib/clubs/commands";
import { clubError, ClubError } from "@/lib/clubs/membership-types";
export const dynamic = "force-dynamic";
function reply(body: object, status = 200) { return preventAuthCaching(NextResponse.json(body, { status })); }
export async function POST(request: NextRequest) {
  if (!isClubRequestOrigin(request.headers.get("origin"), request.headers.get("x-forwarded-host") ?? request.headers.get("host"), request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")) || !request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "access" }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new ClubError("invalid");
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new ClubError("invalid"); }
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return reply({ error: error && ![400,401,403].includes(error.status ?? 0) ? "network" : "auth" }, error && ![400,401,403].includes(error.status ?? 0) ? 503 : 401);
    await executeClubCommand(client, data.user.id, input);
    return reply({ ok: true, userId: data.user.id });
  } catch (error) {
    const kind = clubError(error).kind;
    return reply({ error: kind }, kind === "auth" ? 401 : kind === "access" ? 403 : kind === "network" || kind === "unavailable" ? 503 : 409);
  }
}
