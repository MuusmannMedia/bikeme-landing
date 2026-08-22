import Link from "next/link";
import { notFound } from "next/navigation";

import { AppAvatar } from "@/components/app-avatar";
import { AppEmpty, AppNotice, AppPageHeader, AppPanel } from "@/components/app-ui";
import { listHotspots, listRideInterest, listRideInvites, loadViewer } from "@/lib/app-data";
import { formatDate, formatDateTime } from "@/lib/app-format";
import { getAppDictionary } from "@/lib/app-i18n";
import type { RideInterest } from "@/lib/app-model";
import { selectPendingReceivedInterest, selectPendingReceivedInvites } from "@/lib/app-overview";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

import {
  acceptRideInviteAction,
  cancelRideInterestAction,
  convertRideInterestAction,
  declineRideInviteAction,
  dismissRideInterestAction,
  respondRideInterestAction
} from "../actions";

export default async function RequestsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string; view?: string }> }) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const viewer = await loadViewer(client);
  const [invitesResult, interestResult, hotspotsResult] = await Promise.allSettled([
    listRideInvites(client, viewer.userId),
    listRideInterest(client, viewer.userId),
    listHotspots(client)
  ]);
  const invites = invitesResult.status === "fulfilled" ? invitesResult.value : [];
  const interests = interestResult.status === "fulfilled" ? interestResult.value : [];
  const hotspots = hotspotsResult.status === "fulfilled" ? hotspotsResult.value : [];
  const query = await searchParams;
  const view = query.view === "invites" || query.view === "interest" ? query.view : null;
  const visibleInvites = view === "invites" ? selectPendingReceivedInvites(invites) : invites;
  const visibleInterests = view === "interest" ? selectPendingReceivedInterest(interests) : interests;
  const notice = query.notice;
  const returnTo = `/${locale}/app/requests${view ? `?view=${view}` : ""}`;
  const statusText = (item: RideInterest) => {
    if (item.expired && item.responseStatus !== "converted") return t("common.unavailable");
    const keys = {
      pending: "common.pending",
      interested: "requests.interested",
      maybe: "requests.maybe",
      declined: "requests.declined",
      cancelled: "requests.cancelled",
      converted: "rides.created"
    } as const;
    return item.responseStatus === "converted" ? t("message.created") : t(keys[item.responseStatus]);
  };
  const timeOptionText = (item: RideInterest) => t(item.timeOption === "today" ? "requests.today" : item.timeOption === "tomorrow" ? "requests.tomorrow" : item.timeOption === "this_weekend" ? "requests.weekend" : "requests.custom");
  const loadFailed = invitesResult.status === "rejected" || interestResult.status === "rejected" || hotspotsResult.status === "rejected";
  return (
    <>
      <AppPageHeader eyebrow={t("shell.eyebrow")} title={t("requests.title")} intro={t("requests.intro")} />
      <AppNotice locale={locale} code={loadFailed ? "data" : notice} />
      {view !== "interest" ? <AppPanel title={t("requests.invites")}>
        {visibleInvites.length ? <ul className="bike-app-list">{visibleInvites.map((invite) => {
          const isPending = !invite.acceptedAt && !invite.declinedAt;
          return <li key={`${invite.rideId}-${invite.inviteeId}`} className="bike-app-list-item"><div className="bike-app-list-main"><AppAvatar name={invite.counterpart?.displayName ?? null} url={invite.counterpart?.avatarUrl} /><div><strong>{invite.rideTitle ?? t("rides.details")}</strong><small>{invite.direction === "received" ? t("common.received") : t("common.sent")}{invite.rideStartTime ? ` · ${formatDateTime(locale, invite.rideStartTime)}` : ""} · {invite.counterpart?.displayName ?? "Bike Me"}</small></div></div><div className="bike-app-actions"><Link className="bike-app-button bike-app-button-secondary bike-app-button-small" href={`/${locale}/app/rides/${invite.rideId}`}>{t("common.view")}</Link>{invite.direction === "received" && isPending ? <><form action={acceptRideInviteAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="rideId" value={invite.rideId} /><button className="bike-app-button bike-app-button-small">{t("common.accept")}</button></form><form action={declineRideInviteAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="rideId" value={invite.rideId} /><button className="bike-app-button bike-app-button-secondary bike-app-button-small">{t("common.decline")}</button></form></> : <span className="bike-app-chip">{invite.acceptedAt ? t("common.accept") : invite.declinedAt ? t("requests.declined") : t("common.pending")}</span>}</div></li>;
        })}</ul> : <AppEmpty>{t("common.empty")}</AppEmpty>}
      </AppPanel> : null}

      {view !== "invites" ? <AppPanel title={t("requests.interest")} className={view === "interest" ? "" : "bike-app-section-gap"}>
        {visibleInterests.length ? <div className="bike-app-grid" data-columns="2">{visibleInterests.map((item) => {
          const isExpired = item.expired;
          const canRespond = item.direction === "received" && item.responseStatus === "pending" && !isExpired;
          const canCancel = item.direction === "sent" && item.responseStatus === "pending" && !isExpired;
          const canConvert = item.direction === "sent" && (item.responseStatus === "interested" || item.responseStatus === "maybe") && !isExpired && !item.createdRideId;
          const canDismiss = !canRespond && !canCancel && !canConvert && item.responseStatus !== "converted";
          return (
            <article key={item.id} className="bike-app-panel bike-app-request-card">
              <header><div className="bike-app-list-main"><AppAvatar name={item.counterpart?.displayName ?? null} url={item.counterpart?.avatarUrl} /><div><h2>{item.counterpart?.displayName ?? "Bike Me"}</h2><p>{item.direction === "received" ? t("common.received") : t("common.sent")}</p></div></div><span className="bike-app-chip" data-tone="purple">{statusText(item)}</span></header>
              <dl className="bike-app-definition"><div><dt>{t("requests.preferredDate")}</dt><dd>{timeOptionText(item)} · {formatDate(locale, item.windowStartDate)}{item.windowEndDate !== item.windowStartDate ? ` – ${formatDate(locale, item.windowEndDate)}` : ""}</dd></div><div><dt>{t("requests.preferredTime")}</dt><dd>{item.preferredTime?.slice(0, 5) ?? "—"}</dd></div></dl>
              {canRespond ? <div className="bike-app-actions">{(["interested", "maybe", "declined"] as const).map((response) => <form key={response} action={respondRideInterestAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="requestId" value={item.id} /><input type="hidden" name="responseStatus" value={response} /><button className={`bike-app-button bike-app-button-small ${response === "declined" ? "bike-app-button-secondary" : ""}`}>{t(response === "interested" ? "requests.interested" : response === "maybe" ? "requests.maybe" : "requests.declined")}</button></form>)}</div> : null}
              {canCancel ? <form action={cancelRideInterestAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="requestId" value={item.id} /><button className="bike-app-button bike-app-button-secondary bike-app-button-small">{t("common.cancel")}</button></form> : null}
              {canDismiss ? <form action={dismissRideInterestAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="requestId" value={item.id} /><button className="bike-app-button bike-app-button-secondary bike-app-button-small">{t("common.remove")}</button></form> : null}
              {item.createdRideId ? <Link className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/rides/${item.createdRideId}`}>{t("common.view")}</Link> : null}
              {canConvert && hotspots.length ? <form action={convertRideInterestAction} className="bike-app-form bike-app-convert-form"><h3>{t("requests.convert")}</h3><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="requestId" value={item.id} /><label className="bike-app-field"><span>{t("rides.titleLabel")}</span><input name="title" required minLength={3} maxLength={120} /></label><div className="bike-app-form-grid"><label className="bike-app-field"><span>{t("rides.hotspotLabel")}</span><select name="hotspotId">{hotspots.map((hotspot) => <option key={hotspot.id} value={hotspot.id}>{hotspot.name}</option>)}</select></label><label className="bike-app-field"><span>{t("rides.discipline")}</span><select name="discipline"><option>ROAD</option><option>GRAVEL</option><option>MTB</option></select></label><label className="bike-app-field"><span>{t("requests.preferredDate")}</span><input type="date" name="startDate" required defaultValue={item.windowStartDate} min={item.windowStartDate} max={item.windowEndDate} /></label><label className="bike-app-field"><span>{t("requests.preferredTime")}</span><input type="time" name="startTime" required defaultValue={item.preferredTime?.slice(0, 5) ?? "10:00"} /></label><label className="bike-app-field"><span>{t("history.duration")}</span><input type="number" name="durationMinutes" min="30" max="480" step="15" defaultValue="120" required /></label><label className="bike-app-field"><span>{t("rides.visibilityLabel")}</span><select name="visibility"><option value="public">{t("common.public")}</option><option value="private">{t("common.private")}</option></select></label></div><button className="bike-app-button">{t("requests.convert")}</button></form> : null}
            </article>
          );
        })}</div> : <AppEmpty>{t("common.empty")}</AppEmpty>}
      </AppPanel> : null}
    </>
  );
}
