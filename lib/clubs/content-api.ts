import type { SupabaseClient } from "@supabase/supabase-js";
import { createClubReadApi } from "./api";
import { ContentError, contentError, projectContent, projectReport, validateContent, validateReportDetail, type ContentSnapshot, type ContentCommand } from "./content-contract";
import { isClubId } from "./types";
import { isPostImageFrame } from "./post-image";
import { postImageUploadsEnabled, signPostImage } from "./post-image-server";
export function createClubContentApi(client:SupabaseClient,actor:string,allowChatModeration=false){
 async function rpc(name:string,args:Record<string,unknown>){
  const session=await client.auth.getSession();if(session.error||session.data.session?.user.id!==actor)throw new ContentError("auth");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{const r=await client.rpc(name,args).setHeader("Authorization",`Bearer ${session.data.session.access_token}`).abortSignal(controller.signal);if(r.error)throw contentError(r.error);return r.data;}catch(e){throw contentError(e);}finally{clearTimeout(timer);}
 }
 async function revision(){const session=await client.auth.getSession();if(session.error||session.data.session?.user.id!==actor)throw new ContentError("auth");const r=await client.from("club_chat_signals").select("visibility_revision").eq("user_id",actor).setHeader("Authorization",`Bearer ${session.data.session.access_token}`).maybeSingle();if(r.error)throw contentError(r.error);const value=r.data?.visibility_revision??0;if(!Number.isSafeInteger(value)||value<0)throw new ContentError("network");return Number(value);}
 async function item(clubId:string,kind:string,id:string){return projectContent(await rpc("club_content_item",{p_club:clubId,p_kind:kind,p_id:id}));}
 async function savePostImage(clubId:string,id:string,request:string,version:number|null,body:string,image:unknown){
  const args=await signPostImage(actor,clubId,id,request,version,body,image);
  return rpc("club_post_image_save",args);
 }
 return {revision,item,
 async image(clubId:string,id:string,revision:string,source:boolean){
  if(![clubId,id,revision].every(isClubId))throw new ContentError("invalid");
  const value=await rpc("club_post_image_read",{p_club:clubId,p_post:id,p_revision:revision,p_source:source});
  if(typeof value!=="string"||!value)throw new ContentError("unavailable");
  return Buffer.from(value,"base64");
 },
 async load(clubId:string,q:URLSearchParams):Promise<ContentSnapshot>{
  const club=await createClubReadApi(client,actor).detail(clubId),before=await revision();
  const mode=q.get("mode");const snapshot:ContentSnapshot={club,role:club.role,visibilityRevision:before,mode:mode==="thread"||mode==="reports"||mode==="blocked"?mode:"posts",items:[],post:null,reports:[],blocked:[],hasMore:false,unavailable:false,editorItem:null};
  const cursorId=(name:string)=>{const id=q.get(name);if(id&&!isClubId(id))throw new ContentError("invalid");return id;};
  if(snapshot.mode==="reports"){
   if(club.role==="member")throw new ContentError("access");
   const args={p_club:clubId,p_closed:q.get("closed")==="true",p_before_time:q.get("beforeTime"),p_before_id:cursorId("beforeId"),p_limit:20};
   const result=await rpc("club_gallery_moderation_page",args).catch(error=>{
    if(contentError(error).kind!=="unavailable")throw error;
    return rpc("club_content_reports_page",args);
   });
   if(!Array.isArray(result?.items))throw new ContentError("network");snapshot.reports=result.items.map(projectReport);snapshot.hasMore=result.items.length===20;
  }else if(snapshot.mode==="blocked"){
   const rows=await rpc("club_blocked_users",{});if(!Array.isArray(rows))throw new ContentError("network");snapshot.blocked=rows.map(r=>({id:String(r.id),display_name:typeof r.display_name==="string"?r.display_name:null}));
  }else{
   let result;
   try{result=snapshot.mode==="thread"?await rpc("club_post_thread",{p_club:clubId,p_post:cursorId("postId"),p_after_time:q.get("afterTime"),p_after_id:cursorId("afterId"),p_limit:20}):await rpc("club_posts_page",{p_club:clubId,p_before_time:q.get("beforeTime"),p_before_id:cursorId("beforeId"),p_before_pinned:q.has("beforePinned")?q.get("beforePinned")==="true":null,p_limit:20});}
   catch(e){if(snapshot.mode==="thread"&&contentError(e).kind==="unavailable")snapshot.unavailable=true;else throw e;}
   if(result){if(result.role!==club.role||!Array.isArray(result.items))throw new ContentError("network");snapshot.items=result.items.map(projectContent);snapshot.post=result.post?projectContent(result.post):null;snapshot.hasMore=result.items.length===20;}
  }
  const editorId=cursorId("editorId"),editorKind=q.get("editorKind");
  if(editorId&&["post","comment"].includes(editorKind??""))try{snapshot.editorItem=await item(clubId,editorKind!,editorId);}catch(e){if(contentError(e).kind!=="unavailable")throw e;}
  if(snapshot.mode!=="blocked"){
   const reportedPosts=snapshot.reports.flatMap(report=>"content" in report&&report.content?[report.content]:[]);
   const posts=[...snapshot.items,...reportedPosts,snapshot.post,snapshot.editorItem]
    .filter((post):post is NonNullable<typeof post>=>post?.kind==="post");
   const images=await rpc("club_post_image_index",{p_club:clubId,p_posts:[...new Set(posts.map(post=>post.id))]})
    .catch(error=>{if(contentError(error).kind==="unavailable")return null;throw error;});
   if(images){
    snapshot.postImageUpload=postImageUploadsEnabled();
    for(const post of posts){
     const image=images[post.id];
     if(image&&typeof image.revision==="string"&&isClubId(image.revision)&&isPostImageFrame(image.frame)){
      post.image={revision:image.revision,frame:image.frame};
     }
    }
   }
  }
  if(await revision()!==before)throw new ContentError("network");
  const latest=await createClubReadApi(client,actor).detail(clubId);if(latest.role!==club.role)throw new ContentError("network");
  return snapshot;
 },
 async execute(input:unknown){
  const c=input as ContentCommand;if(!c||c.actorId!==actor)throw new ContentError("auth");if(!isClubId(c.clubId??"")||!isClubId(c.id??""))throw new ContentError("invalid");
  const club=await createClubReadApi(client,actor).detail(c.clubId);
  if(c.type==="create"){
   if(c.post!==null&&!isClubId(c.post))throw new ContentError("invalid");
   const body=validateContent(c.body,c.post?"comment":"post");
   if(c.image!==undefined){
    if(c.post!==null||c.image===null)throw new ContentError("invalid");
    return savePostImage(c.clubId,c.id,c.id,null,body,c.image);
   }
   return rpc("club_content_create",{p_club:c.clubId,p_id:c.id,p_body:body,p_post:c.post});
  }
  if(c.type==="change"){
   if(!["post","comment"].includes(c.kind)||!["edit","delete","pin","unpin"].includes(c.action))throw new ContentError("invalid");
   if(c.action==="delete"||c.action==="edit"){
    // No generic administrator deletion, even where legacy server RPC allows it.
    // Deleted own-item replay is resolved by the server; author ownership is
    // checked on its raw RLS-authorized row, without exposing its text.
    const row=await client.from(c.kind==="post"?"club_posts":"club_comments").select("author_id").eq("club_id",c.clubId).eq("id",c.id).maybeSingle();
    if(row.error)throw contentError(row.error);
    if(!row.data){if(c.action==="delete")return {id:c.id,changed:false,unavailable:true};throw new ContentError("unavailable");}
    if(row.data.author_id!==actor)throw new ContentError("access");
   }else if(club.role==="member"||c.kind!=="post")throw new ContentError("access");
   if(c.action==="edit"&&(!Number.isSafeInteger(c.version)||!c.version||c.version<1))throw new ContentError("invalid");
   if(c.image!==undefined){
    if(c.kind!=="post"||c.action!=="edit"||typeof c.imageRequest!=="string"||!isClubId(c.imageRequest)){
     throw new ContentError("invalid");
    }
    return savePostImage(c.clubId,c.id,c.imageRequest,c.version!,validateContent(c.body??"","post"),c.image);
   }
   return rpc("club_content_change",{p_club:c.clubId,p_kind:c.kind,p_id:c.id,p_action:c.action,p_body:c.action==="edit"?validateContent(c.body??"",c.kind):null,p_version:c.version??null});
  }
  if(c.type==="report"){
   if(!(allowChatModeration?["post","comment","chat"]:["post","comment"]).includes(c.kind)||!["spam","harassment","unsafe","other"].includes(c.reason)||!["club","bikeMe"].includes(c.destination))throw new ContentError("invalid");
   return rpc(c.destination==="bikeMe"?"club_report_to_bike_me":"club_content_report",{p_club:c.clubId,p_kind:c.kind,p_id:c.id,p_reason:c.reason,p_detail:validateReportDetail(c.detail)});
  }
  if(c.type==="resolve"){if(club.role==="member")throw new ContentError("access");if(!["remove","dismiss"].includes(c.action))throw new ContentError("invalid");return rpc("club_content_resolve",{p_club:c.clubId,p_report:c.id,p_action:c.action});}
  if(c.type==="block"){if(!(allowChatModeration?["post","comment","chat","member"]:["post","comment","member"]).includes(c.kind))throw new ContentError("invalid");return rpc("club_block_user",{p_club:c.clubId,p_kind:c.kind,p_id:c.id});}
  if(c.type==="unblock")return rpc("club_unblock_user",{p_peer:c.id});
  throw new ContentError("invalid");
 }
 };
}
