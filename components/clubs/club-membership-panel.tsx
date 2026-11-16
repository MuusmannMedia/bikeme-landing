"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppAvatar } from "@/components/app-avatar";
import { AppEmpty, AppPanel } from "@/components/app-ui";
import { getAppDictionary } from "@/lib/app-i18n";
import { membershipDictionary, membershipErrorText, type MembershipTextKey } from "@/lib/clubs/membership-i18n";
import { allowedMemberActions, type ClubMembershipData } from "@/lib/clubs/membership-types";
import type { ClubWorkflow, CommandDraft } from "@/lib/clubs/workflow";
import type { Club } from "@/lib/clubs/types";
import type { Locale } from "@/lib/locales";
import { clubRoleLabel } from "./club-ui";

type Confirmation = { command: CommandDraft; label: string; trigger: HTMLElement | null };
function ConfirmationDialog({ value, locale, close, accept }: { value: Confirmation; locale: Locale; close: () => void; accept: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const t = membershipDictionary(locale);
  useEffect(() => {
    ref.current?.showModal(); cancel.current?.focus();
    return () => {
      if (value.trigger?.isConnected && !value.trigger.matches(":disabled")) value.trigger.focus();
      else { const heading=document.querySelector<HTMLElement>("main h1"); if(heading){heading.tabIndex=-1;heading.focus();} }
    };
  }, [value]);
  return <dialog ref={ref} className="bike-app-club-dialog" aria-labelledby="club-confirm-title" aria-describedby="club-confirm-body" onCancel={event => {event.preventDefault();close();}}>
    <h2 id="club-confirm-title">{t("confirmTitle")}</h2><p><strong>{value.label}</strong></p>
    <p id="club-confirm-body">{t("confirmBody")}</p>
    {(value.command.action === "proposeOwnership" || (value.command.action === "respondOwnership" && value.command.accept)) ? <p>{t("transferHint")}</p> : null}
    <div className="bike-app-actions"><button ref={cancel} type="button" className="bike-app-button bike-app-button-secondary" onClick={close}>{t("cancel")}</button><button type="button" className="bike-app-button" onClick={accept}>{t("confirm")}</button></div>
  </dialog>;
}

export function ClubMembershipPanel({ membership, club, clubs, userId, locale, workflow, scope, compact=false }: {
  membership: ClubMembershipData; club?: Club; clubs?: Club[]; userId: string; locale: Locale; workflow: ClubWorkflow; scope: "incoming" | "club" | "members"; compact?:boolean;
}) {
  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot, workflow.getSnapshot);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const t = membershipDictionary(locale), app = getAppDictionary(locale);
  const locked = state.busy || !!state.pending;
  const rank={owner:0,admin:1,member:2};
  const orderedMembers=club?[...club.members].sort((a,b)=>rank[a.role]-rank[b.role]||(a.display_name??"").localeCompare(b.display_name??"",locale)||a.user_id.localeCompare(b.user_id)):[];
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer=window.setInterval(() => setNow(Date.now()),1000); return () => window.clearInterval(timer); }, []);
  const expires = (value: string) => Date.parse(value) <= now;
  const deadline = (value: string) => <span className="bike-app-muted">{expires(value) ? t("expired") : t("expires")} · {new Intl.DateTimeFormat(locale, {dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}</span>;
  const ask = (command: CommandDraft, label: string) => setConfirmation({command,label,trigger:document.activeElement as HTMLElement});
  const action = (key: MembershipTextKey, command: CommandDraft, target = "", expired = false) => <button type="button" className="bike-app-button bike-app-button-secondary bike-app-button-small" disabled={locked || expired} aria-label={target ? `${t(key)}: ${target}` : undefined} onClick={() => ask(command, `${t(key)}${target ? ` · ${target}` : ""}`)}>{t(key)}</button>;
  const status = <div className="bike-app-club-feedback" aria-live="polite" aria-atomic="true">
    {state.busy ? <p role="status">{t("busy")}</p> : null}
    {state.error ? <p role="alert">{membershipErrorText(locale,state.error)}</p> : null}
    {state.pending && !state.busy ? <><p>{t("uncertain")}</p><button type="button" className="bike-app-button" onClick={() => void workflow.retry()}>{t("retry")}</button></> : null}
    {state.notice && !state.busy && !state.error ? <p role="status">{t("done")}</p> : null}
  </div>;
  const transferPerson = (clubId: string, personId: string) => (club ?? clubs?.find(c=>c.id===clubId))?.members.find(m=>m.user_id===personId)?.display_name || "Bike Me";
  const transfers = <AppPanel title={t("ownership")} className="bike-app-section-gap">
    <p className="bike-app-muted">{t("transferHint")}</p>
    {membership.transfers.length === 0 ? <AppEmpty>{t("noneTransfers")}</AppEmpty> : <ul className="bike-app-list">{membership.transfers.map(row => <li className="bike-app-list-item" key={row.id}>
      <div className="bike-app-list-main bike-app-club-copy"><strong>{row.club_name}</strong><span>{t("from")} {transferPerson(row.club_id,row.from_owner_id)}</span><span>{t("to")} {transferPerson(row.club_id,row.to_admin_id)}</span>{deadline(row.expires_at)}</div>
      <div className="bike-app-actions">{row.to_admin_id === userId ? <>{action("accept",{action:"respondOwnership",id:row.id,accept:true},row.club_name,expires(row.expires_at))}{action("decline",{action:"respondOwnership",id:row.id,accept:false},row.club_name,expires(row.expires_at))}</> : action("cancel",{action:"cancelOwnership",id:row.id},row.club_name)}</div>
    </li>)}</ul>}
    {club?.role === "owner" ? <div className="bike-app-section-gap">
      {club.members.filter(m=>m.role === "admin").length === 0 ? <p>{t("noAdmins")}</p> : <ul className="bike-app-list">{club.members.filter(m=>m.role === "admin").map(m=><li key={m.user_id} className="bike-app-list-item"><strong>{m.display_name || "Bike Me"}</strong>{action("transfer",{action:"proposeOwnership",clubId:club.id,targetId:m.user_id},m.display_name || "Bike Me",membership.transfers.some(row=>!expires(row.expires_at)))}</li>)}</ul>}
    </div> : null}
  </AppPanel>;
  return <>
    {(!compact||state.busy||state.error||state.pending||state.notice)?status:null}
    {scope === "incoming" ? <>
      {(!compact||membership.invitations.length>0)?<details className="bike-app-club-incoming-item" open={compact?undefined:true}><summary>{t("incoming")} · {membership.invitations.length}</summary><AppPanel>
        {membership.invitations.length === 0 ? <AppEmpty>{t("noneIncoming")}</AppEmpty> : <ul className="bike-app-list">{membership.invitations.map(row=><li className="bike-app-list-item" key={row.invite_id}>
          <div className="bike-app-list-main bike-app-club-copy"><strong>{row.club_name}</strong>{row.club_description ? <p className="bike-app-club-description">{row.club_description}</p> : null}{row.inviter_name ? <span>{row.inviter_name}</span> : null}{deadline(row.expires_at)}</div>
          <div className="bike-app-actions">{action("accept",{action:"respondInvite",id:row.invite_id,accept:true},row.club_name,expires(row.expires_at))}{action("decline",{action:"respondInvite",id:row.invite_id,accept:false},row.club_name,expires(row.expires_at))}</div>
        </li>)}</ul>}
      </AppPanel></details>:null}{!compact?transfers:membership.transfers.length?<details className="bike-app-club-incoming-item"><summary>{t("ownership")} · {membership.transfers.length}</summary>{transfers}</details>:null}
    </> : club ? <>
      {scope === "members" ? <AppPanel title={app("clubs.members")}><ul className="bike-app-list">{orderedMembers.map(member=><li key={member.user_id} className="bike-app-list-item">
        <div className="bike-app-list-main"><AppAvatar name={member.display_name} url={member.avatar_url}/><strong>{member.display_name || "Bike Me"}</strong><span className="bike-app-chip">{clubRoleLabel(locale,member.role)}</span></div>
        <div className="bike-app-actions">{allowedMemberActions(club,userId,member).map(kind=><span key={kind}>{action(kind,{action:"memberAction",clubId:club.id,targetId:member.user_id,decision:kind},member.display_name || "Bike Me")}</span>)}</div>
      </li>)}</ul></AppPanel> : null}
      <AppPanel title={t("management")} className="bike-app-section-gap">
        {club.role === "member" ? <p>{t("suggestHint")}</p> : null}
        <form className="bike-app-club-search" onSubmit={event=>{event.preventDefault();void workflow.search();}}>
          <label htmlFor="club-rider-query">{t("query")}</label><div className="bike-app-actions"><input id="club-rider-query" type="search" value={state.query} maxLength={200} disabled={locked} onChange={event=>workflow.setQuery(event.target.value)} aria-describedby="club-search-status"/><button type="submit" className="bike-app-button" disabled={locked || state.searching || Array.from(state.query.trim()).length<3}>{state.searching?t("searching"):t("search")}</button></div>
        </form>
        <div id="club-search-status" aria-live="polite">{state.searchError ? <p role="alert">{membershipErrorText(locale,state.searchError)}</p> : state.searched && state.people.length===0 ? <AppEmpty>{t("noPeople")}</AppEmpty> : null}</div>
        {state.people.length>0 ? <ul className="bike-app-list">{state.people.map(person=><li key={person.id} className="bike-app-list-item"><div className="bike-app-list-main"><AppAvatar name={person.display_name} url={person.avatar_url}/><strong>{person.display_name||"Bike Me"}</strong></div>
          {person.is_member || person.has_invitation || person.has_proposal ? <span className="bike-app-chip">{t(person.is_member?"alreadyMember":person.has_invitation?"invited":"suggested")}</span> : action(club.role === "member"?"suggest":"invite",{action:club.role === "member"?"proposeMember":"invite",clubId:club.id,targetId:person.id},person.display_name||"Bike Me")}
        </li>)}</ul> : null}
      </AppPanel>
      {club.role !== "member" ? <AppPanel title={t("pending")} className="bike-app-section-gap">{membership.pending.length===0?<AppEmpty>{t("nonePending")}</AppEmpty>:<ul className="bike-app-list">{membership.pending.map(row=><li key={row.invite_id} className="bike-app-list-item"><div className="bike-app-list-main bike-app-club-copy"><strong>{row.invitee_name||"Bike Me"}</strong>{deadline(row.expires_at)}</div>{action("cancel",{action:"cancelInvite",id:row.invite_id},row.invitee_name||"Bike Me")}</li>)}</ul>}</AppPanel> : null}
      <AppPanel title={t("proposals")} className="bike-app-section-gap">{membership.proposals.length===0?<AppEmpty>{t("noneProposals")}</AppEmpty>:<ul className="bike-app-list">{membership.proposals.map(row=><li key={row.id} className="bike-app-list-item"><div className="bike-app-list-main bike-app-club-copy"><strong>{row.invitee_name||"Bike Me"}</strong><span>{t("proposedBy")} {row.proposer_name||"Bike Me"}</span>{deadline(row.expires_at)}</div><div className="bike-app-actions">{club.role !== "member" ? <>{action("approve",{action:"resolveProposal",clubId:club.id,id:row.id,decision:"approve"},row.invitee_name||"Bike Me",expires(row.expires_at))}{action("decline",{action:"resolveProposal",clubId:club.id,id:row.id,decision:"reject"},row.invitee_name||"Bike Me",expires(row.expires_at))}</> : null}{row.proposer_id===userId? action("cancel",{action:"resolveProposal",clubId:club.id,id:row.id,decision:"cancel"},row.invitee_name||"Bike Me",expires(row.expires_at)):null}</div></li>)}</ul>}</AppPanel>
      {transfers}
      <AppPanel title={t("leave")} className="bike-app-section-gap">{club.role === "owner" ? <p>{t("ownerCannotLeave")}</p> : action("leave",{action:"leave",clubId:club.id},club.name)}</AppPanel>
    </> : null}
    {confirmation ? <ConfirmationDialog value={confirmation} locale={locale} close={()=>setConfirmation(null)} accept={()=>{const command=confirmation.command;setConfirmation(null);void workflow.run(command).then(done => {
      if (!done && !workflow.getSnapshot().error) return;
      window.requestAnimationFrame(() => {
        const target=document.querySelector<HTMLElement>('[data-club-access="ready"] [role="alert"], [data-club-access="ready"] h1');
        if(target){target.tabIndex=-1;target.focus();}
      });
    });}}/> : null}
  </>;
}
