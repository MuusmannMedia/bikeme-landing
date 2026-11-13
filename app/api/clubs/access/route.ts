import {profileEditingEnabled} from "@/lib/clubs/profile-contract";
import { createClubRideApi } from "@/lib/clubs/ride-api";
import { NextRequest, NextResponse } from "next/server";
import { clubError } from "@/lib/clubs/membership-types";
import { createClubMembershipApi } from "@/lib/clubs/membership-api";
import { createClubReadApi } from "@/lib/clubs/api";
import { type ClubPageData } from "@/lib/clubs/types";
import { createClient } from "@/lib/supabase/server";
import { preventAuthCaching } from "@/lib/supabase/proxy";

export const dynamic = "force-dynamic";

function response(body: object, status = 200) {
  const result = preventAuthCaching(NextResponse.json(body, { status }));
  result.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return result;
}

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId");
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return response({ error: "auth" }, error && ![400, 401, 403].includes(error.status ?? 0) ? 503 : 401);
    const api = createClubReadApi(client, data.user.id);
    const membershipApi = createClubMembershipApi(client, data.user.id);
    if(clubId && request.nextUrl.searchParams.get("view")==="rides") {
      const club=await api.detail(clubId);
      const rides=await createClubRideApi(client,data.user.id).load(clubId,request.nextUrl.searchParams.get("rideId"),request.nextUrl.searchParams.get("create")==="true");
      return response({userId:data.user.id,snapshot:{view:"rides",club,rides}});
    }
    const transfers = await membershipApi.ownershipTransfers();
    let snapshot: ClubPageData;
    if (clubId !== null) {
      const club = await api.detail(clubId);
      const [pending, proposals] = await Promise.all([club.role === "member" ? Promise.resolve([]) : membershipApi.pendingInvitations(clubId), membershipApi.proposals(clubId)]);
      snapshot = { view: "club", club, profileEditing: profileEditingEnabled(process.env) && club.role !== "member", membership: { invitations: [], pending, proposals, transfers: transfers.filter(t => t.club_id === clubId) } };
    }
    else {
      const [mine, catalog] = await Promise.all([api.list(), api.catalog()]);
      snapshot = { view: "directory", mine, catalog, membership: {invitations: await membershipApi.invitations(), pending: [], proposals: [], transfers} };
    }
    return response({ userId: data.user.id, snapshot });
  } catch (error) {
    const kind = clubError(error).kind;
    return response({ error: kind }, kind === "auth" ? 401 : kind === "access" ? 403 : 503);
  }
}
