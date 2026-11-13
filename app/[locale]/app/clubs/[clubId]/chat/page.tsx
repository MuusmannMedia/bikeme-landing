import {notFound} from 'next/navigation';
import {ClubChatBoundary} from '@/components/clubs/club-chat-boundary';
import {clubPageContext} from '@/lib/clubs/server';
import {isLocale} from '@/lib/locales';
import {isClubId} from '@/lib/clubs/types';
export const dynamic='force-dynamic';
export default async function ChatPage({params,searchParams}:{params:Promise<{locale:string;clubId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const {locale,clubId}=await params;if(!isLocale(locale)||!isClubId(clubId))notFound();const values=await searchParams,message=typeof values.message==='string'&&isClubId(values.message)?values.message:null;const path=`/${locale}/app/clubs/${clubId}/chat`+(message?`?message=${message}`:'');const {userId}=await clubPageContext(locale,path);return <ClubChatBoundary key={userId+clubId} userId={userId} clubId={clubId} locale={locale} initialMessage={message}/>;}
