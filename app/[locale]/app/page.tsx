import Link from "next/link";
import { notFound } from "next/navigation";

import { AppEmpty, AppNotice, AppPageHeader, AppPanel } from "@/components/app-ui";
import { RideCard } from "@/components/ride-card";
import { listAuthorizedRides, listConnections, listRideHistory, listRideInterest, listRideInvites, loadViewer } from "@/lib/app-data";
import { formatDate, formatDistance } from "@/lib/app-format";
import { getAppDictionary } from "@/lib/app-i18n";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProtectedPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function ProtectedPage({ params, searchParams }: ProtectedPageProps) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const viewer = await loadViewer(client);
  const [ridesResult, connectionsResult, invitesResult, interestResult, historyResult] = await Promise.allSettled([
    listAuthorizedRides(client, viewer.userId),
    listConnections(client, viewer.userId),
    listRideInvites(client, viewer.userId),
    listRideInterest(client, viewer.userId),
    viewer.access.hasPro ? listRideHistory(client, viewer.userId, 5) : Promise.resolve([])
  ]);
  const rides = ridesResult.status === "fulfilled" ? ridesResult.value : [];
  const connections = connectionsResult.status === "fulfilled" ? connectionsResult.value : [];
  const invites = invitesResult.status === "fulfilled" ? invitesResult.value : [];
  const interest = interestResult.status === "fulfilled" ? interestResult.value : [];
  const history = historyResult.status === "fulfilled" ? historyResult.value : [];
  const nextRide = rides[0] ?? null;
  const pendingInvites = invites.filter((invite) => invite.direction === "received" && !invite.acceptedAt && !invite.declinedAt);
  const pendingInterest = interest.filter((item) => item.direction === "received" && item.responseStatus === "pending" && !item.expired);
  const acceptedConnections = connections.filter((connection) => connection.state === "accepted");
  const { notice } = await searchParams;
  const hasLoadError = [ridesResult, connectionsResult, invitesResult, interestResult, historyResult].some((result) => result.status === "rejected");
  return (
    <>
      <AppPageHeader eyebrow={t("shell.eyebrow")} title={t("overview.title")} intro={t("overview.intro")} action={
        <Link className="bike-app-button" href={`/${locale}/app/rides/new`}>{t("rides.create")}</Link>
      } />
      <AppNotice locale={locale} code={hasLoadError ? "data" : notice} />
      <div className="bike-app-grid" data-columns="4">
        <div className="bike-app-stat"><span>{t("overview.invitations")}</span><strong>{pendingInvites.length}</strong></div>
        <div className="bike-app-stat"><span>{t("overview.interest")}</span><strong>{pendingInterest.length}</strong></div>
        <div className="bike-app-stat"><span>{t("overview.connections")}</span><strong>{acceptedConnections.length}</strong></div>
        <div className="bike-app-stat"><span>{t("overview.recent")}</span><strong>{viewer.access.hasPro ? history.length : t("common.pro")}</strong></div>
      </div>
      <div className="bike-app-grid bike-app-overview-grid" data-columns="2">
        <AppPanel title={t("overview.nextRide")} action={<Link href={`/${locale}/app/rides`}>{t("common.view")}</Link>}>
          {nextRide ? <RideCard ride={nextRide} locale={locale} units={viewer.profile.unitSystem} t={t} /> : <AppEmpty>{t("overview.noUpcoming")}</AppEmpty>}
        </AppPanel>
        <AppPanel title={t("overview.invitations")} action={<Link href={`/${locale}/app/requests`}>{t("common.view")}</Link>}>
          {pendingInvites.length ? <ul className="bike-app-list">{pendingInvites.slice(0, 4).map((invite) => (
            <li key={`${invite.rideId}-${invite.inviteeId}`} className="bike-app-list-item">
              <div className="bike-app-list-main"><div><strong>{invite.rideTitle ?? t("rides.details")}</strong><small>{invite.counterpart?.displayName ?? "Bike Me"}{invite.rideStartTime ? ` · ${formatDate(locale, invite.rideStartTime)}` : ""}</small></div></div>
              <Link className="bike-app-button bike-app-button-secondary bike-app-button-small" href={`/${locale}/app/requests`}>{t("common.view")}</Link>
            </li>
          ))}</ul> : <AppEmpty>{t("common.empty")}</AppEmpty>}
        </AppPanel>
        <AppPanel title={t("overview.interest")} action={<Link href={`/${locale}/app/requests`}>{t("common.view")}</Link>}>
          {pendingInterest.length ? <ul className="bike-app-list">{pendingInterest.slice(0, 4).map((item) => (
            <li key={item.id} className="bike-app-list-item"><div className="bike-app-list-main"><div><strong>{item.counterpart?.displayName ?? "Bike Me"}</strong><small>{formatDate(locale, item.windowStartDate)}</small></div></div><span className="bike-app-chip" data-tone="purple">{t("common.pending")}</span></li>
          ))}</ul> : <AppEmpty>{t("common.empty")}</AppEmpty>}
        </AppPanel>
        <AppPanel title={t("overview.recent")} action={<Link href={`/${locale}/app/history`}>{t("common.view")}</Link>}>
          {viewer.access.hasPro && history.length ? <ul className="bike-app-list">{history.map((ride) => (
            <li key={ride.id} className="bike-app-list-item"><div className="bike-app-list-main"><div><strong>{ride.title}</strong><small>{formatDate(locale, ride.startedAt)} · {formatDistance(locale, ride.distanceKm, viewer.profile.unitSystem)}</small></div></div><Link className="bike-app-button bike-app-button-secondary bike-app-button-small" href={`/${locale}/app/history/${ride.id}`}>{t("common.view")}</Link></li>
          ))}</ul> : <AppEmpty>{viewer.access.hasPro ? t("common.empty") : t("access.lockedTitle")}</AppEmpty>}
        </AppPanel>
      </div>
    </>
  );
}
