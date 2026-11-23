import type {SupabaseClient,RealtimeChannel} from '@supabase/supabase-js';
import {createPostgresReadiness} from './postgres-readiness';
type SignalTable='club_chat_signals'|'private_message_signals'|'club_visit_catalog_signals';
// Only own revision rows are subscribed; protected content is fetched via BFF.
export function subscribeOwnSignals(client:SupabaseClient|null,actor:string,topic:string,tables:readonly SignalTable[],o:{ready:()=>void;unavailable:()=>void;change:(row:Record<string,unknown>)=>void},network:Pick<EventTarget,'addEventListener'|'removeEventListener'>|null=typeof window==='undefined'?null:window){
 let live=true,generation=0,joining=false,degraded=false,online=typeof navigator==='undefined'||navigator.onLine!==false,channel:RealtimeChannel|null=null;
 const readiness=createPostgresReadiness({ready:()=>{degraded=false;o.ready();},unavailable:()=>{degraded=true;o.unavailable();}});
 async function start(){
  if(!live||joining||!online||!client)return;
  joining=true;degraded=false;const attempt=++generation,previous=channel;channel=null;
  try{
   if(previous)await client.removeChannel(previous);
   const {data,error}=await client.auth.getSession();
   if(!live||attempt!==generation)return;
   if(error||data.session?.user.id!==actor){degraded=true;o.unavailable();return;}
   await client.realtime.setAuth(data.session.access_token);
   if(!live||attempt!==generation)return;
   const current=()=>live&&attempt===generation;
   channel=client.channel(`${topic}:${attempt}`).on('system',{},payload=>{if(current())readiness.system(payload);});
   for(const table of tables)for(const event of ['INSERT','UPDATE'] as const)channel.on('postgres_changes',{event,schema:'public',table,filter:`user_id=eq.${actor}`},payload=>{if(current())o.change(payload.new as Record<string,unknown>);});
   channel.subscribe(status=>{if(current())readiness.status(status);});
  }catch{if(live&&attempt===generation){degraded=true;o.unavailable();}}
  finally{if(attempt===generation)joining=false;}
 }
 // Browser offline can invalidate the workspace without closing its old socket.
 // Retire this listener explicitly; do not disconnect the shared realtime client.
 const offline=()=>{if(!live)return;online=false;generation++;joining=false;readiness.status('CLOSED');const previous=channel;channel=null;if(previous)void client?.removeChannel(previous);};
 const resume=()=>{if(live&&online&&degraded)void start();};
 const connected=()=>{online=true;resume();};
 network?.addEventListener('offline',offline);network?.addEventListener('online',connected);network?.addEventListener('focus',resume);
 if(online)void start();else{degraded=true;o.unavailable();}
 return()=>{live=false;generation++;joining=false;readiness.stop();network?.removeEventListener('offline',offline);network?.removeEventListener('online',connected);network?.removeEventListener('focus',resume);if(channel)void client?.removeChannel(channel);channel=null;};
}
