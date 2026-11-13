'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {createImageStore} from '@/lib/clubs/image-store';
import {normalizeImageForBrowser} from '@/lib/clubs/image-browser';
import {readImageProfile,downloadClubImage} from '@/lib/clubs/image-client';
import {imageText} from '@/lib/clubs/image-i18n';
import {profileText} from '@/lib/clubs/profile-i18n';
import {ClubError,clubResponseError} from '@/lib/clubs/membership-types';
import {CLUB_IMAGE_SOURCE_LIMIT,type ImageSlot} from '@/lib/clubs/image-contract';
import {AppPageHeader,AppPanel} from '@/components/app-ui';
import {FramedBlob,ClubPrivateImages,useImageLifecycle} from './club-private-images';
import type {Locale} from '@/lib/locales';
export function ClubImageEditor({actor,clubId,locale}:{actor:string;clubId:string;locale:Locale}){
 const t=(k:Parameters<typeof imageText>[1])=>imageText(locale,k),p=(k:Parameters<typeof profileText>[1])=>profileText(locale,k),focus=useRef<string|null>(null),notice=useRef<HTMLParagraphElement>(null),selectionRevision=useRef<Partial<Record<ImageSlot,number>>>({});
 const store=useMemo(()=>createImageStore({actor,clubId,key:()=>crypto.randomUUID(),identityLost:()=>window.location.reload(),read:signal=>readImageProfile(clubId,signal,true),
  async prepare(slot,file,signal){if(file.size>CLUB_IMAGE_SOURCE_LIMIT)throw new ClubError('image');const normalized=await normalizeImageForBrowser(file,slot,signal);const f=new FormData();f.set('mode','prepare');f.set('actorId',actor);f.set('clubId',clubId);f.set('slot',slot);f.set('file',normalized,'source');const r=await fetch('/api/clubs/images',{method:'POST',body:f,credentials:'same-origin',cache:'no-store',signal});if(!r.ok){const b=await r.json();throw b.error==='image'?new ClubError('image'):clubResponseError(b.error);}return r.blob();},
  async upload(c,blob,signal){const f=new FormData();f.set('mode','upload');f.set('actorId',actor);f.set('clubId',clubId);f.set('slot',c.slot);f.set('imageId',c.imageId!);f.set('file',blob,c.slot==='cover'?'cover.jpg':'logo.png');const r=await fetch('/api/clubs/images',{method:'POST',body:f,credentials:'same-origin',cache:'no-store',signal});const b=await r.json();if(!r.ok)throw b.error==='image'?new ClubError('image'):clubResponseError(b.error);if(b.userId!==actor)throw new ClubError('auth');if(typeof b.path!=='string')throw new ClubError('network');},
  async save(c,signal){const r=await fetch('/api/clubs/images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c),credentials:'same-origin',cache:'no-store',signal});const b=await r.json();if(!r.ok)throw b.error==='image'?new ClubError('image'):clubResponseError(b.error);return b;}
 }),[actor,clubId]);
 const state=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);useImageLifecycle(store,actor);
 useEffect(()=>store.subscribe(()=>{if(store.getSnapshot().status!=='ready'){const a=document.activeElement;if(a?.id)focus.current=a.id;}}),[store]);
 useLayoutEffect(()=>{if(state.status==='ready'&&focus.current&&document.activeElement===document.body){document.getElementById(focus.current)?.focus({preventScroll:true});focus.current=null;}},[state.status]);
 useEffect(()=>{if(state.error||state.conflict)notice.current?.focus({preventScroll:true});},[state.error,state.conflict,state.status]);
 const choice=state.choice,locked=state.busy||!!state.pending,selectionKey=choice?(choice.id??choice.sourcePath):null,selectedSlot=choice?.slot;
 useEffect(()=>{if(selectionKey)document.getElementById(selectedSlot==='logo'?'image-whole':'image-zoom')?.focus({preventScroll:true});},[selectionKey,selectedSlot]);
 async function existing(slot:ImageSlot){const path=slot==='cover'?state.profile?.cover_path:state.profile?.logo_path;if(!path||locked)return;await store.chooseExisting(slot,signal=>downloadClubImage(path,actor,signal));}
 return <div data-club-image-access={state.status}><AppPageHeader title={t('title')} intro={t('note')}/><a className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/clubs/${clubId}`}>{p('cancel')}</a>
 {/* Neutral file inputs stay mounted during fresh checks, so a native
     picker returning focus cannot detach its change event. Images still unmount. */}
 {state.status!=='auth'&&state.status!=='access'?<div hidden={state.status!=='ready'}> <div className="bike-app-grid" data-columns="2">{(['cover','logo'] as const).map(slot=><AppPanel key={slot} title={t(slot)}><label className="bike-app-field"><span>{t('choose')}</span><input id={"club-image-file-"+slot} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" aria-label={t(slot)+' — '+t('choose')} disabled={locked} onClick={()=>{selectionRevision.current[slot]=state.profile?.profile_revision;}} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void store.choose(slot,f,selectionRevision.current[slot]);}}/></label>{(slot==='cover'?state.profile?.cover_path:state.profile?.logo_path)?<button className="bike-app-button bike-app-button-secondary bike-app-section-gap" disabled={locked} onClick={()=>void existing(slot)}>{t('crop')}</button>:null}</AppPanel>)}</div></div>:null}
 {state.status==='auth'||state.status==='access'?<p role="alert">{p('access')}</p>:state.status==='error'?<div role="alert"><p>{t('unavailable')}</p><button className="bike-app-button" onClick={()=>void store.refresh()}>{t('retry')}</button></div>:state.status!=='ready'?<p role="status">{p('loading')}</p>:<>
 <div aria-label={p("current")}><ClubPrivateImages key={String(state.profile?.profile_revision)} clubId={clubId} locale={locale} shape={state.profile?.cover_path?'cover':state.profile?.logo_path?'logo':'none'}/></div>
 {state.error||state.conflict?<p ref={notice} tabIndex={-1} role="alert">{state.conflict?p('conflict'):state.pending?t('unknown'):state.error==='image'||state.error==='invalid'?t('invalid'):p('network')}</p>:null}
 {state.conflict&&state.profile?<AppPanel title={p('current')}><strong>{state.profile.name}</strong><p className="bike-app-club-description">{state.profile.description}</p><button className="bike-app-button" disabled={locked} onClick={()=>store.rebase()}>{p('continue')}</button></AppPanel>:null}
 {state.saved?<p role="status">{t('saved')}</p>:null}<p className="bike-app-muted">{t('rules')}</p>

 {choice?<AppPanel title={t('preview')} className="bike-app-section-gap"><div className="bike-app-club-crop-preview"><FramedBlob blob={choice.blob} frame={choice.frame} slot={choice.slot} label={t('preview')}/></div>
 <fieldset disabled={locked} className="bike-app-club-form-fields bike-app-form">{choice.slot==='logo'?<label><input id="image-whole" type="checkbox" checked={choice.frame.whole} onChange={e=>store.frame({zoom:1,x:0,y:0,whole:e.target.checked})}/>{t('whole')}</label>:null}{(['zoom','x','y'] as const).map((field,i)=><label className="bike-app-field" key={field} htmlFor={'image-'+field}><span>{t(i===0?'zoom':i===1?'horizontal':'vertical')} {choice.frame[field].toFixed(2)}</span><input id={'image-'+field} type="range" min={i===0?1:-1} max={i===0?4:1} step="0.01" value={choice.frame[field]} disabled={choice.frame.whole} onChange={e=>store.frame({...choice.frame,[field]:Number(e.target.value)})}/></label>)}</fieldset>
 <div className="bike-app-actions"><button className="bike-app-button" disabled={state.busy||state.conflict} onClick={()=>void store.submit()}>{state.operation==='save'?p('saving'):state.pending?p('retryAction'):t('save')}</button><button className="bike-app-button bike-app-button-secondary" disabled={locked} onClick={()=>store.discard()}>{p('cancel')}</button></div></AppPanel>:null}
 {state.busy?<p role="status">{t(state.operation==='prepare'?'preparing':'busy')}</p>:null}
 </>}
 </div>;
}
