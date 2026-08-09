import { notFound } from "next/navigation";

import { AppPageHeader, AppPanel } from "@/components/app-ui";
import { LocalDateTimeInput } from "@/components/local-date-time-input";
import { loadRideDetail, loadViewer } from "@/lib/app-data";
import { getAppDictionary } from "@/lib/app-i18n";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

import { updateRideAction } from "../../../actions";

export default async function EditRidePage({ params }: { params: Promise<{ locale: string; rideId: string }> }) {
  const { locale: localeParam, rideId } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const viewer = await loadViewer(client);
  const ride = await loadRideDetail(client, viewer.userId, rideId).catch(() => null);
  if (!ride || ride.hostId !== viewer.userId) notFound();
  const durationMinutes = ride.expiresAt ? Math.round((Date.parse(ride.expiresAt) - Date.parse(ride.startTime)) / 60_000) : 120;
  const returnTo = `/${locale}/app/rides/${ride.id}`;
  return (
    <>
      <AppPageHeader eyebrow={t("rides.details")} title={t("common.edit")} intro={ride.title} />
      <AppPanel>
        <form action={updateRideAction} className="bike-app-form">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="rideId" value={ride.id} />
          <div className="bike-app-form-grid">
            <label className="bike-app-field"><span>{t("rides.titleLabel")}</span><input name="title" required minLength={3} maxLength={120} defaultValue={ride.title} /></label>
            <label className="bike-app-field"><span>{t("rides.startLabel")}</span><LocalDateTimeInput name="startTimeIso" defaultValue={ride.startTime} /></label>
            <label className="bike-app-field"><span>{t("rides.discipline")}</span><select name="discipline" defaultValue={ride.discipline}><option>ROAD</option><option>GRAVEL</option><option>MTB</option><option>CITY</option></select></label>
            <label className="bike-app-field"><span>{t("rides.visibilityLabel")}</span><select name="visibility" defaultValue={ride.visibility}><option value="public">{t("common.public")}</option><option value="private">{t("common.private")}</option></select></label>
            <label className="bike-app-field"><span>{t("rides.distance")}</span><input name="distanceKm" type="number" min="0" max="500" step="0.1" defaultValue={ride.distanceKm ?? ""} /></label>
            <label className="bike-app-field"><span>{t("rides.pace")}</span><input name="paceText" maxLength={80} defaultValue={ride.pace ?? ""} /></label>
            <label className="bike-app-field"><span>{t("history.duration")}</span><input name="durationMinutes" type="number" min="30" max="480" step="15" defaultValue={Math.max(30, Math.min(480, durationMinutes))} required /></label>
            <label className="bike-app-field"><span>{t("rides.maxParticipants")}</span><input name="maxParticipants" type="number" min="2" max="200" defaultValue={ride.maxParticipants ?? ""} /></label>
          </div>
          <label className="bike-app-field"><span>{t("rides.descriptionLabel")}</span><textarea name="description" maxLength={1000} defaultValue={ride.description ?? ""} /></label>
          <button className="bike-app-button" type="submit">{t("common.save")}</button>
        </form>
      </AppPanel>
    </>
  );
}
