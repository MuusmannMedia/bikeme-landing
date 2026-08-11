"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import { AppEmpty, AppPanel } from "@/components/app-ui";
import { StatusBars } from "@/components/status-bars";
import { StatusCalendar } from "@/components/status-calendar";
import { getLocaleTag } from "@/lib/app-format";
import type { StatusHistoryRide, UnitSystem } from "@/lib/app-model";
import {
  buildStatusInsights,
  buildStatusSummary,
  getStatusZonedParts,
  statusFallbackTimeZone,
  statusMetrics,
  statusRanges,
  statusZoneColors,
  type StatusMetric,
  type StatusRange
} from "@/lib/app-status";
import {
  formatEstimatedSplit,
  formatStatusDistance,
  formatStatusDuration,
  formatStatusElevation,
  formatStatusSpeed,
  formatStatusWatts,
  formatStatusWkg,
  formatStatusZoneDuration,
  statusText
} from "@/lib/status-format";
import type { Locale } from "@/lib/locales";

const rangeKey: Record<StatusRange, "status.range7d" | "status.range1m" | "status.range3m" | "status.range6m" | "status.rangeYtd" | "status.range1y"> = {
  "7D": "status.range7d", "1M": "status.range1m", "3M": "status.range3m", "6M": "status.range6m", YTD: "status.rangeYtd", "1Y": "status.range1y"
};
const metricKey: Record<StatusMetric, "status.metricDistance" | "status.metricElevation" | "status.metricDuration"> = {
  distance: "status.metricDistance", elevation: "status.metricElevation", duration: "status.metricDuration"
};
const zoneLabelKeys = ["status.zone1", "status.zone2", "status.zone3", "status.zone4", "status.zone5", "status.zone6", "status.zone7"] as const;

function FilterLinks({ locale, range, metric, kind }: { locale: Locale; range: StatusRange; metric: StatusMetric; kind: "range" | "metric" }) {
  const items = kind === "range" ? statusRanges : statusMetrics;
  return (
    <div className={`bike-app-segments ${kind === "metric" ? "bike-app-metric-segments" : ""}`} aria-label={kind === "range" ? statusText(locale, "status.title") : statusText(locale, "status.development")}>
      {items.map((item) => {
        const active = kind === "range" ? range === item : metric === item;
        const href = kind === "range"
          ? `/${locale}/app/status?range=${item}&metric=${metric}`
          : `/${locale}/app/status?range=${range}&metric=${item}`;
        const label = kind === "range" ? statusText(locale, rangeKey[item as StatusRange]) : statusText(locale, metricKey[item as StatusMetric]);
        return <Link key={item} href={href} data-active={active} aria-current={active ? "page" : undefined}>{label}</Link>;
      })}
    </div>
  );
}

export function StatusDashboard({
  history,
  locale,
  range,
  metric,
  unitSystem,
  weightKg,
  ftp,
  nowIso
}: {
  history: StatusHistoryRide[];
  locale: Locale;
  range: StatusRange;
  metric: StatusMetric;
  unitSystem: UnitSystem;
  weightKg: number | null;
  ftp: number | null;
  nowIso: string;
}) {
  const timeZone = useSyncExternalStore(
    () => () => undefined,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || statusFallbackTimeZone,
    () => statusFallbackTimeZone
  );
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const summary = useMemo(() => buildStatusSummary(history, range, metric, locale, now, timeZone), [history, locale, metric, now, range, timeZone]);
  const insights = useMemo(() => buildStatusInsights(history, range, { weightKg, ftp }, now, timeZone), [ftp, history, now, range, timeZone, weightKg]);
  const nowParts = getStatusZonedParts(now, timeZone);
  const localeTag = getLocaleTag(locale);
  const metricLabel = statusText(locale, metricKey[metric]);
  const dateRange = new Intl.DateTimeFormat(localeTag, { day: "numeric", month: "short", year: "numeric", timeZone });
  const periodLabel = `${dateRange.format(new Date(summary.start))} – ${dateRange.format(new Date(summary.end))}`;
  const comparison = summary.comparisonPercent == null
    ? statusText(locale, "status.noPreviousData")
    : `${summary.comparisonPercent > 0 ? "+" : ""}${summary.comparisonPercent}% ${statusText(locale, "status.vsPreviousPeriod")}`;
  const zoneEmpty = insights.zones.emptyReason === "rides"
    ? statusText(locale, "status.zoneRideMore")
    : insights.zones.emptyReason === "ftp"
      ? statusText(locale, "status.zoneFtpMissing")
      : statusText(locale, "status.zoneNoData");
  const performanceSections = [
    {
      title: statusText(locale, "status.bestTimes"),
      hint: statusText(locale, "status.estimatedResults"),
      items: [
        [statusText(locale, "status.fastest1k"), formatEstimatedSplit(locale, insights.records.estimatedFastestSeconds[1])],
        [statusText(locale, "status.fastest5k"), formatEstimatedSplit(locale, insights.records.estimatedFastestSeconds[5])],
        [statusText(locale, "status.fastest10k"), formatEstimatedSplit(locale, insights.records.estimatedFastestSeconds[10])]
      ]
    },
    {
      title: statusText(locale, "status.endurance"),
      items: [
        [statusText(locale, "status.longestRide"), insights.records.longestDistanceKm == null ? "—" : formatStatusDistance(locale, insights.records.longestDistanceKm, unitSystem, "weekly")],
        [statusText(locale, "status.longestTime"), insights.records.longestDurationMinutes == null ? "—" : formatStatusDuration(locale, insights.records.longestDurationMinutes)],
        [statusText(locale, "status.mostElevation"), insights.records.mostElevationMeters == null ? "—" : formatStatusElevation(locale, insights.records.mostElevationMeters, unitSystem)]
      ]
    },
    {
      title: statusText(locale, "status.speedPower"),
      items: [
        [statusText(locale, "status.topSpeed"), formatStatusSpeed(locale, insights.records.topSpeedKmh, unitSystem)],
        [statusText(locale, "status.highestWatts"), formatStatusWatts(insights.records.highestWatts)]
      ]
    }
  ];

  return (
    <div className="bike-app-status-dashboard" data-time-zone={timeZone}>
      <FilterLinks locale={locale} range={range} metric={metric} kind="metric" />

      <div className="bike-app-grid" data-columns="4">
        <div className="bike-app-stat"><span>{statusText(locale, "status.distance")}</span><strong>{formatStatusDistance(locale, summary.totals.distanceKm, unitSystem)}</strong></div>
        <div className="bike-app-stat"><span>{statusText(locale, "status.duration")}</span><strong>{formatStatusDuration(locale, summary.totals.durationMinutes)}</strong></div>
        <div className="bike-app-stat"><span>{statusText(locale, "status.elevation")}</span><strong>{formatStatusElevation(locale, summary.totals.elevationMeters, unitSystem)}</strong></div>
        <div className="bike-app-stat"><span>{statusText(locale, "status.rides")}</span><strong>{summary.totals.rideCount}</strong></div>
      </div>

      <AppPanel title={statusText(locale, "status.development")} className="bike-app-section-gap">
        <div className="bike-app-status-chart-heading"><div><span>{metricLabel}</span><strong>{metric === "distance" ? formatStatusDistance(locale, summary.totals.distanceKm, unitSystem) : metric === "elevation" ? formatStatusElevation(locale, summary.totals.elevationMeters, unitSystem) : formatStatusDuration(locale, summary.totals.durationMinutes)}</strong></div><p>{comparison}<small>{periodLabel}</small></p></div>
        {summary.totals.rideCount > 0
          ? <StatusBars key={`${range}-${metric}-${timeZone}`} buckets={summary.buckets} metric={metric} label={metricLabel} locale={locale} unitSystem={unitSystem} timeZone={timeZone} />
          : <AppEmpty>{statusText(locale, "common.empty")}</AppEmpty>}
      </AppPanel>
      <div className="bike-app-section-gap"><FilterLinks locale={locale} range={range} metric={metric} kind="range" /></div>

      <AppPanel title={statusText(locale, "status.thisWeek")} className="bike-app-section-gap">
        <div className="bike-app-week-scroller" role="region" tabIndex={0} aria-label={statusText(locale, "status.thisWeek")}>
          {insights.weeks.map((week) => (
            <article key={week.id}>
              <h3>{week.isCurrent ? statusText(locale, "status.thisWeek") : statusText(locale, "status.weekNumber", { number: week.weekNumber })}</h3>
              <dl><div><dt>{statusText(locale, "status.metricDistance")}</dt><dd>{formatStatusDistance(locale, week.distanceKm, unitSystem, "weekly")}</dd></div><div><dt>{statusText(locale, "status.metricElevation")}</dt><dd>{formatStatusElevation(locale, week.elevationMeters, unitSystem)}</dd></div><div><dt>{statusText(locale, "status.metricDuration")}</dt><dd>{formatStatusDuration(locale, week.durationMinutes)}</dd></div></dl>
            </article>
          ))}
        </div>
      </AppPanel>

      <section className="bike-app-section-gap" aria-labelledby="status-overview-title">
        <header className="bike-app-status-section-heading"><div><h2 id="status-overview-title">{statusText(locale, "status.overview")}</h2><p>{new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric", timeZone }).format(now)}</p></div></header>
        <AppPanel title={statusText(locale, "status.activityCalendar")}>
          <StatusCalendar key={`${timeZone}-${nowParts.year}-${nowParts.month}`} history={history} locale={locale} timeZone={timeZone} now={now} initialYear={nowParts.year} initialMonth={nowParts.month} />
        </AppPanel>
        <div className="bike-app-status-streak-grid">
          <div><span>{statusText(locale, "status.streak")}</span><strong>{statusText(locale, "status.weeksCount", { count: insights.streakWeeks })}</strong></div>
          <div><span>{statusText(locale, "status.consecutiveActivities")}</span><strong>{insights.streakActivities}</strong></div>
        </div>
      </section>

      <AppPanel title={statusText(locale, "status.wattPerformance")} className="bike-app-section-gap">
        <dl className="bike-app-status-value-grid">
          <div><dt>{statusText(locale, "status.estimatedFtp")}</dt><dd>{formatStatusWatts(insights.power.estimatedFtpWatts)}</dd></div>
          <div><dt>W/kg</dt><dd>{formatStatusWkg(locale, insights.power.wattsPerKg)}</dd></div>
          <div><dt>{statusText(locale, "status.maxWatts")}</dt><dd>{formatStatusWatts(insights.power.maxWatts)}</dd></div>
          <div><dt>{statusText(locale, "status.avgLastRide")}</dt><dd>{formatStatusWatts(insights.power.latestAverageWatts)}</dd></div>
        </dl>
      </AppPanel>

      <AppPanel
        title={statusText(locale, "status.trainingZones")}
        className="bike-app-section-gap"
        action={<details className="bike-app-zone-info"><summary aria-label={statusText(locale, "status.trainingZonesInfoA11y")}>i</summary><div><strong>{statusText(locale, "status.zoneInfoTitle")}</strong><p>{statusText(locale, "status.zoneInfoIntro")}</p><ul>{(["status.zoneInfoZ1", "status.zoneInfoZ2", "status.zoneInfoZ3", "status.zoneInfoZ4", "status.zoneInfoZ5", "status.zoneInfoZ6", "status.zoneInfoZ7"] as const).map((key) => <li key={key}>{statusText(locale, key)}</li>)}</ul><p>{statusText(locale, "status.zoneInfoOutro")}</p></div></details>}
      >
        <FilterLinks locale={locale} range={range} metric={metric} kind="range" />
        {insights.zones.totalSeconds > 0 ? (
          <div className="bike-app-status-zones">
            {insights.zones.seconds.map((seconds, index) => {
              const percent = Math.round(seconds / insights.zones.totalSeconds * 100);
              return <div key={index}><span>{statusText(locale, zoneLabelKeys[index])}</span><div><i style={{ width: `${percent}%`, background: statusZoneColors[index] }} /></div><strong style={{ color: seconds > 0 ? statusZoneColors[index] : undefined }}>{formatStatusZoneDuration(locale, seconds)} ({percent}%)</strong></div>;
            })}
          </div>
        ) : <AppEmpty>{zoneEmpty}</AppEmpty>}
        {insights.zones.usedAveragePowerFallback ? <p className="bike-app-muted bike-app-status-helper">{statusText(locale, "status.zoneEstimatedHelper")}</p> : null}
      </AppPanel>

      <AppPanel title={statusText(locale, "status.topPerformances")} className="bike-app-section-gap">
        <div className="bike-app-status-performance">
          {performanceSections.map((section) => <section key={section.title}><header><h3>{section.title}</h3>{section.hint ? <span>{section.hint}</span> : null}</header><dl>{section.items.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></section>)}
        </div>
      </AppPanel>

      <AppPanel title={statusText(locale, "status.latestRides")} className="bike-app-section-gap">
        {history.length > 0 ? <div className="bike-app-calendar-list">{history.slice(0, 60).map((ride) => <Link key={ride.id} href={`/${locale}/app/history/${ride.id}`}><time dateTime={ride.startedAt}>{new Intl.DateTimeFormat(localeTag, { day: "2-digit", month: "short", timeZone }).format(new Date(ride.startedAt))}</time><span>{ride.title}</span></Link>)}</div> : <AppEmpty>{statusText(locale, "common.empty")}</AppEmpty>}
      </AppPanel>
    </div>
  );
}
