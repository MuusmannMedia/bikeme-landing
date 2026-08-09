import { notFound } from "next/navigation";

import { AppEmpty, AppPageHeader, AppPanel } from "@/components/app-ui";
import { BrowserTimezoneInput, LocalDateTimeInput } from "@/components/local-date-time-input";
import { listHotspots } from "@/lib/app-data";
import { getAppDictionary } from "@/lib/app-i18n";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

import { createRideAction } from "../../actions";

export default async function NewRidePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ hotspot?: string }> }) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const hotspots = await listHotspots(client).catch(() => []);
  const selectedHotspot = (await searchParams).hotspot;
  return (
    <>
      <AppPageHeader eyebrow={t("rides.title")} title={t("rides.create")} intro={t("rides.createIntro")} />
      <AppPanel>
        {hotspots.length ? (
          <form action={createRideAction} className="bike-app-form">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="returnTo" value={`/${locale}/app/rides/new`} />
            <BrowserTimezoneInput />
            <div className="bike-app-form-grid">
              <label className="bike-app-field"><span>{t("rides.titleLabel")}</span><input name="title" required minLength={3} maxLength={120} /></label>
              <label className="bike-app-field"><span>{t("rides.hotspotLabel")}</span><select name="hotspotId" required defaultValue={selectedHotspot ?? hotspots[0]?.id}>{hotspots.map((hotspot) => <option key={hotspot.id} value={hotspot.id}>{hotspot.name} · {hotspot.region}</option>)}</select></label>
              <label className="bike-app-field"><span>{t("rides.startLabel")}</span><LocalDateTimeInput name="startTimeIso" /></label>
              <label className="bike-app-field"><span>{t("rides.typeLabel")}</span><select name="type" defaultValue="EVENT"><option value="EVENT">{t("rides.planned")}</option><option value="PING">{t("rides.rideNow")}</option></select></label>
              <label className="bike-app-field"><span>{t("rides.discipline")}</span><select name="discipline" defaultValue="ROAD"><option>ROAD</option><option>GRAVEL</option><option>MTB</option><option>CITY</option></select></label>
              <label className="bike-app-field"><span>{t("rides.visibilityLabel")}</span><select name="visibility" defaultValue="public"><option value="public">{t("common.public")}</option><option value="private">{t("common.private")}</option></select></label>
              <label className="bike-app-field"><span>{t("rides.distance")}</span><input name="distanceKm" type="number" min="0" max="500" step="0.1" /></label>
              <label className="bike-app-field"><span>{t("rides.pace")}</span><input name="paceText" maxLength={80} /></label>
              <label className="bike-app-field"><span>{t("history.duration")}</span><input name="durationMinutes" type="number" min="30" max="480" step="15" defaultValue="120" required /></label>
              <label className="bike-app-field"><span>{t("rides.maxParticipants")}</span><input name="maxParticipants" type="number" min="2" max="200" /></label>
            </div>
            <label className="bike-app-field"><span>{t("rides.descriptionLabel")}</span><textarea name="description" maxLength={1000} /></label>
            <div className="bike-app-actions"><button className="bike-app-button" type="submit">{t("rides.create")}</button></div>
          </form>
        ) : <AppEmpty>{t("common.unavailable")}</AppEmpty>}
      </AppPanel>
    </>
  );
}
