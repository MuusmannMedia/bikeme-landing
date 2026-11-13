import {imageText} from "@/lib/clubs/image-i18n";
import {profileText} from "@/lib/clubs/profile-i18n";
import { AppEmpty, AppPageHeader, AppPanel } from "@/components/app-ui";
import { ClubMembershipPanel } from "./club-membership-panel";
import type { ClubWorkflow } from "@/lib/clubs/workflow";
import { ClubHeader, clubRoleLabel } from "./club-ui";
import { getAppDictionary } from "@/lib/app-i18n";
import type { ClubPageData } from "@/lib/clubs/types";
import type { Locale } from "@/lib/locales";

export function ClubPageContent({ data, locale, selected, userId, workflow }: { data: Exclude<ClubPageData, {view:"rides"}>; locale: Locale; selected: "details" | "members"; userId: string; workflow: ClubWorkflow }) {
  const t = getAppDictionary(locale);
  const base = `/${locale}/app/clubs`;
  if (data.view === "directory") {
    const { mine, catalog } = data;
    const myIds = new Set(mine.map(club => club.id));
    return <>
    <AppPageHeader eyebrow={t("shell.eyebrow")} title={t("nav.clubs")} intro={t("clubs.intro")} />
    <a className="bike-app-button" href={`${base}/new`}>{profileText(locale,"create")}</a>
    <ClubMembershipPanel membership={data.membership} clubs={mine} locale={locale} userId={userId} workflow={workflow} scope="incoming" />
    <AppPanel title={t("clubs.mine")} className="bike-app-section-gap">
      {mine.length === 0 ? <AppEmpty>{t("clubs.noClubs")}</AppEmpty> : (
        <div className="bike-app-grid" data-columns="2">
          {mine.map(club => <article className="bike-app-club-card" key={club.id}>
            <span className="bike-app-chip" data-tone="purple">{clubRoleLabel(locale, club.role)}</span>
            <h3><a href={`${base}/${club.id}`}>{club.name}</a></h3>
            <p className="bike-app-club-description">{club.description || t("clubs.noDescription")}</p>
            <div className="bike-app-club-card-footer">
              <span className="bike-app-muted">{(club.memberCount === 1 ? t("clubs.memberCountOne") : t("clubs.memberCount").replace("{count}", new Intl.NumberFormat(locale).format(club.memberCount)))}</span>
              <a className="bike-app-button bike-app-button-secondary bike-app-button-small" href={`${base}/${club.id}`}>{t("clubs.open")}<span className="sr-only">: {club.name}</span></a>
            </div>
          </article>)}
        </div>
      )}
    </AppPanel>
    <AppPanel title={t("clubs.catalog")} className="bike-app-section-gap">
      <p className="bike-app-muted bike-app-club-catalog-hint">{t("clubs.catalogHint")}</p>
      {catalog.length === 0 ? <AppEmpty>{t("clubs.noCatalog")}</AppEmpty> : (
        <ul className="bike-app-list">{catalog.map(club => <li className="bike-app-list-item" key={club.id}>
          <div className="bike-app-list-main"><strong>{club.name}</strong></div>
          {myIds.has(club.id)
            ? <a className="bike-app-button bike-app-button-secondary bike-app-button-small" href={`${base}/${club.id}`}>{t("clubs.open")}<span className="sr-only">: {club.name}</span></a>
            : <span className="bike-app-chip">{t("clubs.membersOnly")}</span>}
        </li>)}</ul>
      )}
    </AppPanel>
    </>;
  }
  const { club } = data;
  const path = `${base}/${club.id}`;
  const owner = club.members.find(member => member.user_id === club.owner_id);
  if (selected === "members") return <>
    <ClubHeader club={club} locale={locale} selected="members" />
    <ClubMembershipPanel membership={data.membership} club={club} locale={locale} userId={userId} workflow={workflow} scope="members" />
  </>;
  return <>
    <ClubHeader club={club} locale={locale} selected="details" />
    {data.profileEditing?<div className="bike-app-actions bike-app-section-gap"><a className="bike-app-button bike-app-button-secondary" href={`${path}/edit`}>{profileText(locale,"edit")}</a><a className="bike-app-button bike-app-button-secondary" href={`${path}/images`}>{imageText(locale,"title")}</a></div>:null}
    <div className="bike-app-grid" data-columns="2">
      <AppPanel title={t("clubs.description")}><p className="bike-app-club-description">{club.description || t("clubs.noDescription")}</p></AppPanel>
      <AppPanel title={t("clubs.details")}>
        <dl className="bike-app-definition">
          <div><dt>{t("clubs.owner")}</dt><dd>{owner?.display_name || "Bike Me"}</dd></div>
          <div><dt>{t("clubs.yourRole")}</dt><dd>{clubRoleLabel(locale, club.role)}</dd></div>
          <div><dt>{t("clubs.members")}</dt><dd>{new Intl.NumberFormat(locale).format(club.memberCount)}</dd></div>
        </dl>
        <a className="bike-app-button bike-app-button-secondary bike-app-section-gap" href={`${path}/members`}>{t("clubs.members")}</a>
      </AppPanel>
    </div>
    <ClubMembershipPanel membership={data.membership} club={club} locale={locale} userId={userId} workflow={workflow} scope="club" />
  </>;
}
