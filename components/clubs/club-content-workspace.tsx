"use client";
import {ClubPostImage,ClubPostImageEditor} from "./club-post-image";
import {imageText} from "@/lib/clubs/image-i18n";
import {StableAccessRegion} from "./stable-access-region";
import {useEffect,useRef,useState} from "react";
import {AppEmpty,AppPanel} from "../app-ui";
import {ClubAccessDenied,ClubHeader,ClubReadFailure} from "./club-ui";
import {getAppDictionary} from "@/lib/app-i18n";
import {formatDateTime} from "@/lib/app-format";
import {contentText,type ContentTextKey} from "@/lib/clubs/content-i18n";
import { galleryImageUrl } from "@/lib/clubs/gallery-contract";
import { galleryText } from "@/lib/clubs/gallery-i18n";
import {contentBase,validateContent,validateReportDetail,type ContentCommand,type ContentItem} from "@/lib/clubs/content-contract";
import type {ContentStore,ContentState} from "@/lib/clubs/content-store";
import type {Locale} from "@/lib/locales";
const postsViewKey = "bike-me-club-posts-view";
const views = ["grid", "list"] as const;
type PostsView = typeof views[number];

export function ClubContentWorkspace({state,store,userId,clubId,locale,query}:{state:ContentState;store:ContentStore;userId:string;clubId:string;locale:Locale;query:string}){
 const t=getAppDictionary(locale),text=(key:ContentTextKey)=>contentText(locale,key),base=contentBase(locale,clubId),q=new URLSearchParams(query),data=state.data;
 const [confirmation,setConfirmation]=useState<{command:ContentCommand;title:ContentTextKey;body:ContentTextKey;focusId:string}|null>(null);
 const [postsView, setPostsView] = useState<PostsView>(() => {
  try {
   return typeof window !== "undefined" && localStorage.getItem(postsViewKey) === "list" ? "list" : "grid";
  } catch {
   return "grid";
  }
 });
 const dialog=useRef<HTMLDialogElement>(null),editor=useRef<HTMLTextAreaElement>(null),report=useRef<HTMLSelectElement>(null),returnFocus=useRef("");
 const lastFeedback=useRef("");
 const [preparingImage,setPreparingImage]=useState(false);
 const editorKey=state.draft?.key,reportId=state.report?.id;
 const ready=state.status==="ready"&&data!==null,locked=state.busy||!!state.pending||preparingImage;
 useEffect(()=>{if(ready&&confirmation)dialog.current?.showModal();},[ready,confirmation]);
 useEffect(()=>{if(editorKey)editor.current?.focus({preventScroll:true});else if(reportId)report.current?.focus({preventScroll:true});},[editorKey,reportId]);
 useEffect(()=>{const message=state.error??state.notice;if(!ready||state.busy||!message)return;const key=`${state.feedback}:${message}`;if(lastFeedback.current===key)return;const element=document.getElementById(state.error?"content-error":"content-notice");if(element){element.focus({preventScroll:true});lastFeedback.current=key;}},[ready,state.busy,state.feedback,state.error,state.notice]);
 const restoreFocus=()=>{const id=returnFocus.current;requestAnimationFrame(()=>document.getElementById(id)?.focus({preventScroll:true}));};
 const close=()=>{store.close();restoreFocus();};
 function confirm(command:ContentCommand,title:ContentTextKey,body:ContentTextKey,focusId:string){returnFocus.current=focusId;setConfirmation({command,title,body,focusId});}
 const command=(type:ContentCommand["type"],extra:object)=>({actorId:userId,clubId,type,...extra}) as ContentCommand;
 function card(item:ContentItem,readOnly=false,renderKey="content"){const own=item.author_id===userId,canPin=data?.role!=="member"&&item.kind==="post",id=`content-edit-${item.id}`;
  return <article className="bike-app-content-card" key={`${renderKey}:${item.id}`} data-content-id={item.id}>
   <div className="bike-app-content-meta"><strong>{item.display_name??text("deletedAuthor")}</strong><time dateTime={item.created_at}>{formatDateTime(locale,item.created_at)}</time>{item.is_pinned?<span className="bike-app-chip">{text("pinned")}</span>:null}</div>
   <p className="bike-app-content-body">{item.body}</p>
   {item.image?<ClubPostImage item={item} locale={locale}/>:null}
   {!readOnly?<div className="bike-app-actions">
    {item.kind==="post"&&data?.mode==="posts"?<a className="bike-app-button bike-app-button-secondary bike-app-button-small" href={`${base}/${item.id}${feedQuery()?`?${feedQuery()}`:""}`}>{text("thread")} ({item.comment_count})</a>:null}
    {own?<><button id={id} disabled={locked} className="bike-app-button bike-app-button-secondary bike-app-button-small" onClick={()=>{returnFocus.current=id;store.edit(item);}}>{t("common.edit")}</button><button id={`delete-${item.id}`} disabled={locked} className="bike-app-button bike-app-button-secondary bike-app-button-small" onClick={()=>confirm(command("change",{kind:item.kind,id:item.id,action:"delete"}),"removed","deleteBody",`delete-${item.id}`)}>{text("delete")}</button></>:null}
    {canPin?<button disabled={locked} className="bike-app-button bike-app-button-secondary bike-app-button-small" onClick={()=>void store.run(command("change",{kind:"post",id:item.id,action:item.is_pinned?"unpin":"pin"}))}>{text(item.is_pinned?"unpin":"pin")}</button>:null}
    {!own&&item.kind!=="chat"?<><button id={`report-${item.id}`} disabled={locked} className="bike-app-button bike-app-button-secondary bike-app-button-small" onClick={()=>{returnFocus.current=`report-${item.id}`;store.report(item);}}>{text("report")}</button>{item.author_id?<button id={`block-${item.id}`} disabled={locked} className="bike-app-button bike-app-button-secondary bike-app-button-small" onClick={()=>confirm(command("block",{kind:item.kind,id:item.id}),"block","blockBody",`block-${item.id}`)}>{text("block")}</button>:null}</>:null}
   </div>:null}
  </article>;
 }
 function choosePostsView(view: PostsView) {
  setPostsView(view);
  try { localStorage.setItem(postsViewKey, view); } catch { /* The choice still applies to the current page. */ }
 }
 function feedQuery(){const params=new URLSearchParams();for(const key of ["beforeTime","beforeId","beforePinned"])if(q.has(key))params.set(key,q.get(key)!);return params.toString();}
 function nextHref(){const next=new URLSearchParams(query);next.delete("mode");next.delete("postId");if(!data)return base;const last=data.mode==="reports"?data.reports.at(-1):data.items.at(-1);if(!last)return base;
  if(data.mode==="thread"){next.set("afterTime",last.created_at);next.set("afterId",last.id);return`${base}/${data.post?.id}?${next}`;}
  next.set("beforeTime",last.created_at);next.set("beforeId",last.id);if(data.mode==="posts")next.set("beforePinned",String((last as ContentItem).is_pinned));return `${base}${data.mode==="reports"?"/moderation":""}?${next}`;
 }
 let draftValid=true;try{if(state.draft)validateContent(state.draft.text,state.draft.kind);if(state.report)validateReportDetail(state.report.detail);}catch{draftValid=false;}
 const confirmTarget=confirmation?.command;
 const confirmName=confirmTarget?.type==="unblock"?data?.blocked.find(peer=>peer.id===confirmTarget.id)?.display_name:confirmTarget?.type==="block"?confirmTarget.kind==="member"?data?.club.members.find(peer=>peer.user_id===confirmTarget.id)?.display_name:[...(data?.items??[]),...(data?.post?[data.post]:[])].find(item=>item.id===confirmTarget.id)?.display_name:null;
 const draftTarget=state.draft?.id??state.draft?.post;
 const available=!draftTarget||data?.editorItem?.id===draftTarget||[...(data?.items??[]),...(data?.post?[data.post]:[])].some(item=>item.id===draftTarget);
 const draftPost=state.draft?.kind==="post"&&state.draft.id
  ? [data?.editorItem,data?.post,...(data?.items??[])].find(item=>item?.id===state.draft?.id)??undefined
  : undefined;
 const errorKey:ContentTextKey=state.error==="contentRejected"?"contentRejected":state.error==="conflict"?"conflict":state.error==="invalid"?"invalid":state.error==="unavailable"?"unavailable":state.error==="access"||state.error==="auth"||state.error==="blocked"?"access":"network";
 return <div data-club-access={state.status} data-club-data={data?"present":"empty"}>
 <StableAccessRegion denied={state.status==='access'||state.status==='auth'} ready={ready} fallback={state.status==="access"?<ClubAccessDenied locale={locale}/>:state.status==="error"?<ClubReadFailure locale={locale} kind="network" retryHref="" onRetry={()=>void store.refresh()}/>:<div className="bike-app-club-gate" role="status">{t("clubs.loading")}</div>}>
  {ready&&data?<>
  <ClubHeader club={data.club} locale={locale} selected="posts"/>
  <div className="bike-app-actions">{data.mode!=="posts"?<a className="bike-app-button bike-app-button-secondary" href={`${base}${data.mode==="thread"&&feedQuery()?`?${feedQuery()}`:""}`}>{text("back")}</a>:null}<a className="bike-app-button bike-app-button-secondary" href={`${base}/blocked`}>{text("blocked")}</a>{data.role!=="member"?<a className="bike-app-button bike-app-button-secondary" href={`${base}/moderation`}>{text("moderation")}</a>:null}</div>
  {state.error?<p id="content-error" tabIndex={-1} className="bike-app-content-feedback" role="alert">{state.error==="image"?imageText(locale,"invalid"):text(errorKey)}</p>:null}
  {state.notice?<p id="content-notice" tabIndex={-1} className="bike-app-content-feedback" role="status">{text(state.notice as ContentTextKey)}</p>:null}
  {state.pending?<button className="bike-app-button bike-app-section-gap" disabled={state.busy} onClick={()=>void store.retry()}>{text(state.busy?"busy":"retryAction")}</button>:null}
  {state.draft?<AppPanel title={text(state.draft.kind==="post"?"write":"comment")} className="bike-app-section-gap">
   <form onSubmit={e=>{e.preventDefault();if(draftValid&&!locked&&available&&!state.conflict&&(state.draft?.image===undefined||data.postImageUpload))void store.submit();}}>
    <label className="bike-app-field"><span>{text(state.draft.kind==="post"?"write":"comment")}</span><textarea ref={editor} value={state.draft.text} disabled={locked} onChange={e=>store.text(e.target.value)} rows={6}/></label>
    <p className="bike-app-muted">{text("counter").replace("{count}",String(Array.from(state.draft.text).length)).replace("{max}",state.draft.kind==="post"?"4000":"1500")}</p>
    {state.draft.kind==="post"&&data.postImageUpload&&available?<ClubPostImageEditor key={state.draft.key}
     draft={state.draft} item={draftPost} locale={locale} locked={state.busy||!!state.pending}
     onChange={choice=>store.postImage(state.draft!.key,choice)} onBusy={setPreparingImage}/>:null}
    {state.conflict&&data.editorItem?<div className="bike-app-content-card"><h3>{text("latest")} · {data.editorItem.version}</h3><p className="bike-app-content-body">{data.editorItem.body}</p><button type="button" className="bike-app-button bike-app-button-secondary" disabled={locked} onClick={()=>store.rebase()}>{text("rebase")}</button></div>:null}
    {!available?<p role="status">{text("draftUnavailable")}</p>:null}
    <div className="bike-app-actions"><button className="bike-app-button" disabled={locked||!draftValid||!available||state.conflict||(state.draft.image!==undefined&&!data.postImageUpload)} type="submit">{locked?text("busy"):t("common.save")}</button><button className="bike-app-button bike-app-button-secondary" disabled={locked} type="button" onClick={close}>{t("common.cancel")}</button></div>
   </form>
  </AppPanel>:null}
  {state.report?<AppPanel title={text("report")} className="bike-app-section-gap"><form onSubmit={e=>{e.preventDefault();if(draftValid&&!locked)void store.submitReport();}}>
   <fieldset className="bike-app-club-form-fields" disabled={locked}><label className="bike-app-field"><span>{text("report")}</span><select ref={report} value={state.report.destination} onChange={e=>store.reportText({destination:e.target.value as "club"|"bikeMe"})}><option value="club">{text("clubReport")}</option><option value="bikeMe">{text("bikeMeReport")}</option></select></label>
   <p className="bike-app-content-privacy">{text(state.report.destination==="bikeMe"?"privacyBikeMe":"privacyClub")}</p>
   <label className="bike-app-field"><span>{text("reason")}</span><select value={state.report.reason} onChange={e=>store.reportText({reason:e.target.value as "spam"|"harassment"|"unsafe"|"other"})}>{(["spam","harassment","unsafe","other"] as const).map(key=><option value={key} key={key}>{text(key)}</option>)}</select></label>
   <label className="bike-app-field"><span>{text("detail")}</span><textarea value={state.report.detail} onChange={e=>store.reportText({detail:e.target.value})} rows={4}/></label><p className="bike-app-muted">{text("counter").replace("{count}",String(Array.from(state.report.detail).length)).replace("{max}","500")}</p></fieldset>
   <div className="bike-app-actions"><button className="bike-app-button" disabled={locked||!draftValid}>{text(state.report.destination==="bikeMe"?"bikeMeReport":"clubReport")}</button><button type="button" className="bike-app-button bike-app-button-secondary" disabled={locked} onClick={close}>{t("common.cancel")}</button></div>
  </form></AppPanel>:null}
  {data.mode==="blocked"?<AppPanel title={text("blocked")} className="bike-app-section-gap">{data.blocked.length?<ul className="bike-app-list">{data.blocked.map(peer=><li key={peer.id} className="bike-app-list-item"><strong>{peer.display_name??text("deletedAuthor")}</strong><button id={`unblock-${peer.id}`} disabled={locked} className="bike-app-button bike-app-button-secondary" onClick={()=>confirm(command("unblock",{id:peer.id}),"unblock","unblockBody",`unblock-${peer.id}`)}>{text("unblock")}</button></li>)}</ul>:<AppEmpty>{text("noBlocked")}</AppEmpty>}</AppPanel>:null}
  {data.mode==="blocked"?<AppPanel title={t("clubs.members")} className="bike-app-section-gap"><ul className="bike-app-list">{data.club.members.filter(member=>member.user_id!==userId&&!data.blocked.some(block=>block.id===member.user_id)).map(member=><li key={member.user_id} className="bike-app-list-item"><strong>{member.display_name??text("deletedAuthor")}</strong><button id={`block-member-${member.user_id}`} disabled={locked} className="bike-app-button bike-app-button-secondary" onClick={()=>confirm(command("block",{kind:"member",id:member.user_id}),"block","blockBody",`block-member-${member.user_id}`)}>{text("block")}</button></li>)}</ul></AppPanel>:null}
  {data.mode==="posts" ? <>
   <div className="bike-app-actions bike-app-section-gap bike-app-posts-toolbar">
    <button id="new-content" disabled={locked} className="bike-app-button" onClick={() => {
     returnFocus.current = "new-content";
     store.edit(null);
    }}>{text("write")}</button>
    <div className="bike-app-posts-view-picker" role="group" aria-label={text("postsView")}>
     {views.map(view => (
      <button key={view} type="button" className="bike-app-nav-trigger" aria-pressed={postsView === view}
       data-active={postsView === view} onClick={() => choosePostsView(view)}>
       {text(view === "grid" ? "gridView" : "listView")}
      </button>
     ))}
    </div>
   </div>
   <section className="bike-app-content-stack" aria-label={text("title")} data-view={postsView}>
    {data.items.length ? data.items.map(item => card(item)) : <AppEmpty>{text("empty")}</AppEmpty>}
   </section>
  </> : null}
  {data.mode==="thread"?<>{data.unavailable?<AppPanel><p>{text("unavailable")}</p></AppPanel>:data.post?<><section className="bike-app-content-stack">{card(data.post)}</section><AppPanel title={text("thread")} className="bike-app-section-gap"><button id="new-comment" disabled={locked} className="bike-app-button" onClick={()=>{returnFocus.current="new-comment";store.edit(null,data.post!.id);}}>{text("comment")}</button><section className="bike-app-content-stack">{data.items.length?data.items.map(item=>card(item)):<AppEmpty>{text("emptyComments")}</AppEmpty>}</section></AppPanel></>:null}</>:null}
  {data.mode==="reports"?<AppPanel title={text("moderation")} className="bike-app-section-gap"><div className="bike-app-actions"><a href={`${base}/moderation`}>{text("pending")}</a><a href={`${base}/moderation?closed=true`}>{text("closed")}</a></div><p className="bike-app-muted">{text("anonymous")}</p>{data.reports.length?data.reports.map(row=><article className="bike-app-content-card" key={row.id}><h3>{text(["spam","harassment","unsafe","other"].includes(row.reason)?row.reason as ContentTextKey:"other")} · {text(row.status==="pending"?"pending":row.status==="removed"?"removed":"dismissed")}</h3><time>{formatDateTime(locale,row.created_at)}</time>{row.detail?<p className="bike-app-content-body">{row.detail}</p>:null}<h4>{text("snapshot")}</h4>{"hasImageEvidence" in row?<>
    {row.target_kind==="photo_comment"?<p className="bike-app-muted">{galleryText(locale,"reportComment")}</p>:null}
    {row.snapshot.author?<p>{row.target_kind==="photo"?galleryText(locale,"uploader").replace("{name}",row.snapshot.author):row.snapshot.author}</p>:null}
    {row.snapshot.text?<p className="bike-app-content-body">{row.snapshot.text}</p>:null}
    {row.hasImageEvidence?<a className="bike-app-button bike-app-button-secondary" href={galleryImageUrl(clubId,row.id,"evidence")} target="_blank" rel="noreferrer">
      {galleryText(locale,"evidence")}
    </a>:null}
   </>:<>{card(row.snapshot,true,`snapshot-${row.id}`)}<h4>{text("current")}</h4>{row.content?card(row.content,true,`current-${row.id}`):<p>{text("removed")}</p>}{row.context.length?<><h4>{text("context")}</h4>{row.context.map(item=>card(item,true,`context-${row.id}`))}</>:null}</>}{row.status==="pending"?<div className="bike-app-actions"><button id={`resolve-${row.id}`} disabled={locked} className="bike-app-button bike-app-button-danger" onClick={()=>confirm(command("resolve",{id:row.id,action:"remove"}),"remove","resolveBody",`resolve-${row.id}`)}>{text("remove")}</button><button disabled={locked} className="bike-app-button bike-app-button-secondary" onClick={()=>confirm(command("resolve",{id:row.id,action:"dismiss"}),"dismiss","resolveBody",`resolve-${row.id}`)}>{text("dismiss")}</button></div>:null}</article>):<AppEmpty>{text("noReports")}</AppEmpty>}</AppPanel>:null}
  {data.hasMore?<a className="bike-app-button bike-app-button-secondary bike-app-section-gap" href={nextHref()}>{text("more")}</a>:null}
  {q.has("beforeId")||q.has("afterId")?<a className="bike-app-button bike-app-button-secondary bike-app-section-gap" href={data.mode==="thread"?`${base}/${data.post?.id}${feedQuery()?`?${feedQuery()}`:""}`:data.mode==="reports"?`${base}/moderation${q.get("closed")==="true"?"?closed=true":""}`:base}>{text("first")}</a>:null}
  <dialog ref={dialog} className="bike-app-club-dialog" aria-labelledby="content-confirm" onCancel={e=>{if(state.busy)e.preventDefault();}} onClose={()=>{setConfirmation(null);restoreFocus();}}>{confirmation?<><h2 id="content-confirm">{text(confirmation.title)}{confirmName?`: ${confirmName}`:""}</h2><p>{text(confirmation.body)}</p><div className="bike-app-actions"><button autoFocus className="bike-app-button bike-app-button-secondary" onClick={()=>dialog.current?.close()}>{t("common.cancel")}</button><button disabled={locked} className="bike-app-button bike-app-button-danger" onClick={()=>{const action=confirmation.command;dialog.current?.close();void store.run(action);}}>{text("confirm")}</button></div></>:null}</dialog>
 </>:null}</StableAccessRegion>
 </div>;
}
