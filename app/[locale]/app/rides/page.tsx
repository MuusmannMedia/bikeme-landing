import Link from "next/link";
import { notFound } from "next/navigation";

import { AppEmpty, AppNotice, AppPageHeader, AppPanel } from "@/components/app-ui";
import { RideCard } from "@/components/ride-card";
import { listAuthorizedRides, listHotspots, loadViewer } from "@/lib/app-data";
import { getAppDictionary } from "@/lib/app-i18n";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

export default async function RidesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const viewer = await loadViewer(client);
  const [ridesResult, hotspotsResult] = await Promise.allSettled([
    listAuthorizedRides(client, viewer.userId),
    listHotspots(client)
  ]);
  const rides = ridesResult.status === "fulfilled" ? ridesResult.value : [];
  const hotspots = hotspotsResult.status === "fulfilled" ? hotspotsResult.value : [];
  const { notice } = await searchParams;
  return (
    <>
      <AppPageHeader eyebrow={t("shell.eyebrow")} title={t("rides.title")} intro={t("rides.intro")} />
      <AppNotice locale={locale} code={ridesResult.status === "rejected" || hotspotsResult.status === "rejected" ? "data" : notice} />
      <AppPanel title={t("rides.upcoming")}>
        {rides.length ? <div className="bike-app-grid" data-columns="3">{rides.map((ride) => <RideCard key={ride.id} ride={ride} locale={locale} units={viewer.profile.unitSystem} t={t} />)}</div> : <AppEmpty>{t("rides.noRides")}</AppEmpty>}
      </AppPanel>
      <AppPanel title={t("rides.hotspots")} className="bike-app-section-gap">
        {hotspots.length ? <div className="bike-app-grid" data-columns="3">{hotspots.map((hotspot) => (
          <article key={hotspot.id} className="bike-app-hotspot"><span className="bike-app-chip">{hotspot.region}</span><h3>{hotspot.name}</h3><p>{hotspot.description ?? hotspot.address}</p><Link href={`/${locale}/app/rides/new?hotspot=${hotspot.id}`}>{t("rides.create")}</Link></article>
        ))}</div> : <AppEmpty>{t("common.empty")}</AppEmpty>}
      </AppPanel>
    </>
  );
}
