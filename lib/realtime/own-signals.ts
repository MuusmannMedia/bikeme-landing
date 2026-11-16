import type {SupabaseClient,RealtimeChannel} from '@supabase/supabase-js';
import {createPostgresReadiness} from './postgres-readiness';
type SignalTable='club_chat_signals'|'private_message_signals';
// Never join with the anonymous fallback key while browser auth initializes.
// Only own revision rows are subscribed; protected content is fetched via BFF.
export function subscribeOwnSignals(client:SupabaseClient|null,actor:string,topic:string,tables:readonly SignalTable[],o:{ready:()=>void;unavailable:()=>void;change:(row:Record<string,unknown>)=>void}){
 let live=true,channel:RealtimeChannel|null=null;
 const readiness=createPostgresReadiness(o);
 void(async()=>{
  if(!client)return;
  const {data,error}=await client.auth.getSession();
  if(!live)return;
  if(error||data.session?.user.id!==actor){o.unavailable();return;}
  await client.realtime.setAuth(data.session.access_token);
  if(!live)return;
  channel=client.channel(topic).on('system',{},payload=>readiness.system(payload));
  for(const table of tables)for(const event of ['INSERT','UPDATE'] as const)channel.on('postgres_changes',{event,schema:'public',table,filter:`user_id=eq.${actor}`},payload=>{if(live)o.change(payload.new as Record<string,unknown>);});
  channel.subscribe(status=>readiness.status(status));
 })().catch(()=>{if(live)o.unavailable();});
 return()=>{live=false;readiness.stop();if(channel)void client?.removeChannel(channel);};
}
