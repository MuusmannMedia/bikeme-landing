import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { preventAuthCaching } from "@/lib/supabase/proxy";
import { isClubRequestOrigin } from "@/lib/clubs/request-origin";
import { clubRidePushTransport } from "@/lib/clubs/ride-push";
import { createClubRideApi } from "@/lib/clubs/ride-api";
import { ClubError, clubError } from "@/lib/clubs/membership-types";
import { isClubId } from "@/lib/clubs/types";
export const dynamic="force-dynamic";
const reply=(body:object,status=200)=>preventAuthCaching(NextResponse.json(body,{status}));
export async function POST(request: NextRequest) {
  if(!isClubRequestOrigin(request.headers.get("origin"),request.headers.get("x-forwarded-host")??request.headers.get("host"),request.headers.get("x-forwarded-proto")??request.nextUrl.protocol.replace(":",""))) return reply({error:"access"},403);
  try {
    const client=await createClient();
    const {data,error}=await client.auth.getUser();
    if(error || !data.user) return reply({error:error && ![400,401,403].includes(error.status??0)?"network":"auth"},error && ![400,401,403].includes(error.status??0)?503:401);
    const actor=data.user.id, api=createClubRideApi(client,actor,clubRidePushTransport(client,actor));
    const length=Number(request.headers.get("content-length")); if(length>4_000_000) throw new ClubError("invalid");
    if(request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const form=await request.formData();
      if(form.get("actorId")!==actor) throw new ClubError("auth");
      return reply({ok:true,userId:actor,...await api.create(form)});
    }
    const raw=await request.text(); if(raw.length>100000) throw new ClubError("invalid");
    const input=JSON.parse(raw);
    if(input.actorId!==actor) throw new ClubError("auth");
    if(!isClubId(input.clubId??"") || !isClubId(input.rideId??"") || !["invite","respond","join","leave","cancel"].includes(input.action) || (input.ids!==undefined && (!Array.isArray(input.ids)||input.ids.some((id:unknown)=>typeof id!=="string")))) throw new ClubError("invalid");
    return reply({ok:true,userId:actor,...await api.act(input)});
  } catch(error) {
    const kind=error instanceof SyntaxError?"invalid":clubError(error).kind;
    return reply({error:kind},kind==="auth"?401:kind==="access"?403:["network","unavailable"].includes(kind)?503:409);
  }
}
