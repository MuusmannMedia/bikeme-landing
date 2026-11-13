import type {SupabaseClient} from '@supabase/supabase-js';
import {createClubReadApi} from './api';
import {createClubContentApi} from './content-api';
import {ContentError,contentError} from './content-contract';
import {isClubId} from './types';
import {positive,projectChat,validateChat,type ChatCommand,type ChatRead} from './chat-contract';
export function createClubChatApi(client:SupabaseClient,actor:string){
 const content=createClubContentApi(client,actor,true);
 async function rpc(name:string,args:Record<string,unknown>){const session=await client.auth.getSession();if(session.error||session.data.session?.user.id!==actor)throw new ContentError('auth');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await client.rpc(name,args).setHeader('Authorization',`Bearer ${session.data.session.access_token}`).abortSignal(controller.signal);if(r.error)throw contentError(r.error);return r.data;}catch(e){throw contentError(e);}finally{clearTimeout(timer);}}
 async function signals(){const s=await client.auth.getSession();if(s.error||s.data.session?.user.id!==actor)throw new ContentError('auth');const r=await client.from('club_chat_signals').select('revision,visibility_revision').eq('user_id',actor).setHeader('Authorization',`Bearer ${s.data.session.access_token}`).maybeSingle();if(r.error)throw contentError(r.error);return {signalRevision:positive(r.data?.revision??0,true),visibilityRevision:positive(r.data?.visibility_revision??0,true)};}
 return {signals,
 async read(clubId:string,q:URLSearchParams):Promise<ChatRead>{
  if(!isClubId(clubId))throw new ContentError('invalid');const club=await createClubReadApi(client,actor).detail(clubId),before=await signals();
  const number=(key:string)=>{const raw=q.get(key);if(raw===null)return null;const n=Number(raw);if(!Number.isSafeInteger(n)||n<(key==='after'?0:1))throw new ContentError('invalid');return n;};
  const uuid=(key:string)=>{const id=q.get(key);if(id&&!isClubId(id))throw new ContentError('invalid');return id;};
  const result:ChatRead={club,...before,items:[],cursor:0,hasMore:false,hits:[],nextBefore:null,context:[],selected:null};const mode=q.get('mode')??'page';
  if(mode==='page'){const page=await rpc('club_chat_page',{p_club:clubId,p_before:number('before'),p_after_change:number('after'),p_limit:20});if(!Array.isArray(page?.items)||page.role!==club.role||typeof page.has_more!=='boolean')throw new ContentError('network');result.items=page.items.map(projectChat);result.cursor=positive(page.cursor,true);result.hasMore=page.has_more;}
  else if(mode==='search'){const query=q.get('q')??'';if(Array.from(query.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g,'')).length<1||Array.from(query).length>100)throw new ContentError('invalid');const page=await rpc('club_chat_search',{p_club:clubId,p_query:query,p_before:number('before')});if(!Array.isArray(page?.items))throw new ContentError('network');result.hits=page.items.map((r:Record<string,unknown>)=>{if(!isClubId(String(r.id))||typeof r.excerpt!=='string')throw new ContentError('network');return{id:String(r.id),display_name:typeof r.display_name==='string'?r.display_name:null,created_at:String(r.created_at),excerpt:r.excerpt};});result.nextBefore=page.next_before===null?null:positive(page.next_before);}
  else if(mode==='context'){const rows=await rpc('club_chat_context',{p_club:clubId,p_message:uuid('message')});if(!Array.isArray(rows))throw new ContentError('network');result.context=rows.map(projectChat);}
  else if(mode==='message')result.selected=projectChat(await rpc('club_chat_message',{p_club:clubId,p_id:uuid('message')}));
  else throw new ContentError('invalid');
  const after=await signals();if(after.visibilityRevision!==before.visibilityRevision)throw new ContentError('network');const latest=await createClubReadApi(client,actor).detail(clubId);if(latest.role!==club.role)throw new ContentError('network');return result;
 },
 async execute(raw:unknown){const c=raw as ChatCommand;if(!c||c.actorId!==actor)throw new ContentError('auth');if(!isClubId(c.clubId)||!isClubId(c.id))throw new ContentError('invalid');if(c.type==='send'){if(c.replyTo!==null&&!isClubId(c.replyTo))throw new ContentError('invalid');await createClubReadApi(client,actor).detail(c.clubId);return projectChat(await rpc('club_chat_send',{p_club:c.clubId,p_id:c.id,p_body:validateChat(c.body),p_reply_to:c.replyTo}));}if(!['change','report','block','unblock'].includes(c.type))throw new ContentError('invalid');if((c.type==='change'||c.type==='report')&&c.kind!=='chat')throw new ContentError('invalid');return content.execute(c);}
 };
}
