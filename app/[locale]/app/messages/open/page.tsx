import {notFound,redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {buildLoginPath} from '@/lib/auth';
import {isLocale} from '@/lib/locales';
import {isClubId} from '@/lib/clubs/types';
import {dmText} from '@/lib/messages/i18n';
export const dynamic='force-dynamic';
export default async function OpenPush({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{conversation?:string;message?:string}>}){const {locale}=await params,q=await searchParams;if(!isLocale(locale)||!isClubId(q.conversation??'')||!isClubId(q.message??''))notFound();const target=`/${locale}/app/messages/open?conversation=${q.conversation}&message=${q.message}`,client=await createClient(),auth=await client.auth.getUser();if(!auth.data.user)redirect(buildLoginPath(locale,target,'expired'));const r=await client.rpc('dm_push_open',{p_conversation:q.conversation,p_message:q.message});if(r.error)return <p role="alert">{dmText(locale,'access')}</p>;redirect(`/${locale}/app/messages/${q.conversation}?message=${q.message}`);}
