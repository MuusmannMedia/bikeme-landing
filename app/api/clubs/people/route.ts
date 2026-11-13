import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { preventAuthCaching } from "@/lib/supabase/proxy";
import { createClubReadApi } from "@/lib/clubs/api";
import { createClubMembershipApi } from "@/lib/clubs/membership-api";
import { clubError } from "@/lib/clubs/membership-types";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const reply = (body: object, status = 200) => preventAuthCaching(NextResponse.json(body, { status }));
  try {
    const client = await createClient(); const {data,error}=await client.auth.getUser();
    if(error||!data.user||request.nextUrl.searchParams.get("actorId")!==data.user.id)return reply({error:"auth"},401);
    const clubId=request.nextUrl.searchParams.get("clubId")??"", query=request.nextUrl.searchParams.get("q")??"";
    if(query.length>200)return reply({error:"invalid"},409);
    await createClubReadApi(client,data.user.id).detail(clubId);
    const people=await createClubMembershipApi(client,data.user.id).searchPeople(query,clubId);
    return reply({userId:data.user.id,people});
  } catch(error){const kind=clubError(error).kind;return reply({error:kind},kind==="auth"?401:kind==="access"?403:503)}
}
