import { notFound } from "next/navigation";

import { AppAvatar } from "@/components/app-avatar";
import { AppNotice, AppPageHeader, AppPanel } from "@/components/app-ui";
import { loadViewer } from "@/lib/app-data";
import { getAppDictionary } from "@/lib/app-i18n";
import { getAuthDictionary } from "@/lib/auth-i18n";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

import { logoutAction, updateProfileAction, uploadAvatarAction } from "../actions";
import { LogoutForm } from "../logout-form";

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const t = getAppDictionary(locale);
  const client = await createClient();
  const viewer = await loadViewer(client);
  const { notice } = await searchParams;
  const displayName = viewer.profile.displayName ?? getAuthDictionary(locale).neutralUserNameFallback;
  const accessLabel = viewer.access.hasPro ? t("common.pro") : t("common.basic");
  return (
    <>
      <AppPageHeader eyebrow={t("shell.eyebrow")} title={t("profile.title")} intro={t("profile.intro")} />
      <AppNotice locale={locale} code={notice} />
      <div className="bike-app-grid" data-columns="2">
        <AppPanel title={t("profile.avatar")}>
          <div className="bike-app-profile-hero"><AppAvatar name={displayName} url={viewer.profile.avatarUrl} size="large" /><div><h2>{displayName}</h2><span className="bike-app-chip" data-tone="purple">{accessLabel}</span>{viewer.access.isFoundingRider ? <span className="bike-app-chip">{t("profile.founding")}</span> : null}</div></div>
          <form action={uploadAvatarAction} className="bike-app-form bike-app-section-gap" encType="multipart/form-data"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={`/${locale}/app/profile`} /><label className="bike-app-field"><span>{t("profile.avatarHint")}</span><input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button className="bike-app-button bike-app-button-secondary" type="submit">{t("common.save")}</button></form>
        </AppPanel>
        <AppPanel title={t("profile.membership")}>
          <div className="bike-app-membership"><strong>{accessLabel}</strong><p>{viewer.access.hasPro ? t("access.lockedBody") : t("access.noCheckout")}</p><p>{t("profile.languageHint")}</p><p>{t("profile.pushHint")}</p></div>
        </AppPanel>
      </div>
      <AppPanel title={t("nav.profile")} className="bike-app-section-gap">
        <form action={updateProfileAction} className="bike-app-form">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="returnTo" value={`/${locale}/app/profile`} />
          <div className="bike-app-form-grid">
            <label className="bike-app-field"><span>{t("profile.name")}</span><input name="displayName" required minLength={2} maxLength={80} defaultValue={displayName} /></label>
            <label className="bike-app-field"><span>{t("profile.region")}</span><input name="homeRegion" maxLength={120} defaultValue={viewer.profile.region ?? ""} /></label>
            <label className="bike-app-field"><span>{t("profile.level")}</span><input name="level" maxLength={80} defaultValue={viewer.profile.level ?? ""} /></label>
            <label className="bike-app-field"><span>{t("profile.bikes")}</span><input name="bikeTypes" maxLength={200} defaultValue={viewer.profile.bikeTypes.join(", ")} /></label>
            <label className="bike-app-field"><span>{t("profile.units")}</span><select name="unitSystem" defaultValue={viewer.profile.unitSystem}><option value="metric">{t("profile.metric")}</option><option value="imperial">{t("profile.imperial")}</option></select></label>
            <label className="bike-app-field"><span>{t("profile.height")}</span><input name="heightCm" type="number" min="80" max="250" step="0.1" defaultValue={viewer.profile.heightCm ?? ""} /></label>
            <label className="bike-app-field"><span>{t("profile.weight")}</span><input name="weightKg" type="number" min="30" max="300" step="0.1" defaultValue={viewer.profile.weightKg ?? ""} /></label>
            <label className="bike-app-field"><span>{t("profile.ftp")}</span><input name="ftp" type="number" min="50" max="700" step="1" defaultValue={viewer.profile.ftp ?? ""} /></label>
          </div>
          <label className="bike-app-field"><span>{t("profile.about")}</span><textarea name="about" maxLength={500} defaultValue={viewer.profile.about ?? ""} /></label>
          <label className="bike-app-checkbox"><input type="checkbox" name="hideStartEnd" defaultChecked={viewer.profile.hideStartEnd} />{t("profile.privacy")}</label>
          <button className="bike-app-button" type="submit">{t("common.save")}</button>
        </form>
      </AppPanel>
      <AppPanel className="bike-app-section-gap"><div className="bike-app-profile-logout"><LogoutForm action={logoutAction} locale={locale} translations={getAuthDictionary(locale)} /></div></AppPanel>
    </>
  );
}
