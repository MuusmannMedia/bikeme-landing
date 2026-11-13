import {ClubPrivateImages} from "./club-private-images";
import {chatText} from "@/lib/clubs/chat-i18n";
import { contentText } from "@/lib/clubs/content-i18n";
import { clubRideText } from "@/lib/clubs/ride-i18n";
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
    <AppPanel><div className="bike-app-actions"><a className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/clubs`}>{t("clubs.back")}</a><a className="bike-app-button bike-app-button-secondary" href="">{t("common.retry")}</a></div></AppPanel>
  </>;
}

export function ClubHeader({ club, locale, selected }: { club: Club; locale: Locale; selected: "details" | "members" | "rides" | "posts" | "chat" }) {
  const t = getAppDictionary(locale);
  const base = `/${locale}/app/clubs/${club.id}`;
  return <>
    <ClubPrivateImages clubId={club.id} locale={locale}/>
    <AppPageHeader
      className="bike-app-club-header"
      eyebrow={t("clubs.membersOnly")}
      title={club.name}
      intro={`${clubRoleLabel(locale, club.role)} · ${(club.memberCount === 1 ? t("clubs.memberCountOne") : t("clubs.memberCount").replace("{count}", new Intl.NumberFormat(locale).format(club.memberCount)))}`}
      action={<a className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/clubs`}>{t("clubs.back")}</a>}
    />
    <nav className="bike-app-club-nav" aria-label={t("clubs.details")}>
      <a href={base} aria-current={selected === "details" ? "page" : undefined}>{t("clubs.details")}</a>
      <a href={`${base}/members`} aria-current={selected === "members" ? "page" : undefined}>{t("clubs.members")}</a>
      <a href={`${base}/rides`} aria-current={selected === "rides" ? "page" : undefined}>{clubRideText(locale,"title")}</a>
      <a href={`${base}/posts`} aria-current={selected === "posts" ? "page" : undefined}>{contentText(locale,"title")}</a>
      <a href={`${base}/chat`} aria-current={selected === "chat" ? "page" : undefined}>{chatText(locale,"title")}</a>
    </nav>
  </>;
}
