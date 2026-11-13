"use client";

import { useParams } from "next/navigation";
import { AppPageHeader } from "@/components/app-ui";
import { getAppDictionary } from "@/lib/app-i18n";
import { isLocale } from "@/lib/locales";

export default function ClubsError() {
  const { locale } = useParams<{ locale: string }>();
  const t = getAppDictionary(isLocale(locale) ? locale : "en");
  return <>
    <AppPageHeader title={t("nav.clubs")} intro={t("clubs.loadError")} />
    <button className="bike-app-button bike-app-button-secondary" onClick={() => window.location.reload()}>{t("common.retry")}</button>
  </>;
}
