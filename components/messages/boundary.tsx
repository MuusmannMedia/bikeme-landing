'use client';
import {subscribeOwnSignals} from '@/lib/realtime/own-signals';
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
import {ConversationBlock} from './conversation-block';
import {FloatingMessageWindow} from './floating-message-window';
import {MessagePopoverList} from './message-popover-list';

type MessagesView =
 | {kind:'popover';peer:string|null;clearPeer:()=>void;openConversation:(id:string)=>void}
 | {kind:'floating';conversationId:string;initialMessage?:string;minimized:boolean;close:()=>void;toggle:()=>void};

export function MessagesBoundary({userId,locale,view}:{userId:string;locale:Locale;view:MessagesView}){
 const conversationId=view.kind==='floating'?view.conversationId:null;
 const peer=view.kind==='popover'?view.peer:null;
 const openConversation=view.kind==='popover'?view.openConversation:null;
 const initialMessage=view.kind==='floating'?view.initialMessage:undefined;
 const store=useMemo(()=>{const next=createMessagesStore({actor:userId,conversation:conversationId,peer,opened:id=>openConversation?.(id),key:()=>crypto.randomUUID(),identityLost:()=>{flushSync(()=>next.revoke('auth'));window.location.reload();},
  async read(q,signal){const r=await fetch(`/api/messages?${q}`,{cache:'no-store',credentials:'same-origin',signal});const body=await r.json();if(!r.ok)throw responseContentError(body.error);if(!body.snapshot||typeof body.userId!=='string')throw new ContentError('network');return body;},
  async send(command,signal){const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store',credentials:'same-origin',signal});const body=await r.json();if(!r.ok)throw responseContentError(body.error);if(body.ok!==true||typeof body.userId!=='string')throw new ContentError('network');return body;}
 });return next;},[userId,conversationId,peer,openConversation]);
 const continuity=useAccessContinuity(),bindContinuity=continuity.bind;
 const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
 useEffect(()=>{
  store.start();let live=true,lifecycle=0,signalBusy=false,transportLive=false;const pending=new Set<AbortController>();
  const pause=()=>{lifecycle++;flushSync(()=>store.pause());};
  let linkedMessage=initialMessage;
  const refresh=bindContinuity(pause,async()=>{
   if(transportLive)store.connection(true,false);
   await store.revalidate();
   if(live&&linkedMessage&&store.getSnapshot().status==='ready'){
    store.original(linkedMessage);
    linkedMessage=undefined;
   }
  },()=>{lifecycle++;pending.forEach(c=>c.abort());}),verify=()=>refresh.resume();
  const visibility=()=>document.visibilityState==='hidden'?refresh.deactivate():verify();
  const page=(e:PageTransitionEvent)=>{if(e.persisted)verify();};
  const revoke=()=>{lifecycle++;flushSync(()=>store.revoke('auth'));};
  const transition=(phase:string|null)=>{if(phase){revoke();if(phase==='settled')window.location.reload();}};
  const storage=(e:StorageEvent)=>{if(e.key===CLUB_AUTH_EVENT)transition(clubAuthPhase(e.newValue));};
  const local=(e:Event)=>transition((e as CustomEvent<string>).detail);
  const offline=()=>{transportLive=false;refresh.suspend();lifecycle++;flushSync(()=>store.connection(false));};
  const signals=async()=>{if(document.visibilityState!=='visible'||!document.hasFocus()||refresh.checking||signalBusy||store.getSnapshot().status!=='ready')return;signalBusy=true;const v=lifecycle,c=new AbortController();pending.add(c);const timer=setTimeout(()=>c.abort(),20000);try{const r=await fetch('/api/messages?mode=signals',{cache:'no-store',credentials:'same-origin',signal:c.signal});const b=await r.json();if(!live||v!==lifecycle||document.visibilityState!=='visible')return;if(r.status===401||b.userId&&b.userId!==userId){revoke();window.location.reload();return;}if(!r.ok||(!Number.isSafeInteger(b.visibilityRevision)||!Number.isSafeInteger(b.revision)||!Number.isSafeInteger(b.historyRevision)))throw new ContentError('network');store.signal(b);}catch(e){if(live&&v===lifecycle)flushSync(()=>store.fail(e));}finally{clearTimeout(timer);pending.delete(c);signalBusy=false;}};
  const client=createClient(),auth=client?.auth.onAuthStateChange((_event,session)=>{if(session?.user.id!==userId){revoke();window.location.reload();}}).data.subscription;
  const stopSignals=subscribeOwnSignals(client,userId,'own-signals-'+crypto.randomUUID(),['private_message_signals','club_chat_signals'],{ready:()=>{if(!live)return;transportLive=true;if(document.visibilityState!=='visible'||!document.hasFocus()){refresh.deactivate();return;}store.connection(true,false);void store.revalidate();},unavailable:()=>{if(live){transportLive=false;refresh.check();}},change:()=>void signals()});
  window.addEventListener('focus',verify);window.addEventListener('blur',refresh.deactivate);window.addEventListener('online',refresh.check);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',refresh.suspend);window.addEventListener('pageshow',page);window.addEventListener('storage',storage);window.addEventListener(CLUB_AUTH_EVENT,local);
  const full=setInterval(refresh.check,60000),poll=setInterval(()=>void signals(),10000);refresh.check();
  return()=>{live=false;stopSignals();refresh.stop();pending.forEach(c=>c.abort());clearInterval(full);clearInterval(poll);auth?.unsubscribe();store.stop();window.removeEventListener('focus',verify);window.removeEventListener('blur',refresh.deactivate);window.removeEventListener('online',refresh.check);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',refresh.suspend);window.removeEventListener('pageshow',page);window.removeEventListener('storage',storage);window.removeEventListener(CLUB_AUTH_EVENT,local);};
 },[store,userId,bindContinuity,initialMessage]);
 const denied=state.status==='auth'||state.status==='access';
 const content=denied?<div className="bike-message-popover-feedback" data-dm-access={state.status} data-dm-data="empty">
  <p role="alert">{dmText(locale,"access")}</p>
 </div>:<AccessContinuity {...continuity} locale={locale}>
  {view.kind==='popover'
   ? <MessagePopoverList actor={userId} locale={locale} state={state} store={store} peer={view.peer}
      clearPeer={view.clearPeer} openConversation={view.openConversation}/>
   : <MessagesWorkspace checking={continuity.checking||continuity.concealed}
      store={store} state={state} locale={locale} userId={userId} conversationId={view.conversationId} minimized={view.minimized}/>}
 </AccessContinuity>;
 if(view.kind!=='floating')return content;

 const conversation=state.status==='ready'&&!continuity.concealed ? state.data?.conversation : null;
 const name=conversation ? conversation.peer.display_name??dmText(locale,'deletedUser') : null;
 const actions=!view.minimized&&conversation?.peer.id
  ? <ConversationBlock locale={locale} blocked={conversation.blocked_by_me}
     disabled={continuity.checking||state.busy||!!state.pending}
     onChange={value=>void store.run({actorId:userId,conversation:view.conversationId,type:'block',value})}/>
  : null;
 return <FloatingMessageWindow locale={locale} name={name} actions={actions}
   minimized={view.minimized} close={view.close} toggle={view.toggle}>{content}</FloatingMessageWindow>;
}
