import { redirect } from "next/navigation";
import { clubRideHref } from "@/lib/clubs/ride-contract";
import { RideDetailContent } from "@/components/ride-detail-content";
import { notFound } from "next/navigation";




import { listConnections, loadRideDetail, loadViewer } from "@/lib/app-data";


import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";



export default async function RideDetailPage({ params, searchParams }: { params: Promise<{ locale: string; rideId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { locale: localeParam, rideId } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;

  const client = await createClient();
  const viewer = await loadViewer(client);
  const scope=await client.from("rides").select("club_id,club_closed_at").eq("id",rideId).maybeSingle();
  if(scope.error || scope.data?.club_closed_at) notFound();
  if(scope.data?.club_id) redirect(clubRideHref(locale,scope.data.club_id,rideId));
  const ride = await loadRideDetail(client, viewer.userId, rideId).catch(() => null);
  if (!ride) notFound();
  const connections=ride.hostId===viewer.userId?await listConnections(client,viewer.userId).catch(()=>[]):[];
  return <RideDetailContent ride={ride} viewer={viewer} locale={locale} connections={connections} notice={(await searchParams).notice} />;
}
