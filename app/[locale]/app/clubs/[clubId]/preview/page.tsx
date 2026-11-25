import Link from "next/link";
import { notFound } from "next/navigation";

import { VisitBoundary } from "@/components/clubs/visits/visitor";
import { getAppDictionary } from "@/lib/app-i18n";
import { clubPageContext } from "@/lib/clubs/server";
import { isClubId } from "@/lib/clubs/types";
import { visitsEnabled } from "@/lib/clubs/visits/gate";
import { isLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";

export default async function ClubPreviewPage({ params }: {
  params: Promise<{ locale: string; clubId: string }>;
}) {
  const { locale, clubId } = await params;
  if (!isLocale(locale) || !isClubId(clubId)) notFound();

  const clubHref = `/${locale}/app/clubs/${clubId}`;
  const { userId } = await clubPageContext(locale, `${clubHref}/preview`);
  const t = getAppDictionary(locale);

  return <div>
    <Link prefetch={false} className="bike-app-button bike-app-button-secondary bike-app-visit-back" href={clubHref}>
      <span aria-hidden="true">←</span> {t("clubs.backToClub")}
    </Link>
    <VisitBoundary userId={userId} clubId={clubId} locale={locale} previewOnly memberPreview={{ visitsEnabled: visitsEnabled(process.env) }} />
  </div>;
}
