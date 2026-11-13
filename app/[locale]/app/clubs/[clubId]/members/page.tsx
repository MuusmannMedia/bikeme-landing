import { notFound } from "next/navigation";
import { ClubSessionBoundary } from "@/components/clubs/club-session-boundary";
import { clubPageContext } from "@/lib/clubs/server";
import { isLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";

export default async function ClubPage({ params }: { params: Promise<{ locale: string; clubId: string }> }) {
  const { locale, clubId } = await params;
  if (!isLocale(locale)) notFound();
  const { userId } = await clubPageContext(locale, `/${locale}/app/clubs/${encodeURIComponent(clubId)}/members`);
  // Only route identity crosses the RSC boundary. Authorized club data is read
  // fresh by the client store and can be completely discarded on revocation.
  return <ClubSessionBoundary key={locale + ":" + userId + ":" + clubId + ":members"} userId={userId} locale={locale} clubId={clubId} selected="members" />;
}
