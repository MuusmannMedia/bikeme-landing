import {notFound} from 'next/navigation';
import {clubPageContext} from '@/lib/clubs/server';
import {VisitManagement} from '@/components/clubs/visits/management';
import {isLocale} from '@/lib/locales';
import {visitsEnabled} from '@/lib/clubs/visits/api';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{locale:string;clubId:string}>}){const{locale,clubId}=await params;if(!isLocale(locale)||!visitsEnabled(process.env))notFound();const{userId}=await clubPageContext(locale,`/${locale}/app/clubs/${clubId}/visitors`);return <VisitManagement userId={userId} clubId={clubId} locale={locale}/>;}
