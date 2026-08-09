import { notFound } from "next/navigation";

import { AppAvatar } from "@/components/app-avatar";
import { AppEmpty, AppNotice, AppPageHeader, AppPanel } from "@/components/app-ui";
import { BrowserTimezoneInput } from "@/components/local-date-time-input";
import { listConnections, loadViewer, searchRiders } from "@/lib/app-data";
import { getAppDictionary } from "@/lib/app-i18n";
import { selectAcceptedConnections } from "@/lib/app-overview";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

import {
  cancelConnectionAction,
  removeConnectionAction,
  respondConnectionAction,
  sendConnectionAction,
  sendRideInterestAction
} from "../actions";

function RiderDetails({ level, region, about, labels }: { level: string | null; region: string | null; about: string | null; labels: { level: string; region: string; about: string } }) {
  return (
    <dl className="bike-app-definition bike-app-rider-details">
      <div><dt>{labels.level}</dt><dd>{level ?? "—"}</dd></div>
      <div><dt>{labels.region}</dt><dd>{region ?? "—"}</dd></div>
      {about ? <div><dt>{labels.about}</dt><dd>{about}</dd></div> : null}
    </dl>
  );
}

export default async function RidersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; notice?: string; view?: string }> }) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const viewer = await loadViewer(client);
  const queryParams = await searchParams;
  const connectedOnly = queryParams.view === "connected";
  const query = connectedOnly ? "" : queryParams.q?.trim().slice(0, 80) ?? "";
  const connectionsResult = await listConnections(client, viewer.userId).then((value) => ({ value, failed: false })).catch(() => ({ value: [], failed: true }));
  const searchResult = query.length >= 2
    ? await searchRiders(client, viewer.userId, query).then((value) => ({ value, failed: false })).catch(() => ({ value: [], failed: true }))
    : { value: [], failed: false };
  const connections = connectionsResult.value;
  const accepted = selectAcceptedConnections(connections);
  const incoming = connections.filter((connection) => connection.state === "pending_incoming");
  const outgoing = connections.filter((connection) => connection.state === "pending_outgoing");
  const connectionByRider = new Map(connections.map((connection) => [connection.counterpart.id, connection]));
  const notice = queryParams.notice;
  const returnTo = connectedOnly
    ? `/${locale}/app/riders?view=connected`
    : `/${locale}/app/riders${query ? `?q=${encodeURIComponent(query)}` : ""}`;
  const labels = { level: t("riders.level"), region: t("riders.region"), about: t("riders.about") };
  return (
    <>
      <AppPageHeader eyebrow={t("shell.eyebrow")} title={t("riders.title")} intro={t("riders.intro")} />
      <AppNotice locale={locale} code={connectionsResult.failed ? "data" : searchResult.failed ? "search" : notice} />
      {!connectedOnly ? <AppPanel title={t("riders.search")}>
        <form className="bike-app-search" method="get">
          <label className="bike-app-field"><span>{t("riders.searchPlaceholder")}</span><input type="search" name="q" defaultValue={query} minLength={2} maxLength={80} placeholder={t("riders.searchPlaceholder")} /></label>
          <button className="bike-app-button" type="submit">{t("riders.search")}</button>
        </form>
        {query.length > 0 && query.length < 2 ? <p className="bike-app-muted">{t("riders.searchHint")}</p> : null}
        {query.length >= 2 ? (
          <div className="bike-app-grid bike-app-section-gap" data-columns="3">
            {searchResult.value.map((rider) => {
              const connection = connectionByRider.get(rider.id);
              return (
                <article className="bike-app-panel bike-app-rider-card" key={rider.id}>
                  <div className="bike-app-list-main"><AppAvatar name={rider.displayName} url={rider.avatarUrl} size="large" /><div><h2>{rider.displayName ?? "Bike Me"}</h2><p>{rider.region ?? "—"}</p></div></div>
                  <RiderDetails level={rider.level} region={rider.region} about={rider.about} labels={labels} />
                  {!connection ? <form action={sendConnectionAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="recipientUserId" value={rider.id} /><button className="bike-app-button" type="submit">{t("riders.connect")}</button></form> : <span className="bike-app-chip" data-tone="purple">{connection.state === "accepted" ? t("riders.connected") : t("common.pending")}</span>}
                </article>
              );
            })}
          </div>
        ) : null}
        {query.length >= 2 && searchResult.value.length === 0 && !searchResult.failed ? <AppEmpty>{t("common.empty")}</AppEmpty> : null}
      </AppPanel> : null}

      {!connectedOnly && (incoming.length > 0 || outgoing.length > 0) ? <div className="bike-app-grid bike-app-section-gap" data-columns="2">
        <AppPanel title={t("riders.incoming")}>
          {incoming.length ? <ul className="bike-app-list">{incoming.map((connection) => <li key={connection.id} className="bike-app-list-item"><div className="bike-app-list-main"><AppAvatar name={connection.counterpart.displayName} url={connection.counterpart.avatarUrl} /><div><strong>{connection.counterpart.displayName ?? "Bike Me"}</strong><small>{connection.counterpart.region}</small></div></div><div className="bike-app-actions"><form action={respondConnectionAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="connectionId" value={connection.id} /><input type="hidden" name="responseStatus" value="accepted" /><button className="bike-app-button bike-app-button-small">{t("common.accept")}</button></form><form action={respondConnectionAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="connectionId" value={connection.id} /><input type="hidden" name="responseStatus" value="declined" /><button className="bike-app-button bike-app-button-secondary bike-app-button-small">{t("common.decline")}</button></form></div></li>)}</ul> : <AppEmpty>{t("common.empty")}</AppEmpty>}
        </AppPanel>
        <AppPanel title={t("riders.outgoing")}>
          {outgoing.length ? <ul className="bike-app-list">{outgoing.map((connection) => <li key={connection.id} className="bike-app-list-item"><div className="bike-app-list-main"><AppAvatar name={connection.counterpart.displayName} url={connection.counterpart.avatarUrl} /><div><strong>{connection.counterpart.displayName ?? "Bike Me"}</strong><small>{t("common.pending")}</small></div></div><form action={cancelConnectionAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="connectionId" value={connection.id} /><button className="bike-app-button bike-app-button-secondary bike-app-button-small">{t("riders.cancelRequest")}</button></form></li>)}</ul> : <AppEmpty>{t("common.empty")}</AppEmpty>}
        </AppPanel>
      </div> : null}

      <AppPanel title={t("riders.connected")} className="bike-app-section-gap">
        {accepted.length ? <div className="bike-app-grid" data-columns="2">{accepted.map((connection) => (
          <article className="bike-app-rider-connection" key={connection.id}>
            <div className="bike-app-list-main"><AppAvatar name={connection.counterpart.displayName} url={connection.counterpart.avatarUrl} size="large" /><div><h3>{connection.counterpart.displayName ?? "Bike Me"}</h3><p>{connection.counterpart.region ?? "—"}</p></div></div>
            <RiderDetails level={connection.counterpart.level} region={connection.counterpart.region} about={connection.counterpart.about} labels={labels} />
            <form action={sendRideInterestAction} className="bike-app-interest-form">
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="recipientUserId" value={connection.counterpart.id} /><BrowserTimezoneInput />
              <label className="bike-app-field"><span>{t("requests.preferredDate")}</span><select name="timeOption" defaultValue="tomorrow"><option value="today">{t("requests.today")}</option><option value="tomorrow">{t("requests.tomorrow")}</option><option value="this_weekend">{t("requests.weekend")}</option><option value="custom_date">{t("requests.custom")}</option></select></label>
              <label className="bike-app-field"><span>{t("requests.custom")}</span><input name="customDate" type="date" /></label>
              <label className="bike-app-field"><span>{t("requests.preferredTime")}</span><input name="preferredTime" type="time" /></label>
              <button className="bike-app-button" type="submit">{t("requests.sendTo")}</button>
            </form>
            <form action={removeConnectionAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="connectionId" value={connection.id} /><button className="bike-app-button bike-app-button-danger bike-app-button-small" type="submit">{t("common.remove")}</button></form>
          </article>
        ))}</div> : <AppEmpty>{t("common.empty")}</AppEmpty>}
      </AppPanel>
    </>
  );
}
