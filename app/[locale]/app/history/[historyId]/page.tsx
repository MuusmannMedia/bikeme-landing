import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteRideHistoryAction } from "@/app/[locale]/app/actions";
import { AppEmpty, AppNotice, AppPageHeader, AppPanel, ProGate } from "@/components/app-ui";
import { DeleteHistoryRide } from "@/components/delete-history-ride";
import { RouteMap } from "@/components/route-map";
import { RoutePreview } from "@/components/route-preview";
import { loadRideHistoryDetail, loadViewer } from "@/lib/app-data";
import { formatDateTime, formatDistance, formatDuration, formatElevation, formatNumber, formatSpeed, trimRouteForPrivacy } from "@/lib/app-format";
import { getAppDictionary } from "@/lib/app-i18n";
import { buildStatusCalendarReturnPath, buildStatusCalendarRidePath, parseStatusCalendarOrigin } from "@/lib/app-status";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryDetailPage({ params, searchParams }: { params: Promise<{ locale: string; historyId: string }>; searchParams: Promise<{ from?: string; calendar?: string; range?: string; metric?: string; notice?: string }> }) {
  const { locale: localeParam, historyId } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const query = await searchParams;
  const calendarOrigin = parseStatusCalendarOrigin(query);
  const backHref = calendarOrigin ? buildStatusCalendarReturnPath(locale, calendarOrigin) : `/${locale}/app/history`;
  const client = await createClient();
  const viewer = await loadViewer(client);
  if (!viewer.access.hasPro) return <ProGate locale={locale} />;
  const ride = await loadRideHistoryDetail(client, viewer.userId, historyId).catch(() => null);
  if (!ride) notFound();
  const detailReturnTo = calendarOrigin
    ? buildStatusCalendarRidePath(locale, ride.id, calendarOrigin)
    : `/${locale}/app/history/${ride.id}`;
  const displayRoute = trimRouteForPrivacy(ride.route, viewer.profile.hideStartEnd);
  const zoneEntries = ride.zones ? Object.entries(ride.zones) : [];
  const zoneTotal = zoneEntries.reduce((sum, [, seconds]) => sum + seconds, 0);
  return (
    <>
      <AppPageHeader eyebrow={formatDateTime(locale, ride.startedAt)} title={ride.title} intro={ride.startAddress ?? t("history.details")} action={<Link className="bike-app-button bike-app-button-secondary" href={backHref}>{t("common.back")}</Link>} />
      <AppNotice locale={locale} code={query.notice} />
      <div className="bike-app-grid" data-columns="2">
        <AppPanel title={t("history.details")}>
          <dl className="bike-app-definition">
            <div><dt>{t("rides.distance")}</dt><dd>{formatDistance(locale, ride.distanceKm, viewer.profile.unitSystem)}</dd></div>
            <div><dt>{t("history.duration")}</dt><dd>{formatDuration(ride.durationMinutes)}</dd></div>
            <div><dt>{t("history.speed")}</dt><dd>{formatSpeed(locale, ride.distanceKm, ride.durationMinutes, viewer.profile.unitSystem)}</dd></div>
            <div><dt>{t("history.elevation")}</dt><dd>{formatElevation(locale, ride.elevationGain, viewer.profile.unitSystem)}</dd></div>
            <div><dt>{t("history.watts")}</dt><dd>{ride.averageWatts ? `${formatNumber(locale, ride.averageWatts, 0)} W` : "—"} / {ride.maxWatts ? `${formatNumber(locale, ride.maxWatts, 0)} W` : "—"}</dd></div>
            <div><dt>{t("history.calories")}</dt><dd>{ride.caloriesKcal ? formatNumber(locale, ride.caloriesKcal, 0) : "—"}</dd></div>
          </dl>
          <div className="bike-app-actions bike-app-detail-actions">
            {ride.route.length >= 2 ? <a className="bike-app-button" href={`/${locale}/app/history/${ride.id}/gpx`} download>{t("history.export")}</a> : null}
            <DeleteHistoryRide
              action={deleteRideHistoryAction}
              cancelLabel={t("history.deleteCancel")}
              confirmLabel={t("history.delete")}
              description={t("history.deleteBody")}
              historyId={ride.id}
              locale={locale}
              pendingLabel={t("history.deleting")}
              returnTo={detailReturnTo}
              title={t("history.deleteTitle")}
              triggerLabel={t("history.delete")}
            />
          </div>
        </AppPanel>
        <AppPanel title={t("rides.route")}>
          {displayRoute.length >= 2 ? (
            <RouteMap
              points={displayRoute}
              label={t("rides.route")}
              fullscreenTitle={t("rides.route")}
              openFullscreenLabel={t("history.routeOpenFullscreen")}
              closeFullscreenLabel={t("common.close")}
              startLabel={t("history.routeStart")}
              finishLabel={t("history.routeFinish")}
              zoomInLabel={t("history.routeZoomIn")}
              zoomOutLabel={t("history.routeZoomOut")}
              attributionLabel={t("history.routeAttribution")}
              fallback={<RoutePreview points={displayRoute} label={t("rides.route")} />}
            />
          ) : <AppEmpty>{t("history.noRoute")}</AppEmpty>}
        </AppPanel>
      </div>
      <div className="bike-app-grid bike-app-section-gap" data-columns="2">
        <AppPanel title={t("history.zones")}>
          {zoneTotal > 0 ? <div className="bike-app-zones">{zoneEntries.map(([zone, seconds]) => <div key={zone}><span>{zone.toUpperCase()}</span><div><i style={{ width: `${Math.round(seconds / zoneTotal * 100)}%` }} /></div><strong>{formatDuration(seconds / 60)}</strong></div>)}</div> : <AppEmpty>{t("common.empty")}</AppEmpty>}
        </AppPanel>
        <AppPanel title={t("rides.descriptionLabel")}>
          {ride.notes ? <p className="bike-app-copy">{ride.notes}</p> : <AppEmpty>{t("common.empty")}</AppEmpty>}
        </AppPanel>
      </div>
    </>
  );
}
