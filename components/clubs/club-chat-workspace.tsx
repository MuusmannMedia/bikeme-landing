'use client';
import {MessageBubble,type MessageAction} from '../messaging/message-bubble';
import {ReactionScope} from '../messaging/reactions';
import {messagePresentation} from '@/lib/messages/presentation';
import {useConversationPosition} from '../use-conversation-position';
import {StableAccessRegion} from './stable-access-region';
import {useEffect,useRef,useState} from 'react';
import {AppPanel,AppEmpty} from '../app-ui';
import {ClubAccessDenied,ClubHeader} from './club-ui';
import {dmText} from '@/lib/messages/i18n';
import {chatText,type ChatTextKey} from '@/lib/clubs/chat-i18n';
import {contentText,type ContentTextKey} from '@/lib/clubs/content-i18n';
import {getAppDictionary} from '@/lib/app-i18n';
import {formatDateTime} from '@/lib/app-format';
import type {ChatMessage,ChatCommand} from '@/lib/clubs/chat-contract';
import {ClubReportForm} from './club-report-form';
import type {ChatStore,ChatState} from '@/lib/clubs/chat-store';
import type {Locale} from '@/lib/locales';
export function ClubChatWorkspace({store,state,locale,userId,clubId,initialMessage,checking=false}:{store:ChatStore;state:ChatState;locale:Locale;userId:string;clubId:string;initialMessage:string|null;checking?:boolean}){
 const text=(key:ChatTextKey)=>chatText(locale,key),ct=(key:ContentTextKey)=>contentText(locale,key),t=getAppDictionary(locale),data=state.data,ready=state.status==='ready'&&!!data,locked=state.busy||!!state.pending||!ready;
 const dialog=useRef<HTMLDialogElement>(null),focusReturn=useRef(''),firstContext=useRef(false);
 const [confirm,setConfirm]=useState<{command:ChatCommand;title:ContentTextKey;body:string}|null>(null),[report,setReport]=useState<{id:string;destination:'club'|'bikeMe';reason:'spam'|'harassment'|'unsafe'|'other';detail:string}|null>(null),[searchInput,setSearchInput]=useState('');
 const {root,history:list}=useConversationPosition({ready,checking,items:data?.items,scrollRevision:state.scrollRevision});
 const restore=()=>requestAnimationFrame(()=>document.getElementById(focusReturn.current)?.focus({preventScroll:true}));
 useEffect(()=>{if(ready&&confirm)dialog.current?.showModal();},[ready,confirm]);
 useEffect(()=>{if(ready&&!firstContext.current&&initialMessage){firstContext.current=true;void store.context(initialMessage);}},[ready,initialMessage,store]);
 useEffect(()=>{const viewport=window.visualViewport;const resize=()=>root.current?.style.setProperty('--chat-viewport',`${viewport?.height??window.innerHeight}px`);resize();viewport?.addEventListener('resize',resize);return()=>viewport?.removeEventListener('resize',resize);},[root]);
 const openContext=(id:string|null)=>{void store.context(id);const url=new URL(window.location.href);if(id)url.searchParams.set('message',id);else url.searchParams.delete('message');window.history.replaceState(null,'',url.pathname+url.search);};
 const command=(type:ChatCommand['type'],extra:object)=>({actorId:userId,clubId,type,...extra}) as ChatCommand;
 const ask=(c:ChatCommand,title:ContentTextKey,body:string,id:string)=>{focusReturn.current=id;setConfirm({command:c,title,body});};
 function message(m:ChatMessage,context=false){const own=m.author_id===userId,items=context?data?.context:data?.items,index=items?.findIndex(x=>x.id===m.id)??0,group=messagePresentation(items??[m],Math.max(0,index));const menuId=`chat-menu-${context?'context-':''}${m.id}`;const actions:MessageAction[]=own?[]:[{key:'dm',label:dmText(locale,'start'),disabled:!m.author_id,run:()=>window.location.assign(`/${locale}/app/messages?peer=${m.author_id}`)},{key:'report',label:ct('report'),run:()=>{focusReturn.current=menuId;setReport({id:m.id,destination:'club',reason:'spam',detail:''});}},{key:'block',label:ct('block'),disabled:!m.author_id,run:()=>ask(command('block',{kind:'chat',id:m.id}),'block',ct('blockBody'),menuId)}];return <article className="bike-message-row" data-own={own} data-group-start={group.start} key={`${context?'context':'list'}-${m.id}`} data-chat-id={m.id} data-chat-version={m.version}>
  {group.start?<time className="bike-message-date" dateTime={m.created_at}>{formatDateTime(locale,m.created_at)}</time>:null}
  {!own&&group.start?<strong className="bike-message-author">{m.display_name??ct('deletedAuthor')}</strong>:null}
  <MessageBubble id={m.id} own={own} body={m.body} locale={locale} actions={actions} menuId={menuId} readOnlyReactions disabled={locked||checking}>
  {m.reply_unavailable?<p className="bike-app-muted">{t("clubs.chatArchiveUnavailable")}</p>:m.reply?<button className="bike-app-chat-quote" onClick={()=>openContext(m.reply!.id)}><span>{text('quote')} · {m.reply.display_name??ct('deletedAuthor')}</span><br/>{m.reply.deleted?text('deleted'):m.reply.body}</button>:null}
  <p className="bike-message-body">{m.body}</p>
  </MessageBubble>
 </article>;}
 const error:ContentTextKey=state.error==='contentRejected'?'contentRejected':state.error==='conflict'?'conflict':state.error==='invalid'?'invalid':state.error==='access'||state.error==='auth'?'access':state.error==='unavailable'||state.error==='blocked'?'unavailable':'network';
 return <ReactionScope actor={userId} kind="club" scope={clubId} ids={[...(data?.items??[]),...(data?.context??[])].map(m=>m.id)} active={ready&&!checking}><div ref={root} data-chat-access={state.status} data-chat-data={data?'present':'empty'}>
 <StableAccessRegion denied={state.status==='access'||state.status==='auth'} ready={ready} fallback={state.status==='access'?<ClubAccessDenied locale={locale}/>:state.status==='error'?<AppPanel><p role="alert">{text("offline")}</p><button className="bike-app-button" onClick={()=>void store.sync(true)}>{text("retry")}</button></AppPanel>:<p role="status">{text('loading')}</p>}>
  {ready&&data?<>
  <ClubHeader club={data!.club} locale={locale} selected="chat"/>
  <div className="bike-app-actions"><a className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/clubs/${clubId}/posts/blocked`}>{ct('blocked')}</a>{data!.club.role!=='member'?<a className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/clubs/${clubId}/posts/moderation`}>{ct('moderation')}</a>:null}</div>
  <AppPanel title={t("clubs.chatArchive")} className="bike-app-section-gap">
   <p className="bike-app-muted">{t("clubs.chatArchiveIntro")}</p>
   <div className="bike-app-actions">
    <a className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/messages`}>{dmText(locale, "entry")}</a>
    <a className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/clubs/${clubId}/posts`}>{ct("title")}</a>
   </div>
   <form className="bike-app-chat-search" onSubmit={e=>{e.preventDefault();if(searchInput.trim())void store.search(searchInput);}}><label className="bike-app-field"><span>{t('clubs.chatArchiveSearch')}</span><input id="chat-search" value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder={text('searchHint')}/></label><button className="bike-app-button bike-app-button-secondary" disabled={state.searching||!searchInput.trim()||Array.from(searchInput).length>100}>{t('clubs.chatArchiveSearch')}</button>{state.search?<button type="button" className="bike-app-button bike-app-button-secondary" onClick={()=>{store.clearSearch();setSearchInput('');}}>{text('closeSearch')}</button>:null}</form>
   {state.search?<section aria-label={t('clubs.chatArchiveSearch')} className="bike-app-chat-search-results">{data!.hits.length?data!.hits.map(hit=><article key={hit.id}><strong>{hit.display_name??ct('deletedAuthor')}</strong><p className="bike-app-content-body">{hit.excerpt}</p><button className="bike-app-button bike-app-button-secondary" onClick={()=>openContext(hit.id)}>{text('context')}</button></article>):<p>{state.searching?text('loading'):text('searchEmpty')}</p>}{data!.nextBefore?<button className="bike-app-button bike-app-button-secondary" disabled={state.searching} onClick={()=>void store.search(state.search,data!.nextBefore)}>{text('more')}</button>:null}</section>:null}
   {state.contextId?<section className="bike-app-chat-context" aria-label={text('context')}><h3>{text('context')}</h3><button className="bike-app-button bike-app-button-secondary" onClick={()=>openContext(null)}>{text('back')}</button>{data!.context.length?data!.context.map(m=>message(m,true)):<p>{state.contextUnavailable?t('clubs.chatArchiveUnavailable'):text('contextLoading')}</p>}</section>:null}
   <div id="chat-history" className="bike-app-chat-scroll" ref={list} role="region" tabIndex={0} aria-label={t('clubs.chatArchive')} onScroll={e=>{const el=e.currentTarget;const bottom=el.scrollHeight-el.scrollTop-el.clientHeight<90;store.position(bottom);}}>
    <div className="bike-app-chat-history">{data!.hasMore?<button className="bike-app-button bike-app-button-secondary" disabled={state.olderLoading} onClick={()=>{void store.older();}}>{state.olderLoading?text('loading'):text('older')}</button>:<p className="bike-app-muted">{text('beginning')}</p>}</div>
    {data!.items.length?[...data!.items].reverse().map(m=>message(m)):<AppEmpty>{t('clubs.chatArchiveEmpty')}</AppEmpty>}
   </div>
   <div className="bike-app-chat-new-slot">{state.newCount?<button className="bike-app-button" onClick={()=>store.bottom()}>{text('new')} ({state.newCount})</button>:null}</div>
  </AppPanel>
  {state.error || state.notice || state.pending ? <div className="bike-app-chat-feedback">
    {state.error ? <p role="alert">{ct(error)}</p> : null}
    {state.notice ? <p role="status">{ct(state.notice as ContentTextKey)}</p> : null}
    {state.pending ? <button className="bike-app-button" disabled={state.busy || checking} onClick={()=>void store.retry()}>{ct('retryAction')}</button> : null}
  </div> : null}
  {report?<AppPanel title={ct('report')} className="bike-app-section-gap">
    <ClubReportForm locale={locale} value={report} locked={locked} onChange={fields=>setReport({...report,...fields})}
      onSubmit={()=>void store.run(command('report',{...report,kind:'chat'})).then(saved=>{if(saved){setReport(null);restore();}})}
      onCancel={()=>{setReport(null);restore();}} />
  </AppPanel>:null}
  <dialog ref={dialog} className="bike-app-club-dialog" aria-labelledby="chat-confirm-title" onCancel={e=>{if(state.busy)e.preventDefault();}} onClose={()=>{setConfirm(null);restore();}}>{confirm?<><h2 id="chat-confirm-title">{ct(confirm.title)}</h2><p>{confirm.body}</p><div className="bike-app-actions"><button autoFocus className="bike-app-button bike-app-button-secondary" onClick={()=>dialog.current?.close()}>{t('common.cancel')}</button><button className="bike-app-button bike-app-button-danger" disabled={locked} onClick={()=>{const c=confirm.command;dialog.current?.close();void store.run(c);}}>{ct('confirm')}</button></div></>:null}</dialog>
 </>:null}</StableAccessRegion>
 </div></ReactionScope>;
}
