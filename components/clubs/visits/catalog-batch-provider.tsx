'use client';
import {createContext,useContext,useEffect,useLayoutEffect,useMemo,useRef,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {flushSync} from 'react-dom';
import {createBatchCatalogStore,CatalogRetry,type Manifest,type MediaItem,type CatalogProfile} from '@/lib/clubs/visits/catalog-batch-store';
import {VisitError} from '@/lib/clubs/visits/contract';
import {createClient} from '@/lib/supabase/client';
import {subscribeOwnSignals} from '@/lib/realtime/own-signals';
import {CLUB_AUTH_EVENT} from '@/lib/clubs/auth-events';
function retrySeconds(value:string|null){const n=Number(value);return Math.max(1,Number.isFinite(n)&&n>0?n:Math.ceil((Date.parse(value??'')-Date.now())/1000)||61);}
export const BatchCatalogContext=createContext<ReturnType<typeof createBatchCatalogStore>|null>(null);
export function BatchCatalogProvider({actor,children}:{actor:string;children:ReactNode}){
 const path=usePathname(),cleanup=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const store=useMemo(()=>{
  async function call(body:object,signal:AbortSignal){const r=await fetch('/api/clubs/visits/catalog',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',signal,body:JSON.stringify({...body,actorId:actor})});
   if(r.status===429){throw new CatalogRetry(retrySeconds(r.headers.get('Retry-After')));}
   if(r.status===401)throw new VisitError('auth');if(r.status===403)throw new VisitError('access');if(!r.ok)throw new VisitError(r.status===409?'conflict':'network');return r.json();}
  return createBatchCatalogStore({actor,identityLost:()=>window.location.reload(),manifest:(ids,signal)=>call({op:'manifest',ids},signal) as Promise<Manifest>,media:(profiles:CatalogProfile[],signal)=>call({op:'media',items:profiles.map(p=>({club_id:p.id,revision:p.revision,cover_revision:p.cover_revision,logo_revision:p.logo_revision}))},signal) as Promise<{userId:string;items:MediaItem[]}>});
 },[actor]);
 useEffect(()=>{
  clearTimeout(cleanup.current);const client=createClient(),revoke=()=>flushSync(()=>store.revoke());
  const auth=client?.auth.onAuthStateChange((_event,s)=>{if(s?.user.id!==actor)revoke();}).data.subscription;
  const stop=subscribeOwnSignals(client,actor,`catalog-${crypto.randomUUID()}`,['club_visit_catalog_signals'],{ready:()=>store.ready(),unavailable:()=>flushSync(()=>store.unavailable()),change:()=>flushSync(()=>store.signal())});
  const pause=()=>{store.suspend(document.visibilityState==='hidden');if(document.visibilityState==='hidden')flushSync(()=>store.conceal());};
  const resume=()=>{if(document.visibilityState==='visible'&&document.hasFocus())flushSync(()=>store.resume());};
  const visibility=()=>document.visibilityState==='hidden'?pause():resume();
  const storage=(e:StorageEvent)=>{if(e.key===CLUB_AUTH_EVENT)revoke();};
  const pageshow=(e:PageTransitionEvent)=>{if(e.persisted){store.suspend(true);resume();}};
  window.addEventListener(CLUB_AUTH_EVENT,revoke);window.addEventListener('storage',storage);window.addEventListener('blur',pause);window.addEventListener('focus',resume);window.addEventListener('pagehide',pause);window.addEventListener('pageshow',pageshow);document.addEventListener('visibilitychange',visibility);
  return()=>{stop();auth?.unsubscribe();window.removeEventListener(CLUB_AUTH_EVENT,revoke);window.removeEventListener('storage',storage);window.removeEventListener('blur',pause);window.removeEventListener('focus',resume);window.removeEventListener('pagehide',pause);window.removeEventListener('pageshow',pageshow);document.removeEventListener('visibilitychange',visibility);cleanup.current=setTimeout(()=>store.stop(),0);};
 },[actor,store]);
 useLayoutEffect(()=>{if(path.endsWith('/clubs/all'))store.enter();},[path,store]);
 return <BatchCatalogContext.Provider value={store}>{children}</BatchCatalogContext.Provider>;
}
// Only route view state, never bytes or protected snapshots, is restored here.
export function useCatalogView(profiles:Record<string,unknown>,active:boolean){const store=useContext(BatchCatalogContext),idKey=Object.keys(profiles).join(',');
 useEffect(()=>{if(active&&store)store.configure(idKey? idKey.split(','):[],profiles as Record<string,CatalogProfile>);// profiles is a seed for a new ID scope only; live revisions arrive through fresh manifests.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[store,idKey,active]);
 return store;
}
