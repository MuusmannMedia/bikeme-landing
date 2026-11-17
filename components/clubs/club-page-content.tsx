"use client";
import Link from "next/link";
import {VisitCatalogCard} from './visits/catalog-card';
import {VisitCatalogProvider} from './visits/catalog-provider';
import {visitText} from "@/lib/clubs/visits/i18n";
import {useCatalogView} from './visits/catalog-batch-provider';
import {useContext,useEffect,useRef,useState} from "react";
import {clubCatalogPage} from '@/lib/clubs/catalog-page';
import {BatchCatalogContext} from './visits/catalog-batch-provider';
import {membershipDictionary} from "@/lib/clubs/membership-i18n";
import {ClubPrivateImages} from "./club-private-images";
import {imageText} from "@/lib/clubs/image-i18n";
import {profileText} from "@/lib/clubs/profile-i18n";
import { AppEmpty, AppPageHeader, AppPanel } from "@/components/app-ui";
import { ClubMembershipPanel } from "./club-membership-panel";
import type { ClubWorkflow } from "@/lib/clubs/workflow";
import { ClubHeader, clubRoleLabel } from "./club-ui";
import { getAppDictionary } from "@/lib/app-i18n";
import type { ClubPageData } from "@/lib/clubs/types";
import type { Locale } from "@/lib/locales";

type Props={ data: Exclude<ClubPageData, {view:"rides"}>; locale: Locale; selected: "details" | "members"; userId: string; workflow: ClubWorkflow; directory?: "mine" | "all" };
export function ClubPageContent(props:Props){return props.data.view==='directory'&&props.directory==='all'?<VisitCatalogProvider actor={props.userId}><ClubPageContentView {...props}/></VisitCatalogProvider>:<ClubPageContentView {...props}/>;}
function ClubPageContentView({ data, locale, selected, userId, workflow, directory = "mine" }: Props) {
  const batch=useContext(BatchCatalogContext);
  const [query,setQuery] = useState(()=>directory==='all'?batch?.view.query??'':'');
  const [page,setPage] = useState(()=>directory==='all'?batch?.view.page??0:0);
  const windowed=clubCatalogPage(data.view==='directory'?data.catalog:[],query,page);
  const catalog=useCatalogView(data.view==='directory'?Object.fromEntries(windowed.entries.filter(c=>Object.hasOwn(data.visits??{},c.id)).map(c=>[c.id,data.visits![c.id]])):{},data.view==='directory'&&directory==='all');
  const restore=useRef(false);
  useEffect(()=>{if(!catalog||directory!=='all'||data.view!=='directory')return;
   const desired=catalog.view.scroll;let restoring=true,leaving=false,stable=0,lastHeight=0,heightStable=0;
   const save=()=>{if(!restoring&&!leaving)catalog.view.scroll=window.scrollY;};
   const leave=(event:MouseEvent)=>{const a=(event.target as Element)?.closest('a');if(a&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0&&a.origin===location.origin&&a.pathname!==location.pathname){catalog.view.scroll=window.scrollY;leaving=true;}};
   window.addEventListener('scroll',save,{passive:true});document.addEventListener('click',leave,true);
   const timer=setInterval(()=>{
    if(restore.current)return;const height=document.documentElement.scrollHeight,ready=document.querySelectorAll('[data-visit-card="loading"]').length===0;
    heightStable=height===lastHeight?heightStable+1:0;lastHeight=height;
    if(height>=desired+window.innerHeight||ready&&heightStable>=4){
     const target=Math.min(desired,Math.max(0,height-window.innerHeight));window.scrollTo({left:0,top:target,behavior:'instant'});
     if(Math.abs(window.scrollY-target)<1)stable++;else stable=0;
     if(stable>=2){restore.current=true;restoring=false;catalog.view.scroll=window.scrollY;}
    }
   },50);
   return()=>{clearInterval(timer);document.removeEventListener('click',leave,true);window.removeEventListener('scroll',save);};
  },[catalog,directory,data.view]);
  function updateQuery(value:string){setQuery(value);setPage(0);if(catalog){catalog.view.query=value;catalog.view.page=0;catalog.view.scroll=0;}}
  function updatePage(value:number){setPage(value);if(catalog){catalog.view.page=value;catalog.view.scroll=0;}window.scrollTo({top:0,behavior:'instant'});}
  const t = getAppDictionary(locale);
  const base = `/${locale}/app/clubs`;
  if (data.view === "directory") {
    const { mine, catalog } = data;
    const memberClubs = new Map(mine.map(club => [club.id,club]));
    const matches = windowed.matches;
    return <>
      <AppPageHeader eyebrow={t("nav.clubs")} title={t(directory === "mine" ? "clubs.mine" : "clubs.all")} intro={directory === "all" ? t("clubs.catalogHint") : ""}
        action={directory === "mine" ? <Link prefetch={false} className="bike-app-button" href={`${base}/new`}>{profileText(locale,"create")}</Link> : undefined}/>
      {directory === "mine" ? <>
        <div className="bike-app-club-incoming"><ClubMembershipPanel compact membership={data.membership} clubs={mine} locale={locale} userId={userId} workflow={workflow} scope="incoming"/></div>
        {mine.length === 0 ? <AppEmpty>{t("clubs.noClubs")}</AppEmpty> : <div className="bike-app-club-cards">
          {mine.map(club => <article className="bike-app-club-card" key={club.id}>
            <div className="bike-app-club-card-media"><ClubPrivateImages clubId={club.id} locale={locale} shape={club.imageShape??"none"} revision={club.profileRevision}/></div>
            <div className="bike-app-club-card-copy"><span className="bike-app-chip" data-tone="purple">{clubRoleLabel(locale,club.role)}</span>
              <h2><Link prefetch={false} href={`${base}/${club.id}`}>{club.name}</Link></h2><p className="bike-app-club-card-description">{club.description||t("clubs.noDescription")}</p>
              <div className="bike-app-club-card-footer"><Link prefetch={false} className="bike-app-muted bike-app-club-member-link" href={`${base}/${club.id}/members`}><span className="sr-only">{club.name}: </span>{club.memberCount===1?t("clubs.memberCountOne"):t("clubs.memberCount").replace("{count}",new Intl.NumberFormat(locale).format(club.memberCount))}</Link><Link prefetch={false} className="bike-app-button bike-app-button-secondary bike-app-button-small" href={`${base}/${club.id}`}>{t("clubs.open")}<span className="sr-only">: {club.name}</span></Link></div>
            </div>
          </article>)}
        </div>}
      </> : <>
        <form role="search" className="bike-app-club-search bike-app-form" onSubmit={event=>event.preventDefault()}>
          <label className="bike-app-field" htmlFor="club-catalog-search"><span>{t("clubs.search")}</span><input id="club-catalog-search" type="search" autoComplete="off" value={query} placeholder={t("clubs.searchPlaceholder")} onChange={event=>updateQuery(event.target.value)}/></label>
        </form>
        <p className="bike-app-muted" role="status" aria-live="polite">{t("clubs.searchCount").replace("{count}",new Intl.NumberFormat(locale).format(matches.length))}</p>
        {catalog.length === 0 ? <AppEmpty>{t("clubs.noCatalog")}</AppEmpty> : matches.length===0?<AppEmpty>{t("clubs.searchEmpty")}</AppEmpty>:<div className="bike-app-club-cards">
          {windowed.entries.map(entry=>{const club=memberClubs.get(entry.id);if(!club&&Object.hasOwn(data.visits??{},entry.id))return <VisitCatalogCard key={entry.id} entry={entry} locale={locale}/>;return <article className="bike-app-club-card" key={entry.id}>
            <div className="bike-app-club-card-media">{club?<ClubPrivateImages clubId={club.id} locale={locale} shape={club.imageShape??"none"} revision={club.profileRevision}/>:<div className="bike-app-club-catalog-cover" aria-hidden="true"><span>{Array.from(entry.name)[0]}</span><svg viewBox="0 0 200 100" fill="none"><circle cx="45" cy="65" r="25"/><circle cx="155" cy="65" r="25"/><path d="M45 65 80 25 110 65H45L70 15M80 25h55l20 40M125 10h20"/></svg></div>}</div>
            <div className="bike-app-club-card-copy"><span className="bike-app-chip" data-tone={club?"purple":undefined}>{club?clubRoleLabel(locale,club.role):t("clubs.membersOnly")}</span>
              <h2><Link prefetch={false} href={`${base}/${entry.id}`}>{entry.name}</Link></h2>
              {club?<p className="bike-app-club-card-description">{club.description||t("clubs.noDescription")}</p>:null}
              {club?<div className="bike-app-club-card-footer"><Link prefetch={false} className="bike-app-muted bike-app-club-member-link" href={`${base}/${club.id}/members`}><span className="sr-only">{club.name}: </span>{club.memberCount===1?t("clubs.memberCountOne"):t("clubs.memberCount").replace("{count}",new Intl.NumberFormat(locale).format(club.memberCount))}</Link><Link prefetch={false} className="bike-app-button bike-app-button-secondary bike-app-button-small" href={`${base}/${club.id}`}>{t("clubs.open")}<span className="sr-only">: {club.name}</span></Link></div>:<div className="bike-app-club-card-footer"><Link prefetch={false} className="bike-app-button bike-app-button-secondary bike-app-button-small" href={`${base}/${entry.id}`}>{t("clubs.open")}<span className="sr-only">: {entry.name}</span></Link></div>}
            </div>
          </article>;})}
        </div>}
        {windowed.pages>1?<nav className="bike-app-actions" aria-label={t("clubs.pages")}><button className="bike-app-button bike-app-button-secondary" disabled={windowed.page===0} onClick={()=>updatePage(windowed.page-1)}>{t("clubs.previous")}</button><span>{windowed.page+1} / {windowed.pages}</span><button className="bike-app-button bike-app-button-secondary" disabled={windowed.page+1>=windowed.pages} onClick={()=>updatePage(windowed.page+1)}>{t("clubs.next")}</button></nav>:null}
      </>}
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
    {data.profileEditing&&club.role!=="member"?<AppPanel title={visitText(locale,"title")}><p>{visitText(locale,"snapshotHint")}</p><a className="bike-app-button" href={`${path}/visitors`}>{visitText(locale,"manage")}</a></AppPanel>:null}
    <div className="bike-app-grid" data-columns="2">
      <AppPanel title={t("clubs.description")} action={data.profileEditing?<a className="bike-app-button bike-app-button-secondary" href={`${path}/edit`}>{profileText(locale,"edit")}</a>:undefined}><p className="bike-app-club-description">{club.description || t("clubs.noDescription")}</p></AppPanel>
      <AppPanel title={t("clubs.details")} action={data.profileEditing?<a className="bike-app-button bike-app-button-secondary" href={`${path}/images`}>{imageText(locale,"title")}</a>:undefined}>
        <dl className="bike-app-definition">
          <div><dt>{t("clubs.owner")}</dt><dd>{owner?.display_name || "Bike Me"}</dd></div>
          <div><dt>{t("clubs.yourRole")}</dt><dd>{clubRoleLabel(locale, club.role)}</dd></div>
          <div><dt>{t("clubs.members")}</dt><dd>{new Intl.NumberFormat(locale).format(club.memberCount)}</dd></div>
        </dl>
        <a className="bike-app-button bike-app-button-secondary bike-app-section-gap" href={`${path}/members`}>{t("clubs.members")}</a>
      </AppPanel>
    </div>
    <details className="bike-app-club-administration"><summary>{membershipDictionary(locale)("management")}</summary><ClubMembershipPanel membership={data.membership} club={club} locale={locale} userId={userId} workflow={workflow} scope="club" /></details>
  </>;
}
