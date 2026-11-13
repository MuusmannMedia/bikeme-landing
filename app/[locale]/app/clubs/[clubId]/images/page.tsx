import {notFound} from 'next/navigation';
import {ClubImageEditor} from '@/components/clubs/club-image-editor';
import {ClubAccessDenied,ClubReadFailure} from '@/components/clubs/club-ui';
import {clubPageContext} from '@/lib/clubs/server';
import {createClubProfileApi} from '@/lib/clubs/profile-api';
import {profileEditingEnabled} from '@/lib/clubs/profile-contract';
import {clubError} from '@/lib/clubs/membership-types';
import {createClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/locales';
export const dynamic='force-dynamic';
export default async function ClubImages({params}:{params:Promise<{locale:string;clubId:string}>}){const{locale,clubId}=await params;if(!isLocale(locale))notFound();const path=`/${locale}/app/clubs/${encodeURIComponent(clubId)}/images`,{userId}=await clubPageContext(locale,path);if(!profileEditingEnabled(process.env))notFound();try{await createClubProfileApi(await createClient(),userId,true).profile(clubId);}catch(e){return clubError(e).kind==='access'?<ClubAccessDenied locale={locale}/>:<ClubReadFailure locale={locale} kind="network" retryHref={path}/>;}return <ClubImageEditor key={userId+clubId+locale} actor={userId} clubId={clubId} locale={locale}/>;}
