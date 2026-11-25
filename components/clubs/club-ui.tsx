import { calendarText } from "@/lib/clubs/calendar-i18n";
import {ClubNavigation} from "./club-navigation";
import Link from "next/link";
import {ClubHeaderLogo} from "./club-private-images";
import { profileText } from "@/lib/clubs/profile-i18n";
import { galleryText } from "@/lib/clubs/gallery-i18n";
import { contentText } from "@/lib/clubs/content-i18n";
import { AppPageHeader, AppPanel } from "@/components/app-ui";
import { getAppDictionary } from "@/lib/app-i18n";
import type { Club, ClubReadErrorKind, ClubRole } from "@/lib/clubs/types";
import type { Locale } from "@/lib/locales";

export function clubRoleLabel(locale: Locale, role: ClubRole) {
  return getAppDictionary(locale)(`clubs.${role}`);
}

export function ClubReadFailure({ locale, kind, retryHref, onRetry }: { locale: Locale; kind: ClubReadErrorKind; retryHref: string; onRetry?: () => void }) {
  const t = getAppDictionary(locale);
  return (
    <div className="bike-app-club-error" role="status">
      <p>{t(kind === "unavailable" ? "clubs.unavailable" : kind === "access" ? "clubs.accessBody" : "clubs.loadError")}</p>
      {onRetry ? <button type="button" className="bike-app-button bike-app-button-secondary" onClick={onRetry}>{t("common.retry")}</button> : <a className="bike-app-button bike-app-button-secondary" href={retryHref}>{t("common.retry")}</a>}
    </div>
  );
}

export function ClubAccessDenied({ locale }: { locale: Locale }) {
  const t = getAppDictionary(locale);
  return <>
    <AppPageHeader eyebrow={t("nav.clubs")} title={t("clubs.accessTitle")} intro={t("clubs.accessBody")} />
    <AppPanel><div className="bike-app-actions"><a className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/clubs/mine`}>{t("clubs.back")}</a><a className="bike-app-button bike-app-button-secondary" href="">{t("common.retry")}</a></div></AppPanel>
  </>;
}

export function ClubHeader({ club, locale, selected }: { club: Club; locale: Locale; selected: "details" | "members" | "rides" | "posts" | "chat" | "gallery" }) {
  const t = getAppDictionary(locale);
  const base = `/${locale}/app/clubs/${club.id}`;
  const canEdit = club.canEditProfile && (club.role === "owner" || club.role === "admin");
  return <section className="bike-app-club-masthead">
    <AppPageHeader
      className="bike-app-club-header bike-app-club-header-compact"
      leading={<ClubHeaderLogo clubId={club.id} locale={locale} revision={club.profileRevision}/>}
      eyebrow={t("clubs.membersOnly")}
      title={club.name}
      intro={`${clubRoleLabel(locale, club.role)} · ${(club.memberCount === 1 ? t("clubs.memberCountOne") : t("clubs.memberCount").replace("{count}", new Intl.NumberFormat(locale).format(club.memberCount)))}`}
      action={<div className="bike-app-actions">
        {canEdit && <a className="bike-app-button" href={`${base}/edit`}>{profileText(locale, "editClub")}</a>}
        <Link prefetch={false} className="bike-app-button bike-app-button-secondary" href={`${base}/preview`}>{t("clubs.viewClub")}</Link>
        <a className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/clubs/mine`}>{t("clubs.back")}</a>
      </div>}
    />
    <Link prefetch={false} className="bike-app-club-about-link" href={base} aria-current={selected==="details"?"page":undefined}>
      {t("clubs.description")} <span aria-hidden="true">›</span>
    </Link>
    <ClubNavigation label={t("clubs.pages")} selected={selected} links={[
      {key:"rides",href:`${base}/rides`,label:calendarText(locale).title},
      {key:"posts",href:`${base}/posts`,label:contentText(locale,"title")},
      {key:"chat",href:`${base}/chat`,label:t("clubs.tabs.chat")},
      {key:"members",href:`${base}/members`,label:t("clubs.members")},
      {key:"gallery",href:`${base}/gallery`,label:galleryText(locale,"title")}
    ]}/>

  </section>;
}
