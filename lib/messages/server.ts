import 'server-only';
import {redirect} from 'next/navigation';
import {buildLoginPath} from '../auth';
import {createClient} from '../supabase/server';
import type {Locale} from '../locales';
export async function messagesContext(locale:Locale,returnTo:string){const client=await createClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)redirect(buildLoginPath(locale,returnTo,'expired'));return{userId:auth.data.user.id};}
