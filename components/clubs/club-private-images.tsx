'use client';
/* eslint-disable @next/next/no-img-element -- Private, revocable blob URLs must not enter Next's shared image cache. */
import {useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
import {createBlobLease} from '@/lib/clubs/image-lease';
import {createClubPageGuard} from '@/lib/clubs/page-guard';
import {ClubReadError} from '@/lib/clubs/types';
import {clubError} from '@/lib/clubs/membership-types';
import {readImageProfile,downloadClubImage} from '@/lib/clubs/image-client';
import {clubImageGeometry,CLUB_COVER_ASPECT,type ClubImageFrame} from '@/lib/clubs/image-frame';
import {imageText} from '@/lib/clubs/image-i18n';
import {CLUB_AUTH_EVENT,clubAuthPhase} from '@/lib/clubs/auth-events';
import {createClient} from '@/lib/supabase/client';
import type {Locale} from '@/lib/locales';
export function useImageLifecycle(store:{start:()=>void;stop:()=>void;pause:()=>void;revoke:()=>void;refresh?:()=>Promise<void>;verify?:()=>Promise<void>},actor:string){
 useEffect(()=>{store.start();const pause=()=>flushSync(()=>store.pause()),verify=()=>{if(document.visibilityState==='visible'){pause();void(store.refresh?.()??store.verify?.());}},visibility=()=>document.visibilityState==='hidden'?pause():verify(),page=(e:PageTransitionEvent)=>{if(e.persisted)verify();},revoke=()=>flushSync(()=>store.revoke()),transition=(p:string|null)=>{if(p){revoke();if(p==='settled')window.location.reload();}},storage=(e:StorageEvent)=>{if(e.key===CLUB_AUTH_EVENT)transition(clubAuthPhase(e.newValue));},local=(e:Event)=>transition((e as CustomEvent<string>).detail);
 const auth=createClient()?.auth.onAuthStateChange((_e,s)=>{if(s?.user.id!==actor){revoke();window.location.reload();}}).data.subscription;
 window.addEventListener('focus',verify);window.addEventListener('online',verify);window.addEventListener('pagehide',pause);window.addEventListener('pageshow',page);window.addEventListener('storage',storage);window.addEventListener(CLUB_AUTH_EVENT,local);document.addEventListener('visibilitychange',visibility);const timer=setInterval(verify,60000);void(store.refresh?.()??store.verify?.());
 return()=>{store.stop();auth?.unsubscribe();clearInterval(timer);window.removeEventListener('focus',verify);window.removeEventListener('online',verify);window.removeEventListener('pagehide',pause);window.removeEventListener('pageshow',page);window.removeEventListener('storage',storage);window.removeEventListener(CLUB_AUTH_EVENT,local);document.removeEventListener('visibilitychange',visibility);};
 },[store,actor]);
}
export function usePrivateBlobUrl(blob:Blob|null){const lease=useMemo(()=>createBlobLease(),[]),value=useSyncExternalStore(lease.subscribe,lease.getSnapshot,lease.getServerSnapshot);useLayoutEffect(()=>{lease.set(blob);return()=>lease.clear();},[blob,lease]);return value.blob===blob?value.url:null;}
export function FramedBlob({blob,frame,slot,label}:{blob:Blob;frame:ClubImageFrame|null;slot:'cover'|'logo';label:string}){
 const url=usePrivateBlobUrl(blob),container=useRef<HTMLDivElement>(null),[bounds,setBounds]=useState({width:0,height:0}),[size,setSize]=useState<{blob:Blob|null;width:number;height:number}>({blob:null,width:0,height:0});
 useLayoutEffect(()=>{if(!container.current)return;const o=new ResizeObserver(([e])=>setBounds({width:e.contentRect.width,height:e.contentRect.height}));o.observe(container.current);return()=>o.disconnect();},[]);
 const geometry=frame&&size.blob===blob&&size.width&&bounds.width?clubImageGeometry(bounds,size,frame):null;
 return <div ref={container} className={`bike-app-club-image bike-app-club-image-${slot}`} style={{aspectRatio:slot==='cover'?CLUB_COVER_ASPECT:1}}>{url?<img key={url} src={url} alt={label} onLoad={e=>setSize({blob,width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} style={geometry?{position:'absolute',width:geometry.width,height:geometry.height,left:geometry.left,top:geometry.top,maxWidth:'none'}:{width:'100%',height:'100%',objectFit:slot==='logo'?'contain':'cover'}}/>:null}</div>;
}
export function ClubPrivateImages({clubId,locale}:{clubId:string;locale:Locale}){
 const[actor,setActor]=useState<string|null>(null);
 useEffect(()=>{let live=true;void createClient()?.auth.getSession().then(r=>{if(live)setActor(r.data.session?.user.id??null);});return()=>{live=false;};},[]);
 return actor?<AuthorizedImages key={actor+clubId} actor={actor} clubId={clubId} locale={locale}/>:null;
}
function AuthorizedImages({actor,clubId,locale}:{actor:string;clubId:string;locale:Locale}){
 const store=useMemo(()=>createClubPageGuard({userId:actor,identityLost:()=>window.location.reload(),async read(signal){try{const r=await readImageProfile(clubId,signal);if(r.userId!==actor)throw new ClubReadError('auth');const p=r.profile,[cover,logo]=await Promise.all([p.cover_path?downloadClubImage(p.cover_path,actor,signal):null,p.logo_path?downloadClubImage(p.logo_path,actor,signal):null]);return{userId:actor,snapshot:{profile:p,cover,logo}};}catch(e){const k=clubError(e).kind;throw new ClubReadError(k==='auth'?'auth':k==='access'?'access':'network');}}}),[actor,clubId]);
 const s=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);useImageLifecycle(store,actor);
 if(s.status!=='ready'||!s.data)return s.status==='error'?<div className="bike-app-muted" role="status">{imageText(locale,'unavailable')} <button className="bike-app-button bike-app-button-secondary" onClick={()=>void store.verify()}>{imageText(locale,'retry')}</button></div>:null;
 const{profile:p,cover,logo}=s.data;if(!cover&&!logo)return null;
 return <div className="bike-app-club-image-header" data-club-images="ready">{cover?<FramedBlob blob={cover} frame={p.cover_frame as ClubImageFrame|null} slot="cover" label={imageText(locale,'cover')}/>:null}{logo?<FramedBlob blob={logo} frame={p.logo_frame as ClubImageFrame|null} slot="logo" label={imageText(locale,'logo')}/>:null}</div>;
}
