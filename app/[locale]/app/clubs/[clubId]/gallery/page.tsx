import { notFound } from "next/navigation";

import { ClubGallery } from "@/components/clubs/club-gallery";
import { ClubAccessDenied, ClubReadFailure } from "@/components/clubs/club-ui";
import { clubPageContext, readClubSection } from "@/lib/clubs/server";
import { isClubId } from "@/lib/clubs/types";
import { isLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";

export default async function GalleryPage({ params }: { params: Promise<{ locale: string; clubId: string }> }) {
  const { locale, clubId } = await params;
  if (!isLocale(locale) || !isClubId(clubId)) notFound();
  const path = `/${locale}/app/clubs/${clubId}/gallery`;
  const { userId, api } = await clubPageContext(locale, path);
  const result = await readClubSection(() => api.detail(clubId), locale, path);
  if (!result.ok) return result.kind === "access"
    ? <ClubAccessDenied locale={locale} />
    : <ClubReadFailure locale={locale} kind={result.kind} retryHref={path} />;
  return <ClubGallery key={`${userId}:${clubId}`} locale={locale} userId={userId} club={result.value} />;
}
