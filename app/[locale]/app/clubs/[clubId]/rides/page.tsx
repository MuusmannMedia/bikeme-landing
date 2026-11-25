import { notFound } from "next/navigation";
import { ClubSessionBoundary } from "@/components/clubs/club-session-boundary";
import { clubPageContext } from "@/lib/clubs/server";
import { isLocale } from "@/lib/locales";
import { clubRideHref } from "@/lib/clubs/ride-contract";
export const dynamic="force-dynamic";
export default async function ClubRidesPage({params,searchParams}:{params:Promise<{locale:string;clubId:string}>;searchParams:Promise<{rideId?:string;created?:string;date?:string}>}) {
 const {locale,clubId}=await params;if(!isLocale(locale)) notFound();
 const query=await searchParams;
 const rideId=query.rideId;
 const calendarDay=typeof query.date==="string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : undefined;
 const {userId}=await clubPageContext(locale,clubRideHref(locale,clubId,rideId));
 return <ClubSessionBoundary key={userId+clubId+(rideId??"")} userId={userId} clubId={clubId} locale={locale} selected="rides" rideId={rideId} calendarDay={calendarDay} created={query.created}/>;
}
