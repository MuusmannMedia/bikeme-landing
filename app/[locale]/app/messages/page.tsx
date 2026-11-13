import {notFound} from 'next/navigation';
import {MessagesBoundary} from '@/components/messages/boundary';
import {messagesContext} from '@/lib/messages/server';
import {isLocale} from '@/lib/locales';
import {isClubId} from '@/lib/clubs/types';
export const dynamic='force-dynamic';
export default async function MessagesPage({params,searchParams}:{params:Promise<{locale:string;conversationId?:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const {locale,conversationId}=await params;if(!isLocale(locale)||conversationId&&!isClubId(conversationId))notFound();const values=await searchParams,peer=!conversationId&&typeof values.peer==='string'&&isClubId(values.peer)?values.peer:null;const path=`/${locale}/app/messages${conversationId?`/${conversationId}`:''}${peer?`?peer=${peer}`:''}`;const {userId}=await messagesContext(locale,path);return <MessagesBoundary key={userId+(conversationId??'inbox')+(peer??'')} userId={userId} conversationId={conversationId??null} peer={peer} locale={locale}/>;}
