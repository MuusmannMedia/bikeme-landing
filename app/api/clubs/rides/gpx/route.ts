import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { preventAuthCaching } from "@/lib/supabase/proxy";
import { createClubRideApi } from "@/lib/clubs/ride-api";
import { buildGpx } from "@/lib/gpx";
import { clubError } from "@/lib/clubs/membership-types";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
 try {
  const client=await createClient(),auth=await client.auth.getUser();
  if(auth.error || !auth.data.user) return preventAuthCaching(new NextResponse(null,{status:401}));
  const {data}=await createClubRideApi(client,auth.data.user.id).load(request.nextUrl.searchParams.get("clubId")??"",request.nextUrl.searchParams.get("rideId"));
  if(!data.selected) return preventAuthCaching(new NextResponse(null,{status:404}));
  const gpx=buildGpx(data.selected.title,data.selected.route);
  if(!gpx) return preventAuthCaching(new NextResponse(null,{status:404}));
  return preventAuthCaching(new NextResponse(gpx,{headers:{"Content-Type":"application/gpx+xml; charset=utf-8","Content-Disposition":`attachment; filename="bike-me-${data.selected.id}.gpx"`}}));
 } catch(error) {return preventAuthCaching(new NextResponse(null,{status:clubError(error).kind==="access"?403:503}));}
}
