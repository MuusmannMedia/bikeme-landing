"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { AppPageHeader, AppPanel } from "@/components/app-ui";
import { getAppDictionary } from "@/lib/app-i18n";
import { isLocale } from "@/lib/locales";

export default function AuthenticatedAppNotFound() {
  const params = useParams<{ locale?: string }>();
  const localeParam = params.locale;
  const locale = localeParam && isLocale(localeParam) ? localeParam : "en";
  const t = getAppDictionary(locale);

  return (
    <>
      <AppPageHeader eyebrow="Bike Me" title={t("error.notFoundTitle")} intro={t("error.notFoundBody")} />
      <AppPanel>
        <Link className="bike-app-button" href={`/${locale}/app`}>
          {t("error.backToApp")}
        </Link>
      </AppPanel>
    </>
  );
}
