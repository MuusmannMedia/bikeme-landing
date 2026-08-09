import Link from "next/link";
import { notFound } from "next/navigation";

import { AppEmpty, AppNotice, AppPageHeader, AppPanel, ProGate } from "@/components/app-ui";
import { StatusBars } from "@/components/status-bars";
import { listRideHistory, loadViewer } from "@/lib/app-data";
import { formatDistance, formatDuration, formatElevation, getLocaleTag } from "@/lib/app-format";
import { getAppDictionary } from "@/lib/app-i18n";
import { buildStatusSummary, statusRanges, type StatusMetric, type StatusRange } from "@/lib/app-status";
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
  const result = await listRideHistory(client, viewer.userId, 1000).then((value) => ({ value, failed: false })).catch(() => ({ value: [], failed: true }));
  const summary = buildStatusSummary(result.value, range, metric, locale);
  const rangeLabels: Record<StatusRange, string> = { "7D": t("status.range7d"), "1M": t("status.range1m"), "3M": t("status.range3m"), "6M": t("status.range6m"), YTD: t("status.rangeYtd"), "1Y": t("status.range1y") };
  const metricLabels: Record<StatusMetric, string> = { distance: t("status.distance"), elevation: t("status.elevation"), duration: t("status.duration") };
  return (
    <>
      <AppPageHeader eyebrow={t("common.pro")} title={t("status.title")} intro={t("status.intro")} />
      <AppNotice locale={locale} code={result.failed ? "data" : query.notice} />
      <div className="bike-app-segments" aria-label={t("status.title")}>{statusRanges.map((item) => <Link key={item} href={`/${locale}/app/status?range=${item}&metric=${metric}`} data-active={range === item}>{rangeLabels[item]}</Link>)}</div>
      <div className="bike-app-segments bike-app-metric-segments" aria-label={t("status.title")}>{(["distance", "elevation", "duration"] as StatusMetric[]).map((item) => <Link key={item} href={`/${locale}/app/status?range=${range}&metric=${item}`} data-active={metric === item}>{metricLabels[item]}</Link>)}</div>
      <div className="bike-app-grid" data-columns="4">
        <div className="bike-app-stat"><span>{t("status.distance")}</span><strong>{formatDistance(locale, summary.totals.distanceKm, viewer.profile.unitSystem)}</strong></div>
        <div className="bike-app-stat"><span>{t("status.duration")}</span><strong>{formatDuration(summary.totals.durationMinutes)}</strong></div>
        <div className="bike-app-stat"><span>{t("status.elevation")}</span><strong>{formatElevation(locale, summary.totals.elevationMeters, viewer.profile.unitSystem)}</strong></div>
        <div className="bike-app-stat"><span>{t("status.rides")}</span><strong>{summary.totals.rideCount}</strong></div>
      </div>
      <AppPanel title={metricLabels[metric]} className="bike-app-section-gap">
        {summary.totals.rideCount ? <><StatusBars buckets={summary.buckets} metric={metric} label={metricLabels[metric]} /><p className="bike-app-comparison">{summary.comparisonPercent == null ? "—" : `${summary.comparisonPercent > 0 ? "+" : ""}${summary.comparisonPercent}%`} <span>{t("status.previous")}</span></p></> : <AppEmpty>{t("common.empty")}</AppEmpty>}
      </AppPanel>
      <AppPanel title={t("status.calendar")} className="bike-app-section-gap">
        {result.value.length ? <div className="bike-app-calendar-list">{result.value.slice(0, 60).map((ride) => <Link key={ride.id} href={`/${locale}/app/history/${ride.id}`}><time dateTime={ride.startedAt}>{new Intl.DateTimeFormat(getLocaleTag(locale), { day: "2-digit", month: "short" }).format(new Date(ride.startedAt))}</time><span>{ride.title}</span></Link>)}</div> : <AppEmpty>{t("common.empty")}</AppEmpty>}
      </AppPanel>
    </>
  );
}
