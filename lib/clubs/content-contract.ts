import type { Club, ClubRole } from "./types";
export type ContentKind="post"|"comment"|"chat";
export type ContentItem={kind:ContentKind|"chat";id:string;club_id:string;post_id:string;author_id:string|null;display_name:string|null;body:string;created_at:string;edited_at:string|null;version:number;is_pinned:boolean;comment_count:number};
export type ContentReport={id:string;club_id:string;target_kind:ContentItem["kind"];target_id:string;reason:string;detail:string;status:"pending"|"removed"|"dismissed";created_at:string;resolved_at:string|null;snapshot:ContentItem;content:ContentItem|null;context:ContentItem[]};
export type ContentSnapshot={club:Club;role:ClubRole;visibilityRevision:number;mode:"posts"|"thread"|"reports"|"blocked";items:ContentItem[];post:ContentItem|null;reports:ContentReport[];blocked:{id:string;display_name:string|null}[];hasMore:boolean;unavailable:boolean;editorItem:ContentItem|null};
export type ContentErrorKind="auth"|"access"|"blocked"|"contentRejected"|"invalid"|"unavailable"|"conflict"|"network";
export class ContentError extends Error {constructor(public readonly kind:ContentErrorKind){super(kind);}}
export function contentError(error:unknown):ContentError {
 if(error instanceof ContentError)return error;
 const e=error as {code?:string;message?:string}|null;
 if(e?.code==="22023"&&e.message==="BIKEME_CONTENT_REJECTED")return new ContentError("contentRejected");
 return new ContentError(e?.code==="PT423"?"blocked":e?.code==="42501"?"access":["28000","PGRST301","PGRST302"].includes(e?.code??"")?"auth":e?.code==="22023"?"invalid":["PT409","40001","40P01"].includes(e?.code??"")?"conflict":["P0002","PT410","PGRST202","42P01","42883"].includes(e?.code??"")?"unavailable":"network");
}
export function responseContentError(value:unknown){return new ContentError(typeof value==="string"&&["auth","access","blocked","contentRejected","invalid","unavailable","conflict","network"].includes(value)?value as ContentErrorKind:"network");}
export function validateContent(text:string,kind:ContentKind){if(typeof text!=="string")throw new ContentError("invalid");const body=text.replace(/^ +| +$/g,"");const n=Array.from(body).length;if(!/\S/u.test(body)||!n||n>(kind==="post"?4000:1500)||body.includes("\0"))throw new ContentError("invalid");return body;}
export function validateReportDetail(text:string){if(typeof text!=="string")throw new ContentError("invalid");if(Array.from(text).length>500||text.includes("\0"))throw new ContentError("invalid");return text;}
export type ContentCommand={actorId:string;clubId:string}&(
 {type:"create";id:string;body:string;post:string|null}|
 {type:"change";kind:ContentKind;id:string;action:"edit"|"delete"|"pin"|"unpin";body?:string;version?:number}|
 {type:"report";kind:ContentKind;id:string;reason:"spam"|"harassment"|"unsafe"|"other";detail:string;destination:"club"|"bikeMe"}|
 {type:"resolve";id:string;action:"remove"|"dismiss"}|
 {type:"block";kind:ContentKind|"member";id:string}|
 {type:"unblock";id:string});
export type ContentDraft={kind:ContentKind;id:string|null;post:string|null;version:number|null;text:string;key:string};
export type ReportDraft={kind:ContentKind;id:string;reason:"spam"|"harassment"|"unsafe"|"other";detail:string;destination:"club"|"bikeMe"};
export const contentBase=(locale:string,clubId:string)=>`/${locale}/app/clubs/${clubId}/posts`;
// Explicit projection: never forward reporter identities, internal evidence flags,
// support data, or unknown future fields from the RPC response to the browser.
export function projectContent(value:unknown):ContentItem {
 const r=value as Record<string,unknown>|null;
 if(!r||!["post","comment","chat"].includes(String(r.kind))||typeof r.id!=="string"||typeof r.club_id!=="string"||typeof r.body!=="string"||!Number.isSafeInteger(r.version))throw new ContentError("network");
 return {kind:r.kind as ContentItem["kind"],id:r.id,club_id:r.club_id,post_id:String(r.post_id??r.id),author_id:typeof r.author_id==="string"?r.author_id:null,display_name:typeof r.display_name==="string"?r.display_name:null,body:r.body,created_at:String(r.created_at??""),edited_at:typeof r.edited_at==="string"?r.edited_at:null,version:Number(r.version),is_pinned:r.is_pinned===true,comment_count:Number(r.comment_count??0)};
}
export function projectReport(value:unknown):ContentReport {
 const r=value as Record<string,unknown>|null;
 if(!r||typeof r.id!=="string"||!["pending","removed","dismissed"].includes(String(r.status)))throw new ContentError("network");
 return {id:r.id,club_id:String(r.club_id),target_kind:r.target_kind as ContentItem["kind"],target_id:String(r.target_id),reason:String(r.reason),detail:typeof r.detail==="string"?r.detail:"",status:r.status as ContentReport["status"],created_at:String(r.created_at),resolved_at:typeof r.resolved_at==="string"?r.resolved_at:null,snapshot:projectContent(r.snapshot),content:r.content?projectContent(r.content):null,context:Array.isArray(r.context)?r.context.map(projectContent):[]};
}
