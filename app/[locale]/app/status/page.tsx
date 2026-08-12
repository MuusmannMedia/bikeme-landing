import { notFound } from "next/navigation";

import { AppNotice, AppPageHeader, ProGate } from "@/components/app-ui";
import { StatusDashboard } from "@/components/status-dashboard";
import { listStatusHistory, loadViewer } from "@/lib/app-data";
import { getAppDictionary } from "@/lib/app-i18n";
import { statusRanges, type StatusMetric, type StatusRange } from "@/lib/app-status";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

export default async function StatusPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ range?: string; metric?: string; notice?: string }> }) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const viewer = await loadViewer(client);
  if (!viewer.access.hasPro) return <ProGate locale={locale} />;
  const query = await searchParams;
  const range: StatusRange = statusRanges.includes(query.range as StatusRange) ? query.range as StatusRange : "3M";
  const metric: StatusMetric = query.metric === "elevation" || query.metric === "duration" ? query.metric : "distance";
  const result = await listStatusHistory(client, viewer.userId)
    .then((value) => ({ value, failed: false }))
    .catch(() => ({ value: [], failed: true }));

  return (
    <>
      <AppPageHeader className="bike-app-status-page-header" eyebrow={t("common.pro")} title={t("status.title")} intro={t("status.intro")} />
      <AppNotice locale={locale} code={result.failed ? "data" : query.notice} />
      <StatusDashboard
        history={result.value}
        locale={locale}
        range={range}
        metric={metric}
        unitSystem={viewer.profile.unitSystem}
        weightKg={viewer.profile.weightKg}
        ftp={viewer.profile.ftp}
        nowIso={new Date().toISOString()}
      />
    </>
  );
}
