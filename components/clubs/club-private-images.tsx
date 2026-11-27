'use client';
/* eslint-disable @next/next/no-img-element -- Private, revocable blob URLs must not enter Next's shared image cache. */
import {useEffect,useLayoutEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {createAccessRefresh} from '@/lib/clubs/access-refresh';
import {useParentAccess} from './stable-access-region';
import {createBlobLease} from '@/lib/clubs/image-lease';
import {createClubPageGuard} from '@/lib/clubs/page-guard';
import {ClubReadError} from '@/lib/clubs/types';
import {clubError} from '@/lib/clubs/membership-types';
import {readImageProfile,downloadClubImage} from '@/lib/clubs/image-client';
import {clubImageGeometry,clubLogoSlot,CLUB_COVER_ASPECT,type ClubImageFrame} from '@/lib/clubs/image-frame';
import {imageText} from '@/lib/clubs/image-i18n';
import {CLUB_AUTH_EVENT,clubAuthPhase} from '@/lib/clubs/auth-events';
import {createClient} from '@/lib/supabase/client';
import type {ClubImageShape} from '@/lib/clubs/types';
import type {Locale} from '@/lib/locales';
export function useImageLifecycle(store:{start:()=>void;stop:()=>void;pause:()=>void;revoke:()=>void;refresh?:()=>Promise<void>;verify?:()=>Promise<void>},actor:string){
 const managed=useParentAccess();
 useEffect(()=>{store.start();const read=async()=>{await(store.refresh?.()??store.verify?.());};
 if(managed){void read();return()=>store.stop();}
 let initial=true;const refresh=createAccessRefresh({visible:()=>document.visibilityState==='visible',focused:()=>document.hasFocus(),pause:()=>{if(initial)store.pause();else flushSync(()=>store.pause());},verify:read}),verify=()=>refresh.resume(),pause=()=>refresh.suspend(),visibility=()=>document.visibilityState==='hidden'?pause():verify(),page=(e:PageTransitionEvent)=>{if(e.persisted)verify();},revoke=()=>{refresh.stop();flushSync(()=>store.revoke());},transition=(p:string|null)=>{if(p){revoke();if(p==='settled')window.location.reload();}},storage=(e:StorageEvent)=>{if(e.key===CLUB_AUTH_EVENT)transition(clubAuthPhase(e.newValue));},local=(e:Event)=>transition((e as CustomEvent<string>).detail);
 const auth=createClient()?.auth.onAuthStateChange((_e,s)=>{if(s?.user.id!==actor){revoke();window.location.reload();}}).data.subscription;
 window.addEventListener('focus',verify);window.addEventListener('blur',pause);window.addEventListener('online',refresh.check);window.addEventListener('pagehide',pause);window.addEventListener('pageshow',page);window.addEventListener('storage',storage);window.addEventListener(CLUB_AUTH_EVENT,local);document.addEventListener('visibilitychange',visibility);const timer=setInterval(refresh.check,60000);refresh.check();initial=false;
 return()=>{refresh.stop();store.stop();auth?.unsubscribe();clearInterval(timer);window.removeEventListener('focus',verify);window.removeEventListener('blur',pause);window.removeEventListener('online',refresh.check);window.removeEventListener('pagehide',pause);window.removeEventListener('pageshow',page);window.removeEventListener('storage',storage);window.removeEventListener(CLUB_AUTH_EVENT,local);document.removeEventListener('visibilitychange',visibility);};
 },[store,actor,managed]);
}
export function usePrivateBlobUrl(blob:Blob|null){const lease=useMemo(()=>createBlobLease(),[]),value=useSyncExternalStore(lease.subscribe,lease.getSnapshot,lease.getServerSnapshot);useLayoutEffect(()=>{lease.set(blob);return()=>lease.clear();},[blob,lease]);return value.blob===blob?value.url:null;}
export function FramedBlob({blob,frame,slot,label}:{blob:Blob;frame:ClubImageFrame|null;slot:'cover'|'logo';label:string}){
 const url=usePrivateBlobUrl(blob);
 return <FramedImage url={url} frame={frame} slot={slot} label={label}/>;
}
function FramedImage({url,frame,slot,label}:{url:string|null;frame:ClubImageFrame|null;slot:'cover'|'logo';label:string}){
 const container=useRef<HTMLDivElement>(null),[bounds,setBounds]=useState({width:0,height:0}),[size,setSize]=useState<{url:string|null;width:number;height:number}>({url:null,width:0,height:0});
 useLayoutEffect(()=>{if(!container.current)return;const o=new ResizeObserver(([e])=>setBounds({width:e.contentRect.width,height:e.contentRect.height}));o.observe(container.current);return()=>o.disconnect();},[]);
 // Existing cropped logos retain the iOS square crop inside the wider web slot.
 // Whole-logo mode can use the full 2:1 viewport without stretching the image.
 const logoSlot=slot==='logo'?clubLogoSlot(bounds,frame):null;
 const viewport=logoSlot?.viewport??bounds;
 const framed=frame&&size.url===url&&size.width&&bounds.width?clubImageGeometry(viewport,size,frame):null;
 const geometry=framed&&slot==='logo'&&frame?.whole?{...framed,left:0}:framed;
 return <div ref={container} className={`bike-app-club-image bike-app-club-image-${slot}`} style={{aspectRatio:slot==='cover'?CLUB_COVER_ASPECT:2}}><div style={{position:'absolute',inset:0,left:logoSlot?.left??0,right:logoSlot?.right??0,overflow:'hidden',borderRadius:'inherit'}}>{url?<img key={url} src={url} alt={label} onLoad={e=>setSize({url,width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} style={geometry?{position:'absolute',width:geometry.width,height:geometry.height,left:geometry.left,top:geometry.top,maxWidth:'none'}:{width:'100%',height:'100%',objectFit:slot==='logo'?'contain':'cover',objectPosition:slot==='logo'?'left center':undefined}}/>:null}</div></div>;
}
type ImageProps = {clubId:string;locale:Locale;shape:ClubImageShape;revision?:number};

export function ClubPrivateImages(props: ImageProps) {
 return <SessionImages {...props}/>;
}

function SessionImages({clubId,locale,shape,revision}:ImageProps){
 const[actor,setActor]=useState<string|null>(null);
 useEffect(()=>{let live=true;void createClient()?.auth.getSession().then(r=>{if(live)setActor(r.data.session?.user.id??null);});return()=>{live=false;};},[]);
 return actor?<AuthorizedImages key={actor+clubId} actor={actor} clubId={clubId} locale={locale} shape={shape} revision={revision}/>:<ImagePlaceholder shape={shape}/>;
}
function ImagePlaceholder({shape,children}:{shape:ClubImageShape;children?:React.ReactNode}){return shape==='none'?children?<div className="bike-app-image-empty-feedback">{children}</div>:null:<div className="bike-app-club-image-header" data-club-images="neutral"><div className={`bike-app-club-image bike-app-club-image-${shape}`} style={{aspectRatio:shape==='cover'?CLUB_COVER_ASPECT:1}} aria-hidden="true"/>{children?<div className="bike-app-image-feedback">{children}</div>:null}</div>;}
function AuthorizedImages({actor,clubId,locale,shape,revision}:{actor:string;clubId:string;locale:Locale;shape:ClubImageShape;revision?:number}){
 const store=useMemo(()=>{const guard=createClubPageGuard<{profile:Awaited<ReturnType<typeof readImageProfile>>["profile"];cover:Blob|null;logo:Blob|null}>({userId:actor,identityLost:()=>window.location.reload(),async read(signal):Promise<{userId:string;snapshot:{profile:Awaited<ReturnType<typeof readImageProfile>>["profile"];cover:Blob|null;logo:Blob|null}}>{try{const r=await readImageProfile(clubId,signal);if(r.userId!==actor)throw new ClubReadError('auth');const p=r.profile,old=guard.getSnapshot().data,[cover,logo]=await Promise.all([p.cover_path?(old?.profile.cover_path===p.cover_path&&old.cover?old.cover:downloadClubImage(p.cover_path,actor,signal)):null,p.logo_path?(old?.profile.logo_path===p.logo_path&&old.logo?old.logo:downloadClubImage(p.logo_path,actor,signal)):null]);return{userId:actor,snapshot:{profile:p,cover,logo}};}catch(e){const k=clubError(e).kind;throw new ClubReadError(k==='auth'?'auth':k==='access'?'access':'network');}}});return guard;},[actor,clubId]);
 const s=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);useImageLifecycle(store,actor);
 const previousRevision=useRef(revision);useEffect(()=>{if(previousRevision.current!==revision){previousRevision.current=revision;void store.verify(true);}},[revision,store]);
 if(s.status!=='ready'||!s.data)return <ImagePlaceholder shape={shape}>{s.status==='error'?<div className="bike-app-muted" role="status">{imageText(locale,'unavailable')} <button className="bike-app-button bike-app-button-secondary" onClick={()=>void store.verify()}>{imageText(locale,'retry')}</button></div>:null}</ImagePlaceholder>;
 const{profile:p,cover,logo}=s.data;if(!cover&&!logo)return null;
 return <div className="bike-app-club-image-header" data-club-images="ready">{cover?<FramedBlob blob={cover} frame={p.cover_frame as ClubImageFrame|null} slot="cover" label={imageText(locale,'cover')}/>:null}{logo?<FramedBlob blob={logo} frame={p.logo_frame as ClubImageFrame|null} slot="logo" label={imageText(locale,'logo')}/>:null}</div>;
}
