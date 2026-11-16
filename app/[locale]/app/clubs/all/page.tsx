import {notFound} from 'next/navigation';
import {ClubSessionBoundary} from '@/components/clubs/club-session-boundary';
import {clubPageContext} from '@/lib/clubs/server';
import {isLocale} from '@/lib/locales';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;if(!isLocale(locale))notFound();
 const {userId}=await clubPageContext(locale,`/${locale}/app/clubs/all`);
 return <ClubSessionBoundary key={locale+userId+'all'} userId={userId} locale={locale} directory="all"/>;
}
