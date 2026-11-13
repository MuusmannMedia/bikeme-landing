import {notFound} from 'next/navigation';
import {ClubProfileForm} from '@/components/clubs/club-profile-form';
import {clubPageContext} from '@/lib/clubs/server';
import {isLocale} from '@/lib/locales';
export const dynamic='force-dynamic';
export default async function NewClub({params}:{params:Promise<{locale:string}>}){const{locale}=await params;if(!isLocale(locale))notFound();const{userId}=await clubPageContext(locale,`/${locale}/app/clubs/new`);return <ClubProfileForm key={locale+userId} userId={userId} locale={locale}/>;}
