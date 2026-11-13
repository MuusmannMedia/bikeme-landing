import type {SupabaseClient} from '@supabase/supabase-js';
import {createClubReadApi} from './api';
import {ClubError,clubError} from './membership-types';
import {parseProfileCommand,validateClubText,type ClubProfile} from './profile-contract';
import {isClubId} from './types';
export const clubProfileFields='id,name,description,profile_revision,cover_path,logo_path,cover_frame,logo_frame';
export function createClubProfileApi(client:SupabaseClient,actor:string,editingEnabled:boolean){
 async function bounded<T>(query:(signal:AbortSignal)=>PromiseLike<{data:T;error:unknown}>):Promise<T>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);try{const r=await query(c.signal);if(r.error)throw clubError(r.error);return r.data;}catch(e){throw clubError(e);}finally{clearTimeout(timer);}}
 async function profile(id:string):Promise<ClubProfile>{
  if(!editingEnabled)throw new ClubError('access');
  const club=await createClubReadApi(client,actor).detail(id);
  if(!['owner','admin'].includes(club.role))throw new ClubError('access');
  const row=await bounded(signal=>client.from('clubs').select(clubProfileFields).eq('id',id).abortSignal(signal).maybeSingle());
  if(!row)throw new ClubError('access');
  return row as unknown as ClubProfile;
 }
 return{profile,async execute(raw:unknown){
  const command=parseProfileCommand(raw,actor),text=validateClubText(command);
  if(command.op==='create'){
   const id=await bounded(signal=>client.rpc('club_create',{p_request_key:command.requestId,p_name:text.name,p_description:text.description}).abortSignal(signal));
   if(typeof id!=='string'||!isClubId(id))throw new ClubError('network');return{id};
  }
  // Media is never accepted from the browser. A fresh, authorized server read
  // supplies every image/frame argument, with the client's original revision.
  // A concurrent image change makes the RPC conflict instead of overwriting it.
  const current=await profile(command.clubId);
  const saved=await bounded(signal=>client.rpc('club_save_framed_profile',{p_club_id:command.clubId,p_revision:command.revision,p_name:text.name,p_description:text.description,p_cover_path:current.cover_path,p_logo_path:current.logo_path,p_cover_frame:current.cover_frame,p_logo_frame:current.logo_frame}).abortSignal(signal));
  if(!saved||typeof saved!=='object'||!('id' in saved)||saved.id!==command.clubId)throw new ClubError('network');return{id:command.clubId};
 }};
}
