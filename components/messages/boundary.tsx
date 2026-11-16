'use client';
import {AccessContinuity,useAccessContinuity} from '../clubs/access-continuity';
import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import {createMessagesStore} from '@/lib/messages/store';
import {ContentError,responseContentError} from '@/lib/clubs/content-contract';
import {createClient} from '@/lib/supabase/client';
import {CLUB_AUTH_EVENT,clubAuthPhase} from '@/lib/clubs/auth-events';
import type {Locale} from '@/lib/locales';
import {MessagesWorkspace} from './workspace';
import {dmText} from '@/lib/messages/i18n';
export function MessagesBoundary({userId,conversationId,peer,locale}:{userId:string;conversationId:string|null;peer:string|null;locale:Locale}){
 const store=useMemo(()=>{const next=createMessagesStore({actor:userId,conversation:conversationId,peer,opened:id=>window.location.assign(`/${locale}/app/messages/${id}`),key:()=>crypto.randomUUID(),identityLost:()=>{flushSync(()=>next.revoke('auth'));window.location.reload();},
  async read(q,signal){const r=await fetch(`/api/messages?${q}`,{cache:'no-store',credentials:'same-origin',signal});const body=await r.json();if(!r.ok)throw responseContentError(body.error);if(!body.snapshot||typeof body.userId!=='string')throw new ContentError('network');return body;},
  async send(command,signal){const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store',credentials:'same-origin',signal});const body=await r.json();if(!r.ok)throw responseContentError(body.error);if(body.ok!==true||typeof body.userId!=='string')throw new ContentError('network');return body;}
 });return next;},[userId,conversationId,peer,locale]);
 const continuity=useAccessContinuity(),bindContinuity=continuity.bind;
 const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
 useEffect(()=>{
  store.start();let live=true,lifecycle=0,signalBusy=false,transportLive=false,subscribed=false;const pending=new Set<AbortController>();
  const pause=()=>{lifecycle++;flushSync(()=>store.pause());};
  const refresh=bindContinuity(pause,async()=>{if(transportLive)store.connection(true,false);await store.revalidate();},()=>{lifecycle++;pending.forEach(c=>c.abort());}),verify=()=>refresh.resume();
  const visibility=()=>document.visibilityState==='hidden'?refresh.deactivate():verify();
  const page=(e:PageTransitionEvent)=>{if(e.persisted)verify();};
  const revoke=()=>{lifecycle++;flushSync(()=>store.revoke('auth'));};
  const transition=(phase:string|null)=>{if(phase){revoke();if(phase==='settled')window.location.reload();}};
  const storage=(e:StorageEvent)=>{if(e.key===CLUB_AUTH_EVENT)transition(clubAuthPhase(e.newValue));};
  const local=(e:Event)=>transition((e as CustomEvent<string>).detail);
  const offline=()=>{transportLive=false;refresh.suspend();lifecycle++;flushSync(()=>store.connection(false));};
  const signals=async()=>{if(document.visibilityState!=='visible'||!document.hasFocus()||refresh.checking||signalBusy||store.getSnapshot().status!=='ready')return;signalBusy=true;const v=lifecycle,c=new AbortController();pending.add(c);const timer=setTimeout(()=>c.abort(),20000);try{const r=await fetch('/api/messages?mode=signals',{cache:'no-store',credentials:'same-origin',signal:c.signal});const b=await r.json();if(!live||v!==lifecycle||document.visibilityState!=='visible')return;if(r.status===401||b.userId&&b.userId!==userId){revoke();window.location.reload();return;}if(!r.ok||(!Number.isSafeInteger(b.visibilityRevision)||!Number.isSafeInteger(b.revision)||!Number.isSafeInteger(b.historyRevision)))throw new ContentError('network');store.signal(b);}catch(e){if(live&&v===lifecycle)flushSync(()=>store.fail(e));}finally{clearTimeout(timer);pending.delete(c);signalBusy=false;}};
  const client=createClient(),auth=client?.auth.onAuthStateChange((_event,session)=>{if(session?.user.id!==userId){revoke();window.location.reload();}}).data.subscription;
  const channel=client?.channel(`dm-web-${userId}-${crypto.randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'private_message_signals',filter:`user_id=eq.${userId}`},()=>void signals()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'private_message_signals',filter:`user_id=eq.${userId}`},()=>void signals()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'club_chat_signals',filter:`user_id=eq.${userId}`},()=>void signals()).subscribe(status=>{if(!live)return;if(status==='SUBSCRIBED'){const first=!subscribed;subscribed=true;transportLive=true;if(document.visibilityState!=='visible'||!document.hasFocus()){refresh.deactivate();return;}store.connection(true,false);if(first&&store.getSnapshot().status==='ready')void signals();else refresh.check();}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))offline();});
  window.addEventListener('focus',verify);window.addEventListener('blur',refresh.deactivate);window.addEventListener('online',refresh.check);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',refresh.suspend);window.addEventListener('pageshow',page);window.addEventListener('storage',storage);window.addEventListener(CLUB_AUTH_EVENT,local);
  const full=setInterval(refresh.check,60000),poll=setInterval(()=>void signals(),10000);refresh.check();
  return()=>{live=false;refresh.stop();pending.forEach(c=>c.abort());clearInterval(full);clearInterval(poll);auth?.unsubscribe();void channel?.unsubscribe();store.stop();window.removeEventListener('focus',verify);window.removeEventListener('blur',refresh.deactivate);window.removeEventListener('online',refresh.check);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',refresh.suspend);window.removeEventListener('pageshow',page);window.removeEventListener('storage',storage);window.removeEventListener(CLUB_AUTH_EVENT,local);};
 },[store,userId,bindContinuity]);
 if(state.status==='auth'||state.status==='access')return <div data-dm-access={state.status} data-dm-data="empty"><p role="alert">{dmText(locale,"access")}</p><a className="bike-app-button" href={`/${locale}/app/messages`}>{dmText(locale,"back")}</a></div>;
 return <AccessContinuity {...continuity} locale={locale}><MessagesWorkspace checking={continuity.checking||continuity.concealed} store={store} state={state} locale={locale} userId={userId} conversationId={conversationId} peer={peer}/></AccessContinuity>;
}
