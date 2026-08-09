import Link from "next/link";
import { notFound } from "next/navigation";

import { AppAvatar } from "@/components/app-avatar";
import { AppEmpty, AppNotice, AppPageHeader, AppPanel } from "@/components/app-ui";
import { RoutePreview } from "@/components/route-preview";
import { listConnections, loadRideDetail, loadViewer } from "@/lib/app-data";
import { formatDateTime, formatDistance } from "@/lib/app-format";
import { getAppDictionary } from "@/lib/app-i18n";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

import { cancelRideAction, inviteRiderAction, joinRideAction, leaveRideAction } from "../../actions";

export default async function RideDetailPage({ params, searchParams }: { params: Promise<{ locale: string; rideId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { locale: localeParam, rideId } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const viewer = await loadViewer(client);
  const ride = await loadRideDetail(client, viewer.userId, rideId).catch(() => null);
  if (!ride) notFound();
  const connections = ride.hostId === viewer.userId ? await listConnections(client, viewer.userId).catch(() => []) : [];
  const invitedIds = new Set(ride.invites.map((invite) => invite.inviteeId));
  const inviteable = connections.filter((connection) => connection.state === "accepted" && !invitedIds.has(connection.counterpart.id));
  const isHost = ride.hostId === viewer.userId;
  const { notice } = await searchParams;
  const returnTo = `/${locale}/app/rides/${ride.id}`;
  return (
    <>
      <AppPageHeader eyebrow={`${t(ride.type === "PING" ? "rides.rideNow" : "rides.planned")} · ${t(ride.visibility === "private" ? "common.private" : "common.public")}`} title={ride.title} intro={ride.description ?? t("rides.details")} action={<Link className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/rides`}>{t("common.back")}</Link>} />
      <AppNotice locale={locale} code={notice} />
      <div className="bike-app-grid" data-columns="2">
        <AppPanel title={t("rides.details")}>
          <dl className="bike-app-definition">
            <div><dt>{t("rides.startLabel")}</dt><dd>{formatDateTime(locale, ride.startTime)}</dd></div>
            <div><dt>{t("common.host")}</dt><dd>{ride.hostName ?? "Bike Me"}</dd></div>
            <div><dt>{t("rides.discipline")}</dt><dd>{ride.discipline}</dd></div>
            <div><dt>{t("rides.distance")}</dt><dd>{formatDistance(locale, ride.distanceKm, viewer.profile.unitSystem)}</dd></div>
            <div><dt>{t("rides.meeting")}</dt><dd>{ride.meetingAddress ?? "—"}</dd></div>
            <div><dt>{t("common.participants")}</dt><dd>{ride.participantCount}{ride.maxParticipants ? ` / ${ride.maxParticipants}` : ""}</dd></div>
          </dl>
          <div className="bike-app-actions bike-app-detail-actions">
            {!isHost ? <form action={ride.joined ? leaveRideAction : joinRideAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="rideId" value={ride.id} /><button className="bike-app-button" type="submit">{ride.joined ? t("common.leave") : t("common.join")}</button></form> : null}
            {isHost ? <><Link className="bike-app-button bike-app-button-secondary" href={`${returnTo}/edit`}>{t("common.edit")}</Link><form action={cancelRideAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="rideId" value={ride.id} /><button className="bike-app-button bike-app-button-danger" type="submit">{t("rides.cancelRide")}</button></form></> : null}
          </div>
        </AppPanel>
        <AppPanel title={t("rides.route")}>
          {ride.route.length >= 2 ? <RoutePreview points={ride.route} label={t("rides.route")} /> : <AppEmpty>{t("rides.routeUnavailable")}</AppEmpty>}
        </AppPanel>
      </div>
      <div className="bike-app-grid bike-app-section-gap" data-columns="2">
        <AppPanel title={t("common.participants")}>
          {ride.participants.length ? <ul className="bike-app-list">{ride.participants.map((participant) => <li key={participant.id} className="bike-app-list-item"><div className="bike-app-list-main"><AppAvatar name={participant.displayName} url={participant.avatarUrl} /><div><strong>{participant.displayName ?? "Bike Me"}</strong><small>{participant.role === "HOST" ? t("common.host") : participant.status}</small></div></div></li>)}</ul> : <AppEmpty>{t("common.empty")}</AppEmpty>}
        </AppPanel>
        {isHost ? <AppPanel title={t("rides.invite")}>
          {inviteable.length ? <ul className="bike-app-list">{inviteable.map((connection) => <li key={connection.id} className="bike-app-list-item"><div className="bike-app-list-main"><AppAvatar name={connection.counterpart.displayName} url={connection.counterpart.avatarUrl} /><div><strong>{connection.counterpart.displayName ?? "Bike Me"}</strong><small>{connection.counterpart.region}</small></div></div><form action={inviteRiderAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="rideId" value={ride.id} /><input type="hidden" name="inviteeId" value={connection.counterpart.id} /><button className="bike-app-button bike-app-button-small" type="submit">{t("common.send")}</button></form></li>)}</ul> : <AppEmpty>{t("common.empty")}</AppEmpty>}
        </AppPanel> : null}
      </div>
    </>
  );
}
