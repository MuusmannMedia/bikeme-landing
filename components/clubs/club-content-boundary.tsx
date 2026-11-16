"use client";
import {AccessContinuity,useAccessContinuity} from "./access-continuity";
import {useEffect,useMemo,useSyncExternalStore} from "react";
import {flushSync} from "react-dom";
import {createContentStore} from "@/lib/clubs/content-store";
import {ContentError,responseContentError} from "@/lib/clubs/content-contract";
import {createClient} from "@/lib/supabase/client";
import {CLUB_AUTH_EVENT,clubAuthPhase} from "@/lib/clubs/auth-events";
import type {Locale} from "@/lib/locales";
import {ClubContentWorkspace} from "./club-content-workspace";
export function ClubContentBoundary({userId,clubId,locale,query}:{userId:string;clubId:string;locale:Locale;query:string}){
 const store=useMemo(()=>{const next=createContentStore({actor:userId,clubId,key:()=>crypto.randomUUID(),identityLost:()=>{flushSync(()=>next.revoke("auth"));window.location.reload();},
  async read(draft,signal){const q=new URLSearchParams(query);q.set("clubId",clubId);if(draft?.id||draft?.post){q.set("editorId",draft.id??draft.post!);q.set("editorKind",draft.id?draft.kind:"post");}
   const r=await fetch(`/api/clubs/content?${q}`,{credentials:"same-origin",cache:"no-store",signal});const result=await r.json();if(!r.ok)throw responseContentError(result.error);if(typeof result.userId!=="string"||!result.snapshot)throw new ContentError("network");return result;},
  async send(command,signal){const r=await fetch("/api/clubs/content",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(command),credentials:"same-origin",cache:"no-store",signal});const result=await r.json();if(!r.ok)throw responseContentError(result.error);if(typeof result.userId!=="string"||result.ok!==true)throw new ContentError("network");return result;}
 });return next;},[userId,clubId,query]);
 const continuity=useAccessContinuity(),bindContinuity=continuity.bind;
 const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
 useEffect(()=>{
  store.start();let live=true,lifecycle=0,revisionBusy=false;const controllers=new Set<AbortController>();
  const pause=()=>{if(store.getSnapshot().data)flushSync(()=>store.pause());else store.pause();};
  const refresh=bindContinuity(pause,()=>store.refresh(true),()=>{lifecycle++;controllers.forEach(c=>c.abort());}),verify=()=>refresh.resume();
  const visibility=()=>document.visibilityState==="hidden"?refresh.deactivate():verify();
  const restored=(event:PageTransitionEvent)=>{if(event.persisted)verify();};
  const revoke=()=>flushSync(()=>store.revoke("auth"));
  const transition=(phase:string|null)=>{if(!phase)return;revoke();if(phase==="settled")window.location.reload();};
  const storage=(e:StorageEvent)=>{if(e.key===CLUB_AUTH_EVENT)transition(clubAuthPhase(e.newValue));};
  const local=(e:Event)=>transition((e as CustomEvent<string>).detail);
  const client=createClient();const auth=client?.auth.onAuthStateChange((_event,session)=>{if(session?.user.id!==userId){revoke();window.location.reload();}}).data.subscription;
  const revision=async()=>{
   if(document.visibilityState!=="visible"||!document.hasFocus()||refresh.checking||revisionBusy)return;revisionBusy=true;const epoch=lifecycle;
   const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),20000);
   try{const r=await fetch(`/api/clubs/content?mode=revision`,{cache:"no-store",credentials:"same-origin",signal:controller.signal});const result=await r.json();if(!live||epoch!==lifecycle||document.visibilityState!=="visible")return;if(r.status===401||result.userId&&result.userId!==userId){revoke();window.location.reload();return;}if(!r.ok||!Number.isSafeInteger(result.revision))throw Error("revision");if(store.getSnapshot().status==="error")verify();else flushSync(()=>store.observe(result.revision));}
   catch{if(live&&epoch===lifecycle)flushSync(()=>store.failNetwork());}finally{clearTimeout(timer);controllers.delete(controller);revisionBusy=false;}
  };
  const channel=client?.channel(`club-content-${userId}-${crypto.randomUUID()}`).on("postgres_changes",{event:"*",schema:"public",table:"club_chat_signals",filter:`user_id=eq.${userId}`},payload=>{const next=(payload.new as {visibility_revision?:number}).visibility_revision;if(live&&typeof next==="number"){if(document.visibilityState==="visible")flushSync(()=>store.observe(next));else refresh.deactivate();}}).subscribe(status=>{if(!live)return;if(status==="SUBSCRIBED")void revision();else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status))refresh.check();});
  window.addEventListener("focus",verify);window.addEventListener("blur",refresh.deactivate);document.addEventListener("visibilitychange",visibility);window.addEventListener("pagehide",refresh.suspend);window.addEventListener("pageshow",restored);window.addEventListener("storage",storage);window.addEventListener(CLUB_AUTH_EVENT,local);
  const timer=setInterval(refresh.check,60000),poll=setInterval(()=>void revision(),10000);refresh.check();
  return()=>{live=false;refresh.stop();controllers.forEach(c=>c.abort());clearInterval(timer);clearInterval(poll);auth?.unsubscribe();void channel?.unsubscribe();store.stop();window.removeEventListener("focus",verify);window.removeEventListener("blur",refresh.deactivate);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",refresh.suspend);window.removeEventListener("pageshow",restored);window.removeEventListener("storage",storage);window.removeEventListener(CLUB_AUTH_EVENT,local);};
 },[store,userId,bindContinuity]);
 return <AccessContinuity {...continuity} locale={locale}><ClubContentWorkspace state={state} store={store} userId={userId} clubId={clubId} locale={locale} query={query}/></AccessContinuity>;
}
