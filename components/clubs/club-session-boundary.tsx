"use client";

import {clubCatalogPage} from '@/lib/clubs/catalog-page';
import {fetchClubAccess} from '@/lib/clubs/access-fetch';
import {visitText} from '@/lib/clubs/visits/i18n';
import {BatchCatalogContext} from './visits/catalog-batch-provider';
import type {CatalogProfile} from '@/lib/clubs/visits/catalog-batch-store';
import {StableAccessRegion} from "./stable-access-region";
import {ClubHeaderImagesScope,useClubHeaderImages} from "./club-private-images";
import {AccessContinuity,useAccessContinuity} from "./access-continuity";
import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

import { CLUB_AUTH_EVENT, clubAuthPhase } from "@/lib/clubs/auth-events";
import { getAppDictionary } from "@/lib/app-i18n";
import { createClubWorkflow } from "@/lib/clubs/workflow";
import { ClubError, clubResponseError } from "@/lib/clubs/membership-types";
import { createClubPageGuard } from "@/lib/clubs/page-guard";
import { ClubReadError, type ClubPageData } from "@/lib/clubs/types";
import type { Locale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/client";
import { ClubRides, type ClubRideIntent, type ClubRideActionState } from "./club-rides";
import { ClubCreateRide } from "./club-create-ride";
import { ClubPageContent } from "./club-page-content";
import { ClubAccessDenied, ClubReadFailure } from "./club-ui";

export function ClubSessionBoundary({ userId, clubId, locale, selected = "details", rideId, created, directory = "mine" }: {
  userId: string; clubId?: string; locale: Locale; selected?: "details" | "members" | "rides" | "newRide"; rideId?: string; created?: string; directory?: "mine" | "all";
}) {
  const catalogStore=useContext(BatchCatalogContext);
  const store = useMemo(() => {
    const guard = createClubPageGuard<ClubPageData>({
      userId,
      identityLost() {
        // Flush the null snapshot before any navigation can be delayed/fail.
        flushSync(() => guard.revoke());
        window.location.reload();
      },
      async read(signal) {
        const catalogToken=clubId===undefined&&directory==='all'?catalogStore?.directoryReadStarted():undefined;
        try {
        const query = clubId !== undefined ? `?clubId=${encodeURIComponent(clubId)}${selected === "rides" || selected === "newRide" ? `&view=rides&create=${selected === "newRide"}${rideId ? `&rideId=${encodeURIComponent(rideId)}` : ""}` : ""}` : `?directory=${directory}&catalogQ=${encodeURIComponent(catalogStore?.view.query??'')}&catalogPage=${catalogStore?.view.page??0}`;
        const response = await fetchClubAccess(`/api/clubs/access${query}`,signal);
        if (response.status === 401) throw new ClubReadError("auth");
        if (response.status === 403) throw new ClubReadError("access");
        if (response.status === 429) throw new ClubReadError("quota");
        const latest = await response.json();
        if (!response.ok) throw new ClubReadError(latest.error === "unavailable" ? "unavailable" : "network");
        if (typeof latest.userId !== "string" || latest.snapshot?.view !== (clubId === undefined ? "directory" : selected === "rides" || selected === "newRide" ? "rides" : "club")) throw new ClubReadError("network");
        if(latest.userId!==userId)throw new ClubReadError('auth');
        if(catalogToken){if(signal.aborted)catalogStore?.directoryReadFinished(catalogToken);else if(latest.snapshot.view==='directory')catalogStore?.directoryReadFinished(catalogToken,latest.snapshot.visits as Record<string,CatalogProfile|null>,clubCatalogPage(latest.snapshot.catalog,catalogStore?.view.query??'',catalogStore?.view.page??0).entries.map((c:{id:string})=>c.id));}
        return latest as { userId: string; snapshot: ClubPageData };
        } catch(error){if(catalogToken)catalogStore?.directoryReadFinished(catalogToken,undefined,undefined,signal.aborted?undefined:error);throw error;}
      }
    });
    return guard;
  }, [userId, clubId, selected, rideId, directory,catalogStore]);
  const workflow = useMemo(() => createClubWorkflow({
    userId, key: () => crypto.randomUUID(), canAct: () => store.getSnapshot().status === "ready",
    identityLost() { flushSync(() => { store.revoke(); }); window.location.reload(); },
    async refresh() { flushSync(() => store.pause()); if (document.visibilityState === "visible") await store.verify(); },
    async send(command, signal) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const abort = () => controller.abort(); signal.addEventListener("abort", abort, {once:true});
      try {
        const response = await fetch("/api/clubs/actions", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(command), cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (response.status === 401) throw new ClubError("auth");
        const result = await response.json();
        if (!response.ok) throw clubResponseError(result.error);
        if (typeof result.userId !== "string") throw new ClubError("network");
        if (result.userId !== userId) throw new ClubError("auth");
        if (!result.ok) throw new ClubError("network");
        if (command.action === "leave") { flushSync(() => store.revoke()); window.location.assign(`/${locale}/app/clubs`); }
      } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
    },
    async search(query, signal) {
      const response = await fetch(`/api/clubs/people?actorId=${encodeURIComponent(userId)}&clubId=${encodeURIComponent(clubId ?? "")}&q=${encodeURIComponent(query)}`, {cache:"no-store",credentials:"same-origin",signal});
      if (response.status === 401) throw new ClubError("auth");
      const result = await response.json();
      if (!response.ok) throw clubResponseError(result.error);
      if (typeof result.userId !== "string") throw new ClubError("network");
      if (result.userId !== userId) throw new ClubError("auth");
      if (!Array.isArray(result.people)) throw new ClubError("network");
      return result.people;
    }
  }), [store, userId, clubId, locale]);
 const continuity=useAccessContinuity(),bindContinuity=continuity.bind;
 const images=useClubHeaderImages(userId,clubId);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    workflow.start();
    const sync = () => { const status=store.getSnapshot().status; if(status === "auth" || status === "access") workflow.reset(); else if(status !== "ready") workflow.pause(); };
    const unsubscribe=store.subscribe(sync);
    return () => { unsubscribe(); workflow.stop(); };
  }, [store, workflow]);
  const emptyOperation: ClubRideActionState={busy:false,intent:null,message:null,results:[]};
  const [operation,setOperation]=useState<ClubRideActionState>(emptyOperation);
  const operationRef=useRef<ClubRideIntent|null>(null), actionBusy=useRef(false), actionEpoch=useRef(0);
  useEffect(()=>store.subscribe(()=>{
    const status=store.getSnapshot().status;
    if(status === "auth" || status === "access") {actionEpoch.current++;operationRef.current=null;actionBusy.current=false;setOperation({busy:false,intent:null,message:null,results:[]});}
    else if(status!=="ready") setOperation(old=>({...old,results:[]}));
  }),[store]);
  async function rideAction(input:ClubRideIntent) {
    if(actionBusy.current || store.getSnapshot().status!=="ready") return;
    const intent=operationRef.current??structuredClone(input);operationRef.current=intent;actionBusy.current=true;
    const epoch=actionEpoch.current;
    setOperation({busy:true,intent,message:"pending",results:[]});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    let message="done", results:ClubRideActionState["results"]=[];
    try {
      const response=await fetch("/api/clubs/rides",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(intent),credentials:"same-origin",cache:"no-store",signal:controller.signal});
      const result=await response.json();
      if(epoch!==actionEpoch.current) return;
      if(response.status===401 || result.userId && result.userId!==userId) {store.revoke();window.location.reload();return;}
      if(!response.ok) {
        if(response.status>=500 || !["invalid","access","rideUnavailable","rideInviteProcessed"].includes(result.error)) throw Error("unknown");
        operationRef.current=null;message="error";
      } else {
        if(!result.ok || result.userId!==userId || !Array.isArray(result.retryIds) || !Array.isArray(result.results)) throw Error("unknown");
        results=result.results;
        if(result.retryIds.length) {operationRef.current={...intent,ids:result.retryIds};message=result.push==="failed"?"partialPushFailed":"partial";}
        else {operationRef.current=null;message=intent.action==="invite"?(result.push==="failed"?"pushFailed":result.push==="sent"?"savedPush":"saved"):"done";}
      }
      flushSync(()=>store.pause());await store.verify();
    } catch { message="uncertain"; }
    finally {
      clearTimeout(timer);
      if(epoch===actionEpoch.current) { actionBusy.current=false;setOperation({busy:false,intent:operationRef.current,message,results:store.getSnapshot().status==="ready"?results:[]}); }
    }
  }
  const t = getAppDictionary(locale);
  useEffect(() => {
    store.start();
    images?.start();
    const stopImageAccess = store.subscribe(() => {
      const { status } = store.getSnapshot();
      if (status === "auth") images?.revoke();
      if (status === "access") images?.clear();
    });
    const pause = () => {
      images?.pause();
      // Avoid flushSync during initial effect setup when there is no data yet.
      if (store.getSnapshot().data) flushSync(() => store.pause());
      else store.pause();
    };
    const refresh=bindContinuity(pause,async()=>{
      void images?.verify();
      await store.verify(true);
    },()=>images?.pause());
    const verify=()=>refresh.resume();
    const visibility = () => { if (document.visibilityState === "hidden") refresh.deactivate(); else verify(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) verify(); };
    const subscription = createClient()?.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
        flushSync(() => store.revoke());
        window.location.reload();
      }
    }).data.subscription;
    const authTransition = (phase: string | null) => {
      if (!phase) return;
      flushSync(() => store.revoke());
      if (phase === "settled") window.location.reload();
    };
    const storage = (event: StorageEvent) => { if (event.key === CLUB_AUTH_EVENT) authTransition(clubAuthPhase(event.newValue)); };
    const local = (event: Event) => authTransition((event as CustomEvent<string>).detail);
    window.addEventListener("storage", storage);
    window.addEventListener(CLUB_AUTH_EVENT, local);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", verify);
    window.addEventListener("blur", refresh.deactivate);
    window.addEventListener("pagehide", refresh.suspend);
    window.addEventListener("pageshow", restored);
    const timer = window.setInterval(refresh.check, 60000);
    refresh.check();
    return () => {
      refresh.stop(); stopImageAccess(); images?.revoke(); store.stop(); subscription?.unsubscribe(); window.clearInterval(timer);
      window.removeEventListener("storage", storage);
      window.removeEventListener(CLUB_AUTH_EVENT, local);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", verify);
      window.removeEventListener("pagehide", refresh.suspend);
      window.removeEventListener("blur", refresh.deactivate);
      window.removeEventListener("pageshow", restored);
    };
  }, [store, userId, bindContinuity, images]);
  const retryHref = `/${locale}/app/clubs${clubId === undefined ? "" : `/${encodeURIComponent(clubId)}${selected === "members" ? "/members" : selected === "rides" || selected === "newRide" ? "/rides" : ""}`}`;
  const ready=state.status === "ready" && state.data;
  return <ClubHeaderImagesScope clubId={clubId} store={images} authorized={!!ready&&!continuity.checking&&!continuity.concealed}><AccessContinuity {...continuity} locale={locale}><div data-club-access={state.status} data-club-data={state.data === null ? "empty" : "present"}>
    <StableAccessRegion denied={state.status==='access'||state.status==='auth'} ready={!!ready} fallback={state.status === "access" ? <ClubAccessDenied locale={locale} /> :
      state.status === "error" ? state.error==='quota'?<div role="alert"><p>{visitText(locale,'quota')}</p><button className="bike-app-button bike-app-button-secondary" onClick={()=>void store.verify()}>{t('common.retry')}</button></div>:<ClubReadFailure locale={locale} kind={state.error ?? "network"} retryHref={retryHref} onRetry={() => void store.verify()} /> :
      <div className="bike-app-club-gate" role="status"><p>{t("clubs.loading")}</p></div>}>{ready?state.data!.view === "rides" ? <ClubRides club={state.data!.club} data={state.data!.rides} locale={locale} userId={userId} created={created} creation={selected==="newRide"} operation={operation} act={rideAction}/> : <ClubPageContent data={state.data as Exclude<ClubPageData,{view:"rides"}>} locale={locale} selected={selected==="members"?"members":"details"} userId={userId} workflow={workflow} directory={directory} />:null}</StableAccessRegion>
    {selected === "newRide" && clubId && state.status!=="access" && state.status!=="auth" ? <ClubCreateRide userId={userId} clubId={clubId} locale={locale} authorized={!!ready} data={state.data?.view==="rides"?state.data.rides:null}/>:null}
  </div></AccessContinuity></ClubHeaderImagesScope>;
}
