import { notFound } from "next/navigation";
import { ClubSessionBoundary } from "@/components/clubs/club-session-boundary";
import { clubPageContext } from "@/lib/clubs/server";
import { isLocale } from "@/lib/locales";
import { clubRideHref } from "@/lib/clubs/ride-contract";
export const dynamic="force-dynamic";
export default async function ClubRidesPage({params,searchParams}:{params:Promise<{locale:string;clubId:string}>;searchParams:Promise<{rideId?:string}>}) {
 const {locale,clubId}=await params;if(!isLocale(locale)) notFound();
 const rideId=(await searchParams).rideId;
 const {userId}=await clubPageContext(locale,clubRideHref(locale,clubId)+"/new");
 return <ClubSessionBoundary key={userId+clubId+"new"} userId={userId} clubId={clubId} locale={locale} selected="newRide" rideId={rideId}/>;
}
