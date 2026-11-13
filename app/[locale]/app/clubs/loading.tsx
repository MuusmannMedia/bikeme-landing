"use client";

import { useParams } from "next/navigation";
import { getAppDictionary } from "@/lib/app-i18n";
import { isLocale } from "@/lib/locales";

export default function ClubsLoading() {
  const { locale } = useParams<{ locale: string }>();
  const t = getAppDictionary(isLocale(locale) ? locale : "en");
  return <div className="bike-app-club-loading" role="status" aria-label={t("clubs.loading")}>
    <span className="sr-only">{t("clubs.loading")}</span>
    <div aria-hidden="true" className="bike-app-club-skeleton" />
    <div aria-hidden="true" className="bike-app-grid" data-columns="2"><div className="bike-app-club-skeleton" /><div className="bike-app-club-skeleton" /></div>
  </div>;
}
