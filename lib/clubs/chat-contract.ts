import {ContentError,projectContent,validateContent,type ContentItem,type ContentCommand} from './content-contract';
import type {Club} from './types';
export type ChatQuote={id:string;seq:number;change_seq:number;deleted:boolean;author_id:string|null;display_name:string|null;body:string|null};
export type ChatMessage=ContentItem&{kind:'chat';seq:number;change_seq:number;deleted_at:string|null;reply_to_id:string|null;reply:ChatQuote|null;reply_unavailable:boolean};
export type ChatHit={id:string;display_name:string|null;created_at:string;excerpt:string};
export type ChatRead={club:Club;visibilityRevision:number;signalRevision:number;items:ChatMessage[];cursor:number;hasMore:boolean;hits:ChatHit[];nextBefore:number|null;context:ChatMessage[];selected:ChatMessage|null};
export type ChatCommand={actorId:string;clubId:string;type:'send';id:string;body:string;replyTo:string|null}|ContentCommand;
export function positive(value:unknown,zero=false){if(!Number.isSafeInteger(value)||Number(value)<(zero?0:1))throw new ContentError('network');return Number(value);}
export function projectChat(raw:unknown):ChatMessage {
 const r=raw as Record<string,unknown>;const item=projectContent(raw);if(item.kind!=='chat')throw new ContentError('network');
 let reply:ChatQuote|null=null;
 if(r.reply&&typeof r.reply==='object'){const q=r.reply as Record<string,unknown>;if(typeof q.id!=='string'||typeof q.deleted!=='boolean')throw new ContentError('network');reply={id:q.id,seq:positive(q.seq),change_seq:positive(q.change_seq),deleted:q.deleted,author_id:q.deleted?null:typeof q.author_id==='string'?q.author_id:null,display_name:q.deleted?null:typeof q.display_name==='string'?q.display_name:null,body:q.deleted?null:typeof q.body==='string'?q.body:null};}
 const deleted=typeof r.deleted_at==='string'?r.deleted_at:null;
 return {...item,kind:'chat',seq:positive(r.seq),change_seq:positive(r.change_seq),deleted_at:deleted,body:deleted?'':item.body,author_id:deleted?null:item.author_id,display_name:deleted?null:item.display_name,reply_to_id:deleted?null:typeof r.reply_to_id==='string'?r.reply_to_id:null,reply:deleted?null:reply,reply_unavailable:r.reply_unavailable===true};
}
// iOS merge rule: change sequence wins, tombstones remove messages, sequence orders history.
export function mergeChat<M extends {id:string;change_seq:number;seq:number;deleted_at:string|null}>(old:M[],incoming:M[]){const rows=new Map(old.map(m=>[m.id,m]));for(const m of incoming){const prev=rows.get(m.id);if(!prev||m.change_seq>=prev.change_seq)rows.set(m.id,m);}return [...rows.values()].filter(m=>!m.deleted_at).sort((a,b)=>b.seq-a.seq);}
export function validateChat(text:string){return validateContent(text,'chat');}
