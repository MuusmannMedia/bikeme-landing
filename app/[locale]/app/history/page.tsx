import Link from "next/link";
import { notFound } from "next/navigation";

import { AppEmpty, AppNotice, AppPageHeader, AppPanel, ProGate } from "@/components/app-ui";
import { listRideHistory, loadViewer } from "@/lib/app-data";
import { formatDate, formatDistance, formatDuration, formatElevation } from "@/lib/app-format";
import { getAppDictionary } from "@/lib/app-i18n";
import { overviewRecentRideLimit } from "@/lib/app-overview";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string; view?: string }> }) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const viewer = await loadViewer(client);
  if (!viewer.access.hasPro) return <ProGate locale={locale} />;
  const query = await searchParams;
  const recentOnly = query.view === "recent";
  const result = await listRideHistory(client, viewer.userId, recentOnly ? overviewRecentRideLimit : 200).then((value) => ({ value, failed: false })).catch(() => ({ value: [], failed: true }));
  const notice = query.notice;
  return (
    <>
      <AppPageHeader eyebrow={t("common.pro")} title={t("history.title")} intro={t("history.intro")} />
      <AppNotice locale={locale} code={result.failed ? "data" : notice} />
      <AppPanel>
        {result.value.length ? (
          <div className="bike-app-history-table-wrap">
            <table className="bike-app-table" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader" scope="col">{t("history.details")}</th>
                  <th role="columnheader" scope="col">{t("rides.distance")}</th>
                  <th role="columnheader" scope="col">{t("history.duration")}</th>
                  <th role="columnheader" scope="col">{t("history.elevation")}</th>
                  <th role="columnheader" scope="col" aria-label={t("common.view")} />
                </tr>
              </thead>
              <tbody role="rowgroup">
                {result.value.map((ride) => (
                  <tr key={ride.id} className="bike-app-history-row" role="row">
                    <td className="bike-app-history-title" role="cell">
                      <Link className="bike-app-history-link" href={`/${locale}/app/history/${ride.id}`}>
                        <strong>{ride.title}</strong>
                        <small>{formatDate(locale, ride.startedAt)} · {ride.discipline}</small>
                      </Link>
                    </td>
                    <td className="bike-app-history-metric" role="cell">
                      <span className="bike-app-history-metric-label" aria-hidden="true">{t("rides.distance")}</span>
                      {formatDistance(locale, ride.distanceKm, viewer.profile.unitSystem)}
                    </td>
                    <td className="bike-app-history-metric" role="cell">
                      <span className="bike-app-history-metric-label" aria-hidden="true">{t("history.duration")}</span>
                      {formatDuration(ride.durationMinutes)}
                    </td>
                    <td className="bike-app-history-metric" role="cell">
                      <span className="bike-app-history-metric-label" aria-hidden="true">{t("history.elevation")}</span>
                      {formatElevation(locale, ride.elevationGain, viewer.profile.unitSystem)}
                    </td>
                    <td className="bike-app-history-view" role="cell">
                      <span className="bike-app-button bike-app-button-secondary bike-app-button-small" aria-hidden="true">{t("common.view")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <AppEmpty>{t("common.empty")}</AppEmpty>}
      </AppPanel>
    </>
  );
}
