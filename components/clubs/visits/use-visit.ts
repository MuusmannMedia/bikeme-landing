'use client';
import {subscribeOwnSignals} from '@/lib/realtime/own-signals';
import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import {createVisitStore} from '@/lib/clubs/visits/store';
import {readVisit,readVisitPreview,sendVisit} from '@/lib/clubs/visits/client';
import {createClient} from '@/lib/supabase/client';
import {CLUB_AUTH_EVENT,clubAuthPhase} from '@/lib/clubs/auth-events';
import {useAccessContinuity} from '../access-continuity';
export function useVisit(actor: string, clubId: string, manage = false, memberPreviewVisits?: boolean) {
 const continuity = useAccessContinuity(), bind = continuity.bind;
 const store = useMemo(() => createVisitStore({
  actor,
  identityLost: () => window.location.reload(),
  read: (signal, old) => memberPreviewVisits === undefined
   ? readVisit(clubId, actor, manage, signal, old)
   : readVisitPreview(clubId, actor, signal, old, memberPreviewVisits),
  send: sendVisit
 }), [actor, clubId, manage, memberPreviewVisits]);
 const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
 useEffect(()=>{let live=true;store.start();const c=createClient();const refresh=bind(()=>{store.suspend();store.invalidate();},()=>store.refresh(true),()=>store.suspend());const resume=()=>refresh.resume(),visibility=()=>document.visibilityState==='hidden'?refresh.deactivate():resume(),page=(e:PageTransitionEvent)=>{if(e.persisted)resume();};
 const revoke=()=>flushSync(()=>store.revoke()),transition=(p:string|null)=>{if(p)revoke();},local=(e:Event)=>transition((e as CustomEvent<string>).detail),storage=(e:StorageEvent)=>{if(e.key===CLUB_AUTH_EVENT)transition(clubAuthPhase(e.newValue));};
 const auth=c?.auth.onAuthStateChange((_e,s)=>{if(s?.user.id!==actor)revoke();}).data.subscription;
 let watched=false,watching=false;const watch=()=>{const data=store.getSnapshot().data;if(watched||watching||!data||!manage&&'profile'in data.snapshot&&!data.snapshot.profile)return;watching=true;void sendVisit({actorId:actor,clubId,key:crypto.randomUUID(),op:'watch'},new AbortController().signal).then(()=>{watched=true;if(live)void store.refresh(true);}).catch(()=>{}).finally(()=>{watching=false;});};const unwatch=store.subscribe(watch);
 const stopSignals=subscribeOwnSignals(c,actor,'club-visit-'+clubId+'-'+crypto.randomUUID(),['club_chat_signals'],{ready:()=>{if(!live)return;watched=false;if(document.visibilityState!=='visible'||!document.hasFocus()){refresh.deactivate();return;}watch();void store.refresh(true);},unavailable:()=>{if(live)store.invalidate();},change:()=>flushSync(()=>store.invalidate())});
 window.addEventListener('storage',storage);window.addEventListener(CLUB_AUTH_EVENT,local);window.addEventListener('focus',resume);window.addEventListener('blur',refresh.deactivate);window.addEventListener('pagehide',refresh.suspend);window.addEventListener('pageshow',page);window.addEventListener('online',refresh.check);document.addEventListener('visibilitychange',visibility);const timer=setInterval(refresh.check,30000);refresh.check();
 return()=>{live=false;stopSignals();refresh.stop();unwatch();store.stop();auth?.unsubscribe();clearInterval(timer);window.removeEventListener('storage',storage);window.removeEventListener(CLUB_AUTH_EVENT,local);window.removeEventListener('focus',resume);window.removeEventListener('blur',refresh.deactivate);window.removeEventListener('pagehide',refresh.suspend);window.removeEventListener('pageshow',page);window.removeEventListener('online',refresh.check);document.removeEventListener('visibilitychange',visibility);};},[actor,clubId,manage,store,bind]);return{state,store,continuity};}
