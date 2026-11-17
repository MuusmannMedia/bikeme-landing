'use client';
import {createContext,useContext,useEffect,useMemo,useRef,useSyncExternalStore,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {createCatalogStore} from '@/lib/clubs/visits/catalog-store';
import {CatalogWait,retryDelay,type CatalogLedger} from '@/lib/clubs/visits/catalog-queue';
import {VisitError,type VisitProfile} from '@/lib/clubs/visits/contract';
import {createClient} from '@/lib/supabase/client';
import {subscribeOwnSignals} from '@/lib/realtime/own-signals';
import {CLUB_AUTH_EVENT,clubAuthPhase} from '@/lib/clubs/auth-events';

const Context=createContext<ReturnType<typeof createCatalogStore>|null>(null);
export function VisitCatalogProvider({actor,children}:{actor:string;children:ReactNode}){
 const cleanup=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const store=useMemo(()=>{
  const key=`bike-visit-rate:${actor}`;let ledger:CatalogLedger|undefined;
  try{const raw=JSON.parse(sessionStorage.getItem(key)??'null');if(raw&&['read','image','watch'].every(k=>Array.isArray(raw[k])&&raw[k].length<=120&&raw[k].every((x:{at:number;amount:number})=>Number.isFinite(x.at)&&Number.isFinite(x.amount)&&x.amount>0)))ledger=raw;}catch{}
  async function call(path:string,signal:AbortSignal,command?:object){
   const timer=setTimeout(()=>controller.abort(),20000),controller=new AbortController();const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)controller.abort();
   try{const r=await fetch(path,{method:command?'POST':'GET',headers:command?{'Content-Type':'application/json'}:undefined,body:command?JSON.stringify(command):undefined,credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(r.status===429)throw new CatalogWait(retryDelay(r.headers.get('Retry-After'),Date.now()));
    if(r.status===401)throw new VisitError('auth');
    if(!r.ok){const b=await r.json().catch(()=>null);throw new VisitError(r.status===403?'access':b?.error==='conflict'?'conflict':'network');}
    return r;
   }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
  return createCatalogStore({actor,identityLost:()=>window.location.reload(),ledger,saveLedger:value=>{try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}},
   watch:async(club,signal)=>{const r=await call('/api/clubs/visits',signal,{actorId:actor,clubId:club,key:crypto.randomUUID(),op:'watch'}),b=await r.json();if(b.userId!==actor)throw new VisitError('auth');return b.result;},
   read:async(club,signal)=>{const r=await call(`/api/clubs/visits?clubId=${club}&mode=card`,signal),b=await r.json();if(b.userId!==actor)throw new VisitError('auth');if(!b.snapshot?.profile)throw new VisitError('access');return b.snapshot.profile as VisitProfile;},
   image:async(club,slot,revision,signal)=>{const r=await call(`/api/clubs/visits?clubId=${club}&mode=image&slot=${slot}&revision=${revision}`,signal);if(r.headers.get('x-bike-me-actor')!==actor)throw new VisitError('auth');return r.blob();},
  });
 },[actor]);
 useEffect(()=>{
  clearTimeout(cleanup.current);const c=createClient();let live=true;
  const revoke=()=>flushSync(()=>store.revoke());
  const auth=c?.auth.onAuthStateChange((_event,s)=>{if(s?.user.id!==actor)revoke();}).data.subscription;
  const local=(e:Event)=>{if((e as CustomEvent<string>).detail)revoke();},storage=(e:StorageEvent)=>{if(e.key===CLUB_AUTH_EVENT&&clubAuthPhase(e.newValue))revoke();};
  const pause=()=>{store.suspend(document.visibilityState==='hidden');if(document.visibilityState==='hidden')flushSync(()=>store.conceal());},resume=()=>{if(document.visibilityState==='visible'&&document.hasFocus())store.resume();},visibility=()=>document.visibilityState==='hidden'?pause():resume();
  const stopSignals=subscribeOwnSignals(c,actor,`visit-catalog-${crypto.randomUUID()}`,['club_chat_signals'],{ready:()=>{if(live)store.ready();},change:()=>{if(live)flushSync(()=>store.signal());},unavailable:()=>{if(live)flushSync(()=>store.unavailable());}});
  const page=(event:PageTransitionEvent)=>{if(event.persisted)resume();};
  window.addEventListener(CLUB_AUTH_EVENT,local);window.addEventListener('storage',storage);window.addEventListener('focus',resume);window.addEventListener('blur',pause);window.addEventListener('pagehide',pause);window.addEventListener('pageshow',page);window.addEventListener('online',resume);document.addEventListener('visibilitychange',visibility);
  return()=>{live=false;stopSignals();auth?.unsubscribe();window.removeEventListener(CLUB_AUTH_EVENT,local);window.removeEventListener('storage',storage);window.removeEventListener('focus',resume);window.removeEventListener('blur',pause);window.removeEventListener('pagehide',pause);window.removeEventListener('pageshow',page);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',visibility);cleanup.current=setTimeout(()=>store.stop(),0);};
 },[actor,store]);
 return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useCatalogCard(id:string){
 const store=useContext(Context);if(!store)throw new Error('Missing visit catalog provider');
 const subscribe=useMemo(()=> (f:()=>void)=>store.subscribe(id,f),[store,id]);
 const state=useSyncExternalStore(subscribe,()=>store.snapshot(id),store.serverSnapshot),ref=useRef<HTMLElement|null>(null);
 useEffect(()=>{const element=ref.current;if(!element)return;const observer=new IntersectionObserver(rows=>{for(const row of rows)store.visible(id,row.isIntersecting);},{rootMargin:'0px'});observer.observe(element);return()=>{observer.disconnect();store.visible(id,false);};},[store,id]);
 return{state,ref,retry:()=>store.retry(id)};
}
