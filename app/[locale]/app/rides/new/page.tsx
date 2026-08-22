import { notFound } from "next/navigation";

import { AppEmpty, AppPageHeader, AppPanel } from "@/components/app-ui";
import { CreateRideForm } from "@/components/create-ride-form";
import { listHotspots, listInviteableRiders, loadViewer } from "@/lib/app-data";
import { getAppDictionary } from "@/lib/app-i18n";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

export default async function NewRidePage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ hotspot?: string; notice?: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const viewer = await loadViewer(client).catch(() => null);
  const [hotspots, inviteableResult] = await Promise.all([
    listHotspots(client).catch(() => []),
    viewer
      ? listInviteableRiders(client, viewer.userId)
        .then((value) => ({ value, failed: false }))
        .catch(() => ({ value: [], failed: true }))
      : Promise.resolve({ value: [], failed: true })
  ]);
  const query = await searchParams;
  const requestedHotspot = query.hotspot ? hotspots.find((hotspot) => hotspot.id === query.hotspot) : null;
  const initialHotspot = requestedHotspot ?? hotspots[0] ?? null;
  const returnTo = requestedHotspot
    ? `/${locale}/app/rides/new?hotspot=${encodeURIComponent(requestedHotspot.id)}`
    : `/${locale}/app/rides/new`;
  return (
    <>
      <AppPageHeader eyebrow={t("rides.title")} title={t("rides.create")} intro={t("rides.createIntro")} />
      <AppPanel>
        {viewer ? (
          <CreateRideForm
            createRequestId={crypto.randomUUID()}
            locale={locale}
            hotspots={hotspots.map(({ id, name, address, latitude, longitude, region }) => ({
              id,
              name,
              address,
              latitude,
              longitude,
              region
            }))}
            initialHotspotId={initialHotspot?.id}
            initialType={requestedHotspot ? "EVENT" : "PING"}
            initialDiscipline={
              requestedHotspot?.defaultDiscipline === "GRAVEL" || requestedHotspot?.defaultDiscipline === "MTB"
                ? requestedHotspot.defaultDiscipline
                : "ROAD"
            }
            initialDistanceKm={requestedHotspot?.defaultDistanceKm}
            inviteLoadFailed={inviteableResult.failed}
            inviteableRiders={inviteableResult.value.map((rider) => ({
              id: rider.id,
              displayName: rider.displayName,
              level: rider.level,
              region: rider.region
            }))}
            notice={query.notice}
            returnTo={returnTo}
            unitSystem={viewer.profile.unitSystem}
          />
        ) : <AppEmpty>{t("common.unavailable")}</AppEmpty>}
      </AppPanel>
    </>
  );
}
