'use client';
import {imageText} from "@/lib/clubs/image-i18n";
import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import {createProfileStore} from '@/lib/clubs/profile-store';
import {ClubError,clubResponseError} from '@/lib/clubs/membership-types';
import {profileText} from '@/lib/clubs/profile-i18n';
import {CLUB_AUTH_EVENT,clubAuthPhase} from '@/lib/clubs/auth-events';
import {createClient} from '@/lib/supabase/client';
import {AppPageHeader,AppPanel} from '@/components/app-ui';
import type {Locale} from '@/lib/locales';
export function ClubProfileForm({userId,clubId,locale}:{userId:string;clubId?:string;locale:Locale}){
 const t=(key:Parameters<typeof profileText>[1])=>profileText(locale,key),base=`/${locale}/app/clubs`;
 const store=useMemo(()=>{const next=createProfileStore({actor:userId,clubId,key:()=>crypto.randomUUID(),identityLost:()=>{flushSync(()=>next.revoke());window.location.reload();},
  async read(signal){const r=await fetch('/api/clubs/profile'+(clubId?'?clubId='+encodeURIComponent(clubId):''),{cache:'no-store',credentials:'same-origin',signal});const data=await r.json();if(!r.ok)throw clubResponseError(data.error);if(typeof data.userId!=='string'||!('profile' in data))throw new ClubError('network');return data;},
  async send(command,signal){const r=await fetch('/api/clubs/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store',credentials:'same-origin',signal});const data=await r.json();if(!r.ok)throw clubResponseError(data.error);return data;}
 });return next;},[userId,clubId]);
 const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot),focus=useRef<{id:string;start:number|null;end:number|null}|null>(null),message=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{
  store.start();const pause=()=>{const el=document.activeElement;if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)focus.current={id:el.id,start:el.selectionStart,end:el.selectionEnd};flushSync(()=>store.pause());};
  const verify=()=>{if(document.visibilityState==='visible'){pause();void store.refresh();}};
  const visibility=()=>document.visibilityState==='hidden'?pause():verify();
  const page=(e:PageTransitionEvent)=>{if(e.persisted)verify();};
  const revoke=()=>{focus.current=null;flushSync(()=>store.revoke());};
  const transition=(phase:string|null)=>{if(phase){revoke();if(phase==='settled')window.location.reload();}};
  const storage=(e:StorageEvent)=>{if(e.key===CLUB_AUTH_EVENT)transition(clubAuthPhase(e.newValue));},local=(e:Event)=>transition((e as CustomEvent<string>).detail);
  const auth=createClient()?.auth.onAuthStateChange((_event,session)=>{if(session?.user.id!==userId){revoke();window.location.reload();}}).data.subscription;
  window.addEventListener('focus',verify);window.addEventListener('online',verify);window.addEventListener('pagehide',pause);window.addEventListener('pageshow',page);window.addEventListener('storage',storage);window.addEventListener(CLUB_AUTH_EVENT,local);document.addEventListener('visibilitychange',visibility);const timer=setInterval(verify,60000);void store.refresh();
  return()=>{store.stop();auth?.unsubscribe();clearInterval(timer);window.removeEventListener('focus',verify);window.removeEventListener('online',verify);window.removeEventListener('pagehide',pause);window.removeEventListener('pageshow',page);window.removeEventListener('storage',storage);window.removeEventListener(CLUB_AUTH_EVENT,local);document.removeEventListener('visibilitychange',visibility);};
 },[store,userId]);
 useEffect(()=>{if(state.status==='ready'&&state.savedId&&document.visibilityState==='visible')window.location.assign(`${base}/${state.savedId}`);},[state.status,state.savedId,base]);
 useEffect(()=>{if(state.status==='ready'&&focus.current&&document.activeElement===document.body){const f=focus.current,el=document.getElementById(f.id);if(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement){el.focus({preventScroll:true});el.setSelectionRange(f.start,f.end);}focus.current=null;}},[state.status]);
 useEffect(()=>{if(state.error||state.conflict)message.current?.focus({preventScroll:true});},[state.error,state.conflict,state.status]);
 const ready=state.status==='ready',locked=state.busy||!!state.pending;
 return <section data-club-profile-access={state.status} data-club-profile-data={state.profile?'present':'empty'}>
  <AppPageHeader eyebrow="Bike Me" title={t(clubId?'edit':'create')} intro={t(clubId?'editIntro':'intro')}/>
  <div className="bike-app-actions"><a className="bike-app-button bike-app-button-secondary" href={clubId?`${base}/${clubId}`:base}>{t('cancel')}</a>
  {clubId&&state.status==='ready'?<a className="bike-app-button bike-app-button-secondary" href={`${base}/${clubId}/images`}>{imageText(locale,'title')}</a>:null}</div>
  {state.status==='access'||state.status==='auth'?<p role="alert">{t('access')}</p>:state.status==='error'?<div role="alert"><p>{t('network')}</p><button className="bike-app-button" onClick={()=>void store.refresh()}>{t('retry')}</button></div>:!ready?<p role="status">{t('loading')}</p>:<AppPanel title={t(clubId?'edit':'create')} className="bike-app-section-gap">
   {state.error||state.conflict?<p ref={message} tabIndex={-1} role="alert">{t(state.conflict?'conflict':state.pending?'unknown':state.error==='invalid'?'invalid':'network')}</p>:null}
   {state.conflict&&state.profile?<section aria-label={t('current')} className="bike-app-panel bike-app-section-gap"><h3>{t('current')}</h3><strong>{state.profile.name}</strong><p className="bike-app-club-description">{state.profile.description}</p><button type="button" className="bike-app-button bike-app-button-secondary" onClick={()=>{store.rebase();document.getElementById('club-profile-name')?.focus();}}>{t('continue')}</button></section>:null}
   <form className="bike-app-form" onSubmit={e=>{e.preventDefault();void store.submit();}} aria-busy={state.busy}>
    <fieldset disabled={locked} className="bike-app-club-form-fields bike-app-form">
     <label className="bike-app-field" htmlFor="club-profile-name">{t('name')}<input id="club-profile-name" required autoComplete="off" style={{fontSize:16}} aria-describedby="club-profile-rules" value={state.draft?.name??''} onChange={e=>store.text('name',e.target.value)}/></label>
     <label className="bike-app-field" htmlFor="club-profile-description">{t('description')}<textarea id="club-profile-description" rows={5} style={{fontSize:16}} aria-describedby="club-profile-rules" value={state.draft?.description??''} onChange={e=>store.text('description',e.target.value)}/></label>
    </fieldset>
    <p id="club-profile-rules" className="bike-app-muted">{t('rules')} {Array.from(state.draft?.name??'').length} / 80 · {Array.from(state.draft?.description??'').length} / 1000</p>
    {state.pending&&!state.busy?<button type="button" className="bike-app-button" onClick={()=>void store.submit(true)}>{t('retryAction')}</button>:<button type="submit" className="bike-app-button" disabled={locked||state.conflict}>{t(state.busy?'saving':clubId?'save':'create')}</button>}
    {state.busy?<p role="status">{t('saving')}</p>:null}
   </form>
  </AppPanel>}
 </section>;
}
