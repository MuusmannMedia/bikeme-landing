import Link from "next/link";
import { notFound } from "next/navigation";

import { AppAvatar } from "@/components/app-avatar";
import { AppEmpty, AppNotice, AppPageHeader, AppPanel } from "@/components/app-ui";
import { listHotspots, listRideInterest, listRideInvites, loadViewer } from "@/lib/app-data";
import { formatDate, formatDateTime } from "@/lib/app-format";
import { getAppDictionary } from "@/lib/app-i18n";
import type { RideInterest, RideInvite } from "@/lib/app-model";
import { isCurrentRideInterest, isCurrentRideInvite } from "@/lib/ride-requests";
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
  const view = query.view === "interest" ? "interest" : "invites";
  const currentInvites = invites.filter(isCurrentRideInvite);
  const previousInvites = invites.filter((invite) => !isCurrentRideInvite(invite));
  const currentInterests = interests.filter(isCurrentRideInterest);
  const previousInterests = interests.filter((item) => !isCurrentRideInterest(item));
  const notice = query.notice;
  const invitesHref = `/${locale}/app/requests?view=invites`;
  const interestHref = `/${locale}/app/requests?view=interest`;
  const statusText = (item: RideInterest) => {
    if (item.expired && (item.responseStatus === "pending" || item.responseStatus === "interested" || item.responseStatus === "maybe")) {
      return t("requests.expired");
    }
    const keys = {
      pending: "common.pending",
      interested: "requests.interested",
      maybe: "requests.maybe",
      declined: "requests.declined",
      cancelled: "requests.cancelled",
      converted: "message.created"
    } as const;
    return t(keys[item.responseStatus]);
  };
  const loadFailed = invitesResult.status === "rejected" || interestResult.status === "rejected" || hotspotsResult.status === "rejected";
  const inviteStatus = (invite: RideInvite) => {
    if (invite.acceptedAt) return t("requests.inviteAccepted");
    if (invite.declinedAt) return t("requests.declined");
    const keys = {
      cancelled: "requests.rideCancelled",
      completed: "requests.rideCompleted",
      expired: "requests.expired",
      unavailable: "common.unavailable"
    } as const;
    return t(invite.rideUnavailable ? keys[invite.rideUnavailable] : "common.pending");
  };

  const renderInvites = (items: RideInvite[]) => (
    <ul className="bike-app-list">
      {items.map((invite) => (
        <li key={`${invite.rideId}-${invite.inviteeId}`} className="bike-app-list-item bike-app-request-invite">
          <div className="bike-app-list-main">
            <AppAvatar name={invite.counterpart?.displayName ?? null} url={invite.counterpart?.avatarUrl} />
            <div>
              <strong>{invite.rideTitle ?? t("rides.details")}</strong>
              <small>
                {t(invite.direction === "received" ? "common.received" : "common.sent")}
                {invite.rideStartTime ? ` · ${formatDateTime(locale, invite.rideStartTime)}` : ""} · {invite.counterpart?.displayName ?? "Bike Me"}
              </small>
            </div>
          </div>
          <div className="bike-app-actions">
            <Link className="bike-app-button bike-app-button-secondary bike-app-button-small" href={`/${locale}/app/rides/${invite.rideId}`}>
              {t("common.view")}
            </Link>
            {invite.direction === "received" && isCurrentRideInvite(invite) ? (
              <>
                <form action={acceptRideInviteAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="returnTo" value={invitesHref} />
                  <input type="hidden" name="rideId" value={invite.rideId} />
                  <button className="bike-app-button bike-app-button-small">{t("common.accept")}</button>
                </form>
                <form action={declineRideInviteAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="returnTo" value={invitesHref} />
                  <input type="hidden" name="rideId" value={invite.rideId} />
                  <button className="bike-app-button bike-app-button-secondary bike-app-button-small">{t("common.decline")}</button>
                </form>
              </>
            ) : <span className="bike-app-chip">{inviteStatus(invite)}</span>}
          </div>
        </li>
      ))}
    </ul>
  );

  const renderInterest = (item: RideInterest) => {
    const current = isCurrentRideInterest(item);
    const canRespond = current && item.direction === "received" && item.responseStatus === "pending";
    const canCancel = current && item.direction === "sent" && item.responseStatus === "pending";
    const canConvert = current && item.direction === "sent" && item.responseStatus !== "pending";
    const canDismiss = !canRespond && !canCancel && !canConvert && item.responseStatus !== "converted";
    return (
      <article key={item.id} className="bike-app-panel bike-app-request-card">
        <header>
          <div className="bike-app-list-main">
            <AppAvatar name={item.counterpart?.displayName ?? null} url={item.counterpart?.avatarUrl} />
            <div>
              <h3>{item.counterpart?.displayName ?? "Bike Me"}</h3>
              <p>{t(item.direction === "received" ? "common.received" : "common.sent")}</p>
            </div>
          </div>
          <span className="bike-app-chip" data-tone="purple">{statusText(item)}</span>
        </header>
        <dl className="bike-app-definition">
          <div>
            <dt>{t("requests.preferredDate")}</dt>
            <dd>
              {formatDate(locale, item.windowStartDate)}
              {item.windowEndDate !== item.windowStartDate ? ` – ${formatDate(locale, item.windowEndDate)}` : ""}
            </dd>
          </div>
          <div>
            <dt>{t("requests.preferredTime")}</dt>
            <dd>{item.preferredTime?.slice(0, 5) ?? "—"}</dd>
          </div>
        </dl>
        {canRespond ? (
          <div className="bike-app-actions">
            {([["interested", "requests.interested"], ["maybe", "requests.maybe"], ["declined", "common.decline"]] as const).map(([response, label]) => (
              <form key={response} action={respondRideInterestAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="returnTo" value={interestHref} />
                <input type="hidden" name="requestId" value={item.id} />
                <input type="hidden" name="responseStatus" value={response} />
                <button className={`bike-app-button bike-app-button-small ${response === "declined" ? "bike-app-button-secondary" : ""}`}>
                  {t(label)}
                </button>
              </form>
            ))}
          </div>
        ) : null}
        {canCancel || canDismiss ? (
          <form action={canCancel ? cancelRideInterestAction : dismissRideInterestAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="returnTo" value={interestHref} />
            <input type="hidden" name="requestId" value={item.id} />
            <button className="bike-app-button bike-app-button-secondary bike-app-button-small">
              {t(canCancel ? "common.cancel" : "common.remove")}
            </button>
          </form>
        ) : null}
        {item.createdRideId ? (
          <Link className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/rides/${item.createdRideId}`}>
            {t("common.view")}
          </Link>
        ) : null}
        {canConvert && hotspots.length ? (
          <form action={convertRideInterestAction} className="bike-app-form bike-app-convert-form">
            <h3>{t("requests.convert")}</h3>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="returnTo" value={interestHref} />
            <input type="hidden" name="requestId" value={item.id} />
            <label className="bike-app-field">
              <span>{t("rides.titleLabel")}</span>
              <input name="title" required minLength={3} maxLength={120} />
            </label>
            <div className="bike-app-form-grid">
              <label className="bike-app-field">
                <span>{t("rides.hotspotLabel")}</span>
                <select name="hotspotId">
                  {hotspots.map((hotspot) => <option key={hotspot.id} value={hotspot.id}>{hotspot.name}</option>)}
                </select>
              </label>
              <label className="bike-app-field">
                <span>{t("rides.discipline")}</span>
                <select name="discipline"><option>ROAD</option><option>GRAVEL</option><option>MTB</option></select>
              </label>
              <label className="bike-app-field">
                <span>{t("requests.preferredDate")}</span>
                <input type="date" name="startDate" required defaultValue={item.windowStartDate} min={item.windowStartDate} max={item.windowEndDate} />
              </label>
              <label className="bike-app-field">
                <span>{t("requests.preferredTime")}</span>
                <input type="time" name="startTime" required defaultValue={item.preferredTime?.slice(0, 5) ?? "10:00"} />
              </label>
              <label className="bike-app-field">
                <span>{t("history.duration")}</span>
                <input type="number" name="durationMinutes" min="30" max="480" step="15" defaultValue="120" required />
              </label>
              <label className="bike-app-field">
                <span>{t("rides.visibilityLabel")}</span>
                <select name="visibility">
                  <option value="public">{t("common.public")}</option>
                  <option value="private">{t("common.private")}</option>
                </select>
              </label>
            </div>
            <button className="bike-app-button">{t("requests.convert")}</button>
          </form>
        ) : null}
      </article>
    );
  };

  return (
    <>
      <AppPageHeader eyebrow={t("shell.eyebrow")} title={t("requests.title")} intro={t("requests.intro")} />
      <AppNotice locale={locale} code={loadFailed ? "data" : notice} />
      <nav className="bike-app-requests-nav" aria-label={t("requests.title")}>
        <Link href={invitesHref} prefetch={false} aria-current={view === "invites" ? "page" : undefined}>{t("requests.invites")}</Link>
        <Link href={interestHref} prefetch={false} aria-current={view === "interest" ? "page" : undefined}>{t("requests.interest")}</Link>
      </nav>
      <div className="bike-app-requests-grid" data-view={view}>
        <AppPanel title={t("requests.invites")} className="bike-app-requests-panel bike-app-requests-invites">
          {currentInvites.length ? renderInvites(currentInvites) : <AppEmpty>{t("requests.noCurrentInvites")}</AppEmpty>}
          {previousInvites.length ? (
            <details className="bike-app-requests-history">
              <summary>{t("requests.previous")}</summary>
              {renderInvites(previousInvites)}
            </details>
          ) : null}
        </AppPanel>
        <AppPanel title={t("requests.interest")} className="bike-app-requests-panel bike-app-requests-interest">
          {currentInterests.length ? <div className="bike-app-requests-cards">{currentInterests.map(renderInterest)}</div> : <AppEmpty>{t("requests.noCurrentInterest")}</AppEmpty>}
          {previousInterests.length ? (
            <details className="bike-app-requests-history">
              <summary>{t("requests.previous")}</summary>
              <div className="bike-app-requests-cards">{previousInterests.map(renderInterest)}</div>
            </details>
          ) : null}
        </AppPanel>
      </div>
    </>
  );
}
