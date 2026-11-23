import type { SupabaseClient } from "@supabase/supabase-js";
import { ContentError } from "../clubs/content-contract";
export const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙌"] as const;
export type Reaction = {emoji: string; count: number; mine: boolean};
export type ReactionSnapshot = {emoji_version?: string | null; supported: boolean; messages: Record<string, Reaction[]>};
export type ReactionKind = "private" | "club";
export function createMessageReactionsApi(client: SupabaseClient, user: string, kind: ReactionKind, scope: string) {
 async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const session = await client.auth.getSession();
  if (session.error || session.data.session?.user.id !== user) throw new ContentError("auth");
  const control = new AbortController(), timer = setTimeout(() => control.abort(), 20000);
  try {
   const result = await client.rpc(name, args).setHeader("Authorization", `Bearer ${session.data.session.access_token}`).abortSignal(control.signal);
   const current = await client.auth.getSession();
   if (current.error || current.data.session?.user.id !== user) throw new ContentError("auth");
   if (result.error) {
    if (["42501","28000","22023","PT409","P0002"].includes(result.error.code)) throw new ContentError(result.error.code==="42501"?"access":result.error.code==="28000"?"auth":result.error.code==="PT409"?"conflict":"unavailable");
    if (name === "message_reactions" && ["PGRST202", "42883"].includes(result.error.code)) return {supported:false,messages:{}} as T;
    throw new ContentError("network");
   }
   return result.data as T;
  } finally { clearTimeout(timer); }
 }
 return {
  read: (ids: string[]) => rpc<ReactionSnapshot>("message_reactions", {p_kind:kind,p_scope:scope,p_messages:ids}),
  set: (id: string, emoji: string | null, request: string) => rpc<void>("message_react", {p_kind:kind,p_scope:scope,p_message:id,p_emoji:emoji,p_request:request})
 };
}
// One scope snapshot, batched at 100 IDs. Never apply a read started before a newer signal.
export function createReactionStore(api: {read(ids: string[]): Promise<ReactionSnapshot>;set(id: string, emoji: string | null, request: string): Promise<void>}, uuid: () => string) {
 let state: ReactionSnapshot & {busy: boolean; error: boolean; pending: boolean; pendingId?: string} = {supported:false,emoji_version:undefined,messages:{},busy:false,error:false,pending:false};
 let ids: string[] = [], epoch = 0, alive = true, active = false, dirty = false, running = false;
 let pending: {id: string;emoji: string | null;request: string} | null = null;
 const listeners = new Set<() => void>();
 const emit = (patch: Partial<typeof state>) => {state={...state,...patch};listeners.forEach(f=>f());};
 async function refresh() {
  if (!alive || !active) return;
  epoch++; dirty=true;
  if (running) return;
  running=true;
  try { while (dirty && alive && active) {
   dirty=false;const version=epoch, selected=[...ids];let messages: Record<string, Reaction[]> = {}, supported=true,extended=true;
   try {
    for(let offset=0;offset<Math.max(1,selected.length);offset+=100) {
     const value=await api.read(selected.slice(offset,offset+100));supported=supported&&value.supported;extended=extended&&value.emoji_version==="15.1";Object.assign(messages,value.messages);
    }
    if(alive&&active&&version===epoch)emit({messages:supported?messages:{},supported,emoji_version:supported&&extended?"15.1":undefined,error:false});
   } catch {if(alive&&active&&version===epoch)emit({messages:{},error:true});}
  }} finally {running=false;}
 }
 async function retry() {
  if(!pending||state.busy||!alive||!active)return;
  const operation=pending;emit({busy:true,error:false});epoch++;
  try {await api.set(operation.id,operation.emoji,operation.request);if(alive&&pending===operation){pending=null;emit({pending:false,pendingId:undefined});void refresh();}}
  catch(error) {if(alive){if(error instanceof ContentError&&["access","auth","conflict","unavailable","invalid"].includes(error.kind)){pending=null;emit({pending:false,pendingId:undefined,error:true});void refresh();}else emit({error:true});}}
  finally {if(alive)emit({busy:false});}
 }
 return {getSnapshot:()=>state,subscribe:(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};},
  ids:(value:string[])=>{ids=[...new Set(value)];void refresh();},refresh,
  invalidate:()=>{epoch++;emit({messages:{}});void refresh();},
  active:(value:boolean)=>{active=value;epoch++;if(!value)emit({messages:{}});else void refresh();},
  set:async(id:string,emoji:string|null)=>{if(pending||state.busy||!active)return;pending={id,emoji,request:uuid()};emit({pending:true,pendingId:id});await retry();},retry,
  stop:()=>{alive=false;epoch++;listeners.clear();}
 };
}
