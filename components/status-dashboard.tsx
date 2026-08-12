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
  statusCalendarMonthKey,
  type StatusCalendarMonth,
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
  formatStatusPercent,
  formatStatusSpeed,
  formatStatusWatts,
  formatStatusWkg,
  formatStatusZoneDuration,
  getStatusComparisonPresentation,
  statusDistanceUnit,
  statusElevationUnit,
  statusText
} from "@/lib/status-format";
import type { Locale } from "@/lib/locales";

const rangeKey: Record<StatusRange, "status.range7d" | "status.range1m" | "status.range3m" | "status.range6m" | "status.rangeYtd" | "status.range1y"> = {
  "7D": "status.range7d", "1M": "status.range1m", "3M": "status.range3m", "6M": "status.range6m", YTD: "status.rangeYtd", "1Y": "status.range1y"
};
const metricKey: Record<StatusMetric, "status.metricDistance" | "status.metricElevation" | "status.metricDuration"> = {
  distance: "status.metricDistance", elevation: "status.metricElevation", duration: "status.metricDuration"
};
const heroKey: Record<StatusMetric, "status.heroDistance" | "status.heroElevation" | "status.heroDuration"> = {
  distance: "status.heroDistance", elevation: "status.heroElevation", duration: "status.heroDuration"
};
const zoneLabelKeys = ["status.zone1", "status.zone2", "status.zone3", "status.zone4", "status.zone5", "status.zone6", "status.zone7"] as const;

function BicycleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="6" cy="17" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="17" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m6 17 4-7 3 7H6Zm4-7h4.2l3.8 7M9 7h3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function FilterLinks({ locale, range, metric, calendarMonth, kind }: { locale: Locale; range: StatusRange; metric: StatusMetric; calendarMonth: StatusCalendarMonth; kind: "range" | "metric" }) {
  const items = kind === "range" ? statusRanges : statusMetrics;
  const calendar = statusCalendarMonthKey(calendarMonth);
  return (
    <div className={`bike-app-segments ${kind === "metric" ? "bike-app-metric-segments" : ""}`} role="group" aria-label={statusText(locale, kind === "range" ? "status.periodSelector" : "status.metricSelector")}>
      {items.map((item) => {
        const active = kind === "range" ? range === item : metric === item;
        const href = kind === "range"
          ? `/${locale}/app/status?range=${item}&metric=${metric}&calendar=${calendar}`
          : `/${locale}/app/status?range=${range}&metric=${item}&calendar=${calendar}`;
        const label = kind === "range" ? statusText(locale, rangeKey[item as StatusRange]) : statusText(locale, metricKey[item as StatusMetric]);
        return <Link key={item} href={href} data-active={active} aria-current={active ? "true" : undefined}>{kind === "metric" && item === "distance" ? <BicycleIcon /> : null}{label}</Link>;
      })}
    </div>
  );
}

export function StatusDashboard({
  history,
  locale,
  range,
  metric,
  calendarMonth,
  unitSystem,
  weightKg,
  ftp,
  nowIso
}: {
  history: StatusHistoryRide[];
  locale: Locale;
  range: StatusRange;
  metric: StatusMetric;
  calendarMonth: StatusCalendarMonth | null;
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
  const calendarParts = calendarMonth ?? nowParts;
  const localeTag = getLocaleTag(locale);
  const calendarLabel = new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(calendarParts.year, calendarParts.month - 1, 1)));
  const metricLabel = statusText(locale, metricKey[metric]);
  const dateRange = new Intl.DateTimeFormat(localeTag, { day: "numeric", month: "short", year: "numeric", timeZone });
  const periodLabel = `${dateRange.format(new Date(summary.start))} – ${dateRange.format(new Date(summary.end))}`;
  const heroValue = metric === "distance"
    ? formatStatusDistance(locale, summary.totals.distanceKm, unitSystem)
    : metric === "elevation"
      ? formatStatusElevation(locale, summary.totals.elevationMeters, unitSystem)
      : formatStatusDuration(locale, summary.totals.durationMinutes);
  const chartUnit = metric === "distance"
    ? statusDistanceUnit(unitSystem)
    : metric === "elevation"
      ? statusElevationUnit(unitSystem)
      : statusText(locale, "status.hoursUnit");
  const comparison = getStatusComparisonPresentation(locale, summary.comparisonPercent);
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
      <FilterLinks locale={locale} range={range} metric={metric} calendarMonth={calendarParts} kind="metric" />

      <section className="bike-app-status-hero" aria-labelledby="status-hero-title">
        <div className="bike-app-status-hero-top">
          <div>
            <span>{statusText(locale, "status.title")}</span>
            <h2 id="status-hero-title">{statusText(locale, heroKey[metric])}</h2>
          </div>
          <div
            className="bike-app-status-comparison"
            data-direction={comparison.direction}
            aria-label={`${comparison.value}. ${comparison.label}`}
          >
            <strong>{comparison.value}</strong>
            <span>{comparison.label}</span>
          </div>
        </div>
        <strong className="bike-app-status-hero-value">{heroValue}</strong>
        <p>{periodLabel}</p>
      </section>

      <AppPanel
        title={statusText(locale, "status.development")}
        className="bike-app-section-gap bike-app-status-primary-panel"
        action={<span className="bike-app-status-chart-unit">{chartUnit}</span>}
      >
        <StatusBars key={`${range}-${metric}-${timeZone}`} buckets={summary.buckets} metric={metric} label={metricLabel} locale={locale} unitSystem={unitSystem} timeZone={timeZone} />
      </AppPanel>
      <div className="bike-app-section-gap"><FilterLinks locale={locale} range={range} metric={metric} calendarMonth={calendarParts} kind="range" /></div>

      <div className="bike-app-grid bike-app-status-kpis" data-columns="4">
        <div className="bike-app-stat"><span>{statusText(locale, "status.distance")}</span><strong>{formatStatusDistance(locale, summary.totals.distanceKm, unitSystem)}</strong></div>
        <div className="bike-app-stat"><span>{statusText(locale, "status.duration")}</span><strong>{formatStatusDuration(locale, summary.totals.durationMinutes)}</strong></div>
        <div className="bike-app-stat"><span>{statusText(locale, "status.elevation")}</span><strong>{formatStatusElevation(locale, summary.totals.elevationMeters, unitSystem)}</strong></div>
        <div className="bike-app-stat"><span>{statusText(locale, "status.rides")}</span><strong>{summary.totals.rideCount}</strong></div>
      </div>

      <AppPanel title={statusText(locale, "status.thisWeek")} className="bike-app-section-gap bike-app-status-primary-panel">
        <div className="bike-app-week-scroller" role="region" tabIndex={0} aria-label={statusText(locale, "status.thisWeek")}>
          {insights.weeks.map((week) => (
            <article key={week.id}>
              <h3>{statusText(locale, "status.weekNumber", { number: week.weekNumber })}</h3>
              <dl><div><dt>{statusText(locale, "status.metricDistance")}</dt><dd>{formatStatusDistance(locale, week.distanceKm, unitSystem, "weekly")}</dd></div><div><dt>{statusText(locale, "status.metricElevation")}</dt><dd>{formatStatusElevation(locale, week.elevationMeters, unitSystem)}</dd></div><div><dt>{statusText(locale, "status.metricDuration")}</dt><dd>{formatStatusDuration(locale, week.durationMinutes)}</dd></div></dl>
            </article>
          ))}
        </div>
      </AppPanel>

      <section id="status-calendar" className="bike-app-section-gap bike-app-status-calendar-anchor" aria-labelledby="status-overview-title">
        <header className="bike-app-status-section-heading"><div><h2 id="status-overview-title">{statusText(locale, "status.overview")}</h2><p>{calendarLabel}</p></div></header>
        <div className="bike-app-status-overview-grid">
          <AppPanel title={statusText(locale, "status.activityCalendar")} headingLevel={3} className="bike-app-status-calendar-panel">
            <StatusCalendar key={`${timeZone}-${calendarParts.year}-${calendarParts.month}`} history={history} locale={locale} timeZone={timeZone} now={now} initialYear={calendarParts.year} initialMonth={calendarParts.month} range={range} metric={metric} unitSystem={unitSystem} />
          </AppPanel>
          <div className="bike-app-status-streak-grid">
            <div><span>{statusText(locale, "status.streak")}</span><strong>{statusText(locale, "status.weeksCount", { count: insights.streakWeeks })}</strong></div>
            <div><span>{statusText(locale, "status.consecutiveActivities")}</span><strong>{insights.streakActivities}</strong></div>
          </div>
        </div>
      </section>

      <AppPanel title={statusText(locale, "status.wattPerformance")} className="bike-app-section-gap bike-app-status-primary-panel">
        <dl className="bike-app-status-value-grid">
          <div><dt>{statusText(locale, "status.estimatedFtp")}</dt><dd>{formatStatusWatts(insights.power.estimatedFtpWatts)}</dd></div>
          <div><dt>W/kg</dt><dd>{formatStatusWkg(locale, insights.power.wattsPerKg)}</dd></div>
          <div><dt>{statusText(locale, "status.maxWatts")}</dt><dd>{formatStatusWatts(insights.power.maxWatts)}</dd></div>
          <div><dt>{statusText(locale, "status.avgLastRide")}</dt><dd>{formatStatusWatts(insights.power.latestAverageWatts)}</dd></div>
        </dl>
      </AppPanel>

      <AppPanel
        title={statusText(locale, "status.trainingZones")}
        className="bike-app-section-gap bike-app-status-primary-panel"
        action={<details className="bike-app-zone-info"><summary aria-label={statusText(locale, "status.trainingZonesInfoA11y")}>i</summary><div><h3>{statusText(locale, "status.zoneInfoTitle")}</h3><p>{statusText(locale, "status.zoneInfoIntro")}</p><ul>{(["status.zoneInfoZ1", "status.zoneInfoZ2", "status.zoneInfoZ3", "status.zoneInfoZ4", "status.zoneInfoZ5", "status.zoneInfoZ6", "status.zoneInfoZ7"] as const).map((key) => <li key={key}>{statusText(locale, key)}</li>)}</ul><p>{statusText(locale, "status.zoneInfoOutro")}</p></div></details>}
      >
        <FilterLinks locale={locale} range={range} metric={metric} calendarMonth={calendarParts} kind="range" />
        {insights.zones.totalSeconds > 0 ? (
          <div className="bike-app-status-zones">
            {insights.zones.seconds.map((seconds, index) => {
              const percent = Math.round(seconds / insights.zones.totalSeconds * 100);
              return <div key={index}><span>{statusText(locale, zoneLabelKeys[index])}</span><div><i style={{ width: `${percent}%`, background: statusZoneColors[index] }} /></div><strong>{formatStatusZoneDuration(locale, seconds)} ({formatStatusPercent(locale, percent)})</strong></div>;
            })}
          </div>
        ) : <AppEmpty>{zoneEmpty}</AppEmpty>}
        {insights.zones.usedAveragePowerFallback ? <p className="bike-app-muted bike-app-status-helper">{statusText(locale, "status.zoneEstimatedHelper")}</p> : null}
      </AppPanel>

      <AppPanel title={statusText(locale, "status.topPerformances")} className="bike-app-section-gap bike-app-status-primary-panel">
        <div className="bike-app-status-performance">
          {performanceSections.map((section) => <section key={section.title}><header><h3 className="bike-app-status-category-title">{section.title}</h3>{section.hint ? <span>{section.hint}</span> : null}</header><dl>{section.items.map(([name, value]) => <div key={name}><dt>{name}</dt><dd className="bike-app-status-row-value">{value}</dd></div>)}</dl></section>)}
        </div>
      </AppPanel>

      <AppPanel title={statusText(locale, "status.latestRides")} className="bike-app-section-gap bike-app-status-primary-panel">
        {history.length > 0 ? <div className="bike-app-calendar-list">{history.slice(0, 60).map((ride) => <Link key={ride.id} href={`/${locale}/app/history/${ride.id}`}><time className="bike-app-status-meta" dateTime={ride.startedAt}>{new Intl.DateTimeFormat(localeTag, { day: "2-digit", month: "short", timeZone }).format(new Date(ride.startedAt))}</time><span className="bike-app-status-row-value">{ride.title}</span></Link>)}</div> : <AppEmpty>{statusText(locale, "common.empty")}</AppEmpty>}
      </AppPanel>
    </div>
  );
}
