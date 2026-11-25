"use client";
import { useEffect, useRef, useState } from "react";
import { AppPanel } from "../app-ui";
import { ClubCalendar } from "./club-calendar";
import { RideDetailContent } from "../ride-detail-content";
import { ClubHeader } from "./club-ui";
import type { Club } from "@/lib/clubs/types";
import type { ClubRideData } from "@/lib/clubs/ride-api";
import type { Locale } from "@/lib/locales";
import { getAppDictionary } from "@/lib/app-i18n";
import { clubRideAvailable, clubRideHref, type RideInviteResult } from "@/lib/clubs/ride-contract";
import { clubRideText } from "@/lib/clubs/ride-i18n";
export type ClubRideIntent={actorId:string;clubId:string;rideId:string;action:string;ids?:string[];accept?:boolean};
export type ClubRideActionState={busy:boolean;intent:ClubRideIntent|null;message:string|null;results:RideInviteResult[]};
export function ClubRides({club,data,locale,userId,creation,created,operation,act,onAccessLost,calendarDay}: {club:Club;data:ClubRideData;locale:Locale;userId:string;creation:boolean;created?:string;operation:ClubRideActionState;act:(input:ClubRideIntent)=>Promise<void>;onAccessLost:(auth:boolean)=>void;calendarDay?:string}) {
  const t=getAppDictionary(locale), text=(key:Parameters<typeof clubRideText>[1])=>clubRideText(locale,key);
  const ride=data.selected,base=clubRideHref(locale,club.id);
  const [selection,setSelection]=useState<string[]>([]), [clock,setClock]=useState(()=>Date.now());
  const dialog=useRef<HTMLDialogElement>(null), trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const send=(action:string,extra:Partial<ClubRideIntent>={})=>ride?act({actorId:userId,clubId:club.id,rideId:ride.id,action,...extra}):Promise.resolve();
  const available=ride?clubRideAvailable(ride,clock):false;
  const status=ride?ride.status==="CANCELLED"?"cancelled":ride.status==="COMPLETED"?"completed":available?"active":"past":"active";
  const ownInvite=ride?.invites.find(i=>i.inviteeId===userId);
  const blocked=operation.busy||!!operation.intent;
  return <>
    <ClubHeader club={club} locale={locale} selected="rides"/>
    {created === "created" || created === "routeFailed" ? <p role="status">{text(created)}</p> : null}
    {creation?null:<>
    {operation.message ? <AppPanel><p role="status">{text(operation.message === "savedPush" ? "saved" : operation.message === "partialPushFailed" ? "partial" : operation.message as Parameters<typeof clubRideText>[1])}</p>{operation.message==="partialPushFailed"?<p>{text("pushFailed")}</p>:null}{operation.message==="saved"?<p className="bike-app-muted">{text("pushOff")}</p>:null}{operation.results.length?<ul>{operation.results.map(r=><li key={r.user_id}>{club.members.find(m=>m.user_id===r.user_id)?.display_name??"Bike Me"}: {text(r.status==="created"||r.status==="pending"?"waiting":r.status==="not_member"?"notMember":r.status)}</li>)}</ul>:null}{operation.intent?<button className="bike-app-button" disabled={operation.busy} onClick={()=>void act(operation.intent!)}>{text(operation.busy?"pending":"retry")}</button>:null}</AppPanel>:null}
    {ride ? <>
      <p className="bike-app-actions"><span className="bike-app-chip" data-tone="purple">{club.name}</span><span className="bike-app-chip">{text(status)}</span></p>
      {!available?<p role="status">{text("unavailable")}</p>:null}
      <RideDetailContent ride={ride} viewer={data.viewer} locale={locale} clubMode backHref={calendarDay ? base+"?date="+encodeURIComponent(calendarDay) : base} actions={available?<>
        {ride.hostId===userId?<button ref={trigger} className="bike-app-button bike-app-button-danger" disabled={blocked} onClick={()=>dialog.current?.showModal()}>{t("rides.cancelRide")}</button>:<>
          {ownInvite&&!ownInvite.acceptedAt&&!ownInvite.declinedAt?<><p>{text("invitation")}</p><button className="bike-app-button" disabled={blocked} onClick={()=>void send("respond",{accept:true})}>{text("accept")}</button><button className="bike-app-button bike-app-button-secondary" disabled={blocked} onClick={()=>void send("respond",{accept:false})}>{text("decline")}</button></>:<button className="bike-app-button" disabled={blocked} onClick={()=>void send(ride.joined?"leave":"join")}>{t(ride.joined?"common.leave":"common.join")}</button>}
        </>}
      </>:null}/>
      {ride.route.length>=2 ? <a className="bike-app-button bike-app-button-secondary bike-app-section-gap" href={`/api/clubs/rides/gpx?clubId=${club.id}&rideId=${ride.id}`}>{t("history.export")}</a> : null}
      <dialog className="bike-app-club-dialog" ref={dialog} aria-labelledby="cancel-ride-title" onClose={()=>trigger.current?.focus()}><h2 id="cancel-ride-title">{text("cancelConfirm")}</h2><div className="bike-app-actions"><button autoFocus className="bike-app-button bike-app-button-secondary" onClick={()=>dialog.current?.close()}>{text("keep")}</button><button className="bike-app-button bike-app-button-danger" disabled={blocked} onClick={()=>{dialog.current?.close();void send("cancel");}}>{text("confirm")}</button></div></dialog>
      {ride.hostId===userId&&available?<AppPanel title={text("invites")} className="bike-app-section-gap"><p className="bike-app-muted">{text("inviteHint")}</p><fieldset disabled={blocked} className="bike-app-club-form-fields"><ul className="bike-app-list">{club.members.filter(m=>m.user_id!==userId).map(m=>{
        const invitation=ride.invites.find(i=>i.inviteeId===m.user_id),joined=ride.participants.some(p=>p.id===m.user_id);
        const status=joined?"joined":invitation?.acceptedAt?"accepted":invitation?.declinedAt?"declined":invitation?"waiting":"eligible";
        return <li key={m.user_id} className="bike-app-list-item"><label><input type="checkbox" disabled={status!=="eligible"} checked={selection.includes(m.user_id)} onChange={e=>setSelection(s=>e.target.checked?[...s,m.user_id]:s.filter(id=>id!==m.user_id))}/> {m.display_name??"Bike Me"}</label><span>{text(status)}</span></li>;
      })}</ul><button className="bike-app-button bike-app-section-gap" disabled={!selection.length} onClick={()=>void send("invite",{ids:selection})}>{text("send")}</button></fieldset></AppPanel>:null}
    </>:<>
      {data.selectedUnavailable?<p role="status">{text("unavailable")}</p>:null}
      <ClubCalendar clubId={club.id} userId={userId} locale={locale} miles={data.units==="imperial"} onAccessLost={onAccessLost}
        initialDay={calendarDay} />
    </>}
    </>}
  </>;
}
