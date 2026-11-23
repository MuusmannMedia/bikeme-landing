'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useSyncExternalStore,type ReactNode} from 'react';
import {createClient} from '@/lib/supabase/client';
import {subscribeOwnSignals} from '@/lib/realtime/own-signals';
import {CLUB_AUTH_EVENT} from '@/lib/clubs/auth-events';
import {createUnreadApi,createUnreadStore,emptyUnread,type Unread} from '@/lib/messages/unread';
import {messageText} from '@/lib/messages/web-i18n';
import type {Locale} from '@/lib/locales';
const Context=createContext<{data:Unread;refresh:()=>void}>({data:emptyUnread(),refresh:()=>{}});
export function UnreadProvider({actor,children}:{actor:string;children:ReactNode}){const store=useMemo(()=>{const client=createClient();return createUnreadStore(async()=>{if(!client)throw Error();return createUnreadApi(client,actor).read();});},[actor]);const state=useSyncExternalStore(store.subscribe,store.getSnapshot,emptyUnreadSnapshot);
 useEffect(()=>{const client=createClient();let stop=()=>{},revoked=false;const reset=()=>{stop();store.active(false);},start=()=>{reset();if(revoked||document.visibilityState!=='visible')return;store.active(true);stop=subscribeOwnSignals(client,actor,'web-unread-'+crypto.randomUUID(),['private_message_signals','club_chat_signals'],{ready:()=>void store.refresh(),change:()=>void store.refresh(),unavailable:()=>store.active(false)});};const auth=client?.auth.onAuthStateChange((_e,s)=>{if(s?.user.id!==actor){revoked=true;reset();}}).data.subscription;const revoke=()=>{revoked=true;reset();};const storage=(e:StorageEvent)=>{if(e.key===CLUB_AUTH_EVENT)revoke();};const visibility=()=>document.visibilityState==='visible'?start():reset();start();document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',start);window.addEventListener('online',start);window.addEventListener(CLUB_AUTH_EVENT,revoke);window.addEventListener('storage',storage);const poll=setInterval(()=>{if(!revoked&&document.visibilityState==='visible'){store.active(true);void store.refresh();}},30000);return()=>{reset();auth?.unsubscribe();clearInterval(poll);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',start);window.removeEventListener('online',start);window.removeEventListener(CLUB_AUTH_EVENT,revoke);window.removeEventListener('storage',storage);};},[store,actor]);
 const refresh=useCallback(()=>void store.refresh(),[store]);
 return <Context.Provider value={{data:state,refresh}}>{children}</Context.Provider>;}
const empty=emptyUnread();function emptyUnreadSnapshot(){return empty;}
export const useUnread=()=>useContext(Context);
export function UnreadBadge({locale,conversation,club,total=false}:{locale:Locale;conversation?:string;club?:string;total?:boolean}){const {data}=useUnread();const count=total?data.total:conversation?data.conversations[conversation]??0:club?data.clubs[club]??0:0;return data.supported&&count>0?<span className="bike-message-badge" aria-label={messageText(locale,'unread').replace('{count}',String(count))}>{count>99?'99+':count}</span>:null;}
