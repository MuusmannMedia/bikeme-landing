"use client";
import { useEffect, useRef, useState } from "react";
import { CreateRideForm } from "../create-ride-form";
import type { CreateRideActionState } from "@/app/[locale]/app/actions";
import { clubRideHref } from "@/lib/clubs/ride-contract";
import { clubRideText } from "@/lib/clubs/ride-i18n";
import type { Locale } from "@/lib/locales";
import type { ClubRideData } from "@/lib/clubs/ride-api";
export function ClubCreateRide({userId,clubId,locale,authorized,data,calendarDay}: {userId:string;clubId:string;locale:Locale;authorized:boolean;data:ClubRideData|null;calendarDay?:string}) {
  const [id]=useState(()=>crypto.randomUUID());
  const intent=useRef<FormData|null>(null), busy=useRef(false), active=useRef(true), permission=useRef(authorized);
  useEffect(()=>{permission.current=authorized;},[authorized]);
  const [locked,setLocked]=useState(false),[message,setMessage]=useState<"uncertain"|"error"|null>(null);
  useEffect(()=>{active.current=true;return()=>{active.current=false;intent.current=null;};},[]);
  async function submit(previous:CreateRideActionState,form:FormData):Promise<CreateRideActionState> {
    if(busy.current || !permission.current) return {...previous,attempt:previous.attempt+1};
    busy.current=true;setLocked(true);setMessage(null);
    const captured=intent.current??form;
    if(!intent.current) { captured.set("actorId",userId);captured.set("clubId",clubId);intent.current=captured; }
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    try {
      const response=await fetch("/api/clubs/rides",{method:"POST",body:captured,credentials:"same-origin",cache:"no-store",signal:controller.signal});
      const result=await response.json();
      if(!active.current) return previous;
      if(response.status===401 || result.userId && result.userId!==userId) {window.location.reload();return previous;}
      if(!response.ok) {
        if(response.status===503 || !["invalid","access","rideUnavailable"].includes(result.error)) throw Error("uncertain");
        intent.current=null;setLocked(false);setMessage("error");
      } else if(result.ok && result.rideId===id && result.clubId===clubId) {
        window.location.assign(`${clubRideHref(locale,clubId,id)}${calendarDay ? "&date=" + encodeURIComponent(calendarDay) : ""}&created=${result.routeFailed?"routeFailed":"created"}`);
      } else throw Error("uncertain");
    } catch { if(active.current) setMessage("uncertain"); }
    finally {clearTimeout(timer);busy.current=false;}
    return {notice:null,attempt:previous.attempt+1};
  }
  return <>
    {authorized ? <><h2>{clubRideText(locale,"create")}</h2><p className="bike-app-muted">{clubRideText(locale,"private")}</p>{message ? <p role="alert">{clubRideText(locale,message)}</p>:null}</>:null}
    <CreateRideForm createRequestId={id} locale={locale} hotspots={data?.hotspots??[]} initialType="EVENT" initialDate={calendarDay} inviteableRiders={[]} inviteLoadFailed={false} returnTo={`${clubRideHref(locale,clubId)}/new`} unitSystem={data?.units??"metric"} clubMode submitLabel={clubRideText(locale,locked?"retry":"create")} suspended={!authorized} locked={locked} submitAction={submit}/>
  </>;
}
