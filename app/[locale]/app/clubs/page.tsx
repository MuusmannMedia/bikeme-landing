import { notFound } from "next/navigation";
import { ClubSessionBoundary } from "@/components/clubs/club-session-boundary";
import { clubPageContext } from "@/lib/clubs/server";
import { isLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";

export default async function ClubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { userId } = await clubPageContext(locale, `/${locale}/app/clubs`);
  // Only route identity crosses the RSC boundary. Authorized club data is read
  // fresh by the client store and can be completely discarded on revocation.
  return <ClubSessionBoundary key={locale + ":" + userId} userId={userId} locale={locale} />;
}
