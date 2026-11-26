'use client';
import {MessageBubble,type MessageAction} from '../messaging/message-bubble';
import {ReactionScope} from '../messaging/reactions';
import {VisibleRead} from '../messaging/visible-read';
import {UnreadBadge} from '../messaging/unread-provider';
import {messagePresentation} from '@/lib/messages/presentation';
import {StableAccessRegion} from '../clubs/stable-access-region';
import {useConversationPosition} from '../use-conversation-position';
import {useEffect,useRef,useState} from 'react';
import {AppPanel,AppPageHeader,AppEmpty} from '../app-ui';
import {dmText} from '@/lib/messages/i18n';
import {chatText,type ChatTextKey} from '@/lib/clubs/chat-i18n';
import {contentText,type ContentTextKey} from '@/lib/clubs/content-i18n';
import {getAppDictionary} from '@/lib/app-i18n';
import {formatDateTime} from '@/lib/app-format';
import {validateMessage,type Message,type Command} from '@/lib/messages/contract';
import {SHORT_CONTENT_LIMIT,validateReportDetail} from '@/lib/clubs/content-contract';
import type {MessagesStore,State} from '@/lib/messages/store';
import type {Locale} from '@/lib/locales';
import {ComposerEmoji} from './composer-emoji';
import {ConversationBlock} from './conversation-block';
export function MessagesWorkspace({store,state,locale,userId,conversationId,peer,checking=false,floating=false,minimized=false}:{store:MessagesStore;state:State;locale:Locale;userId:string;conversationId:string|null;peer:string|null;checking?:boolean;floating?:boolean;minimized?:boolean}){
 const t=getAppDictionary(locale),ct=(key:ContentTextKey)=>contentText(locale,key),ch=(key:ChatTextKey)=>chatText(locale,key),dm=(key:Parameters<typeof dmText>[1])=>dmText(locale,key),data=state.data,ready=state.status==='ready'&&!!data,locked=!ready||state.busy||!!state.pending;
 const editor=useRef<HTMLTextAreaElement>(null),dialog=useRef<HTMLDialogElement>(null),reportSelect=useRef<HTMLSelectElement>(null),returnId=useRef('');
 const [query,setQuery]=useState(''),[confirm,setConfirm]=useState<{command:Command;title:string;body:string;focusId:string}|null>(null),[report,setReport]=useState<{id:string;detail:string;reason:'spam'|'harassment'|'unsafe'|'other'}|null>(null);
 const {root,history:list}=useConversationPosition({ready,checking:checking||minimized,items:data?.items,scrollRevision:state.scrollRevision});
 const restore=()=>requestAnimationFrame(()=>(document.getElementById(returnId.current)??editor.current)?.focus({preventScroll:true}));
 useEffect(()=>{if(ready&&confirm)dialog.current?.showModal();},[ready,confirm]);
 useEffect(()=>{if(ready&&report)reportSelect.current?.focus({preventScroll:true});},[ready,report?.id]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(ready&&(state.edit||state.replyId))editor.current?.focus({preventScroll:true});},[ready,state.edit?.id,state.replyId]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{const viewport=window.visualViewport;const resize=()=>root.current?.style.setProperty('--chat-viewport',`${viewport?.height??innerHeight}px`);resize();viewport?.addEventListener('resize',resize);return()=>viewport?.removeEventListener('resize',resize);},[root]);
 const command=(extra:object)=>({actorId:userId,conversation:conversationId!,...extra}) as Command;
 const ask=(c:Command,title:string,body:string,id:string)=>{setConfirm({command:c,title,body,focusId:id});};
 const choose=(id:string,edit=false)=>store.choose(id,edit);
 function bubble(m:Message,original=false){const own=m.author_id===userId,index=data?.items.findIndex(x=>x.id===m.id)??0,group=messagePresentation(data?.items??[m],Math.max(0,index));const actions:MessageAction[]=original?[]:own?[{key:'edit',label:t('common.edit'),disabled:!data?.canSend,run:()=>void choose(m.id,true)},{key:'delete',label:ct('delete'),danger:true,run:()=>ask(command({type:'change',id:m.id,action:'delete'}),ct('delete'),dm('deleteBody'),`message-menu-${m.id}`)}]:[{key:'reply',label:ch('reply'),disabled:!data?.canSend,run:()=>void choose(m.id)},{key:'report',label:dm('report'),run:()=>{returnId.current=`message-menu-${m.id}`;setReport({id:m.id,detail:'',reason:'spam'});}}];return <article className="bike-message-row" data-own={own} data-group-start={group.start} key={`${original?'original':'list'}-${m.id}`} data-dm-message={m.id} data-seen-incoming={!own&&!m.deleted_at?m.id:undefined}>
  {group.start||original?<time className="bike-message-date" dateTime={m.created_at}>{formatDateTime(locale,m.created_at)}</time>:null}
  <MessageBubble id={m.id} own={own} body={m.body} locale={locale} actions={actions} disabled={locked||checking} actionIcons={floating}>
  {m.reply?<button className="bike-app-chat-quote" onClick={()=>{returnId.current=`dm-original-${original?'opened-':''}${m.id}`;store.original(m.reply!.id);}} id={`dm-original-${original?'opened-':''}${m.id}`}><span>{ch('quote')} · {m.reply.display_name??dm('deletedUser')}</span><br/>{m.reply.deleted?ch('deleted'):m.reply.body}</button>:null}
  <p className="bike-message-body">{m.body}</p>
  </MessageBubble>
 </article>;}
 let valid=false;try{validateMessage(state.draft);valid=true;}catch{}let reportValid=false;try{validateReportDetail(report?.detail??'');reportValid=true;}catch{}
 const error:ContentTextKey=state.error==='contentRejected'?'contentRejected':state.error==='conflict'?'conflict':state.error==='invalid'?'invalid':state.error==='blocked'||state.error==='unavailable'?'unavailable':state.error==='access'?'access':'network';
 const tooLong=floating&&!valid&&Array.from(state.draft.replace(/^ +| +$/g,"")).length>SHORT_CONTENT_LIMIT;
 const canWrite=!!data?.canSend&&!locked;
 const selected=data?.selected,available=(!state.edit&&!state.replyId)||!!selected&&!selected.deleted_at;
 return <ReactionScope actor={userId} kind="private" scope={conversationId??''} ids={[...(data?.items??[]).map(m=>m.id),...(state.original?[state.original.id]:[])]} active={ready&&!checking&&!!conversationId&&data?.canSend===true}><VisibleRead actor={userId} conversation={conversationId??''} enabled={ready&&!checking&&!minimized&&!!conversationId&&data?.canSend===true} revision={data?.items}/><div ref={root} data-dm-access={state.status} data-dm-data={data?'present':'empty'}>
  <StableAccessRegion ready={ready} fallback={<AppPanel><p role={state.status==='error'?'alert':'status'}>{ch(state.status==='error'?'offline':'loading')}</p>{state.status==='error'?<button className="bike-app-button" onClick={()=>void store.sync(true)}>{ch('retry')}</button>:null}</AppPanel>}>
  {!floating&&<AppPageHeader intro="" eyebrow={dm('entry')} title={conversationId&&ready?data!.conversation?.peer.display_name??dm('deletedUser'):dm('title')}/>}
  {conversationId&&!floating?<a className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/messages`}>{dm('back')}</a>:null}
  {!ready?<AppPanel><p role={state.status==='error'?'alert':'status'}>{ch(state.status==='error'?'offline':'loading')}</p>{state.status==='error'?<button className="bike-app-button" onClick={()=>void store.sync(true).then(()=>editor.current?.focus({preventScroll:true}))}>{ch('retry')}</button>:null}</AppPanel>:<>
   {(!floating||state.connection==='offline')&&<p role="status" className="bike-app-chat-status">{ch(state.connection==='live'?'live':state.connection==='connecting'?'connecting':'offline')}</p>}
   {!conversationId?<>
    <div className="bike-app-actions"><button className="bike-app-button" disabled={locked} onClick={()=>store.pick('')}>{dm('new')}</button>{state.pick?<button className="bike-app-button bike-app-button-secondary" disabled={locked} onClick={()=>store.pick(null)}>{dm('back')}</button>:null}</div>
    {state.pick?<AppPanel title={dm('pick')} className="bike-app-section-gap"><form className="bike-app-chat-search" onSubmit={e=>{e.preventDefault();if(Array.from(query).length<=80)store.pick(query);}}><label className="bike-app-field"><span>{dm('search')}</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={dm('hint')}/></label><button className="bike-app-button" disabled={locked||Array.from(query).length>80}>{dm('search')}</button></form>{data!.people.length?<ul className="bike-app-list">{data!.people.map(p=><li className="bike-app-list-item" key={p.id}><strong>{p.display_name??dm('deletedUser')}</strong><button className="bike-app-button" disabled={locked} onClick={()=>void store.run({actorId:userId,type:'start',peer:p.id!})}>{dm('start')}</button></li>)}</ul>:<AppEmpty>{dm('noPeople')}</AppEmpty>}{data!.peopleMore?<button className="bike-app-button bike-app-button-secondary" disabled={locked||state.moreLoading} onClick={()=>void store.more()}>{dm('morePeople')}</button>:null}</AppPanel>:<>
     {peer?<AppPanel title={dm('pick')} className="bike-app-section-gap">{data!.canSend&&data!.people[0]?<><p>{data!.people[0].display_name??dm('deletedUser')}</p><button className="bike-app-button" disabled={locked} onClick={()=>void store.run({actorId:userId,type:'start',peer})}>{dm('start')}</button></>:<p>{dm('noPeople')}</p>}</AppPanel>:null}
     <AppPanel title={dm('title')} className="bike-app-section-gap">{data!.rows.length?<ul className="bike-app-list">{data!.rows.map(row=><li key={row.id} className="bike-app-list-item"><a className="bike-app-dm-row" href={`/${locale}/app/messages/${row.id}`}><strong>{row.peer.display_name??dm('deletedUser')}</strong><UnreadBadge locale={locale} conversation={row.id}/><p className="bike-app-content-body">{row.last_message?.body??dm('noMessages')}</p><small>{formatDateTime(locale,row.last_message?.edited_at??row.last_message?.created_at??row.created_at)}</small>{row.messaging_blocked?<p className="bike-app-muted">{dm('blocked')}</p>:null}</a></li>)}</ul>:<AppEmpty>{dm('empty')}</AppEmpty>}{data!.hasMore?<button className="bike-app-button bike-app-button-secondary" disabled={state.moreLoading} onClick={()=>void store.more()}>{dm('more')}</button>:null}</AppPanel>
    </>}
   </>:<>
    <AppPanel className="bike-app-section-gap">
     {!floating&&<div className="bike-app-actions"><ConversationBlock locale={locale} blocked={data!.conversation?.blocked_by_me===true}
      disabled={locked||checking||!data!.conversation?.peer.id} onChange={value=>void store.run(command({type:'block',value}))}/></div>}{!data!.canSend?<p role="status">{dm(data!.conversation?.messaging_blocked?'blocked':'cannotSend')}</p>:null}
     {state.originalId?<section className="bike-app-chat-context"><h3>{ch('quote')}</h3><button className="bike-app-button bike-app-button-secondary" onClick={()=>{store.original(null);restore();}}>{ch('back')}</button>{state.original?state.original.deleted_at?<p>{ch('deleted')}</p>:bubble(state.original,true):<p>{ch(state.originalUnavailable?'unavailable':'loading')}</p>}</section>:null}
     <div className="bike-app-chat-scroll" ref={list} tabIndex={0} role="region" aria-label={dm('title')} onScroll={e=>{const el=e.currentTarget,bottom=el.scrollHeight-el.scrollTop-el.clientHeight<90;store.position(bottom);}}><div className="bike-app-chat-history">{data!.hasMore?<button className="bike-app-button bike-app-button-secondary" disabled={state.moreLoading} onClick={()=>{void store.more();}}>{ch(state.moreLoading?'loading':'older')}</button>:<p>{ch('beginning')}</p>}</div>{data!.items.length?[...data!.items].reverse().map(m=>bubble(m)):<AppEmpty>{dm('noMessages')}</AppEmpty>}</div>
     <div className="bike-app-chat-new-slot">{state.newCount?<button className="bike-app-button" onClick={()=>store.bottom()}>{ch('new')} ({state.newCount})</button>:null}</div>
    </AppPanel>
   </>}
   {report?<AppPanel title={dm('report')} className="bike-app-section-gap"><form onSubmit={e=>{e.preventDefault();if(reportValid&&!locked)void store.run(command({type:'report',id:report.id,request:crypto.randomUUID(),reason:report.reason,detail:report.detail})).then(saved=>{if(saved){setReport(null);restore();}});}}><p className="bike-app-content-privacy">{dm('privacy')}</p><fieldset className="bike-app-club-form-fields" disabled={locked}><label className="bike-app-field"><span>{ct('reason')}</span><select ref={reportSelect} value={report.reason} onChange={e=>setReport({...report,reason:e.target.value as typeof report.reason})}>{(['spam','harassment','unsafe','other'] as const).map(k=><option key={k} value={k}>{ct(k)}</option>)}</select></label><label className="bike-app-field"><span>{ct('detail')}</span><textarea rows={4} value={report.detail} onChange={e=>setReport({...report,detail:e.target.value})}/></label><p>{ct('counter').replace('{count}',String(Array.from(report.detail).length)).replace('{max}','500')}</p></fieldset><div className="bike-app-actions"><button className="bike-app-button" disabled={locked||!reportValid}>{dm('report')}</button><button type="button" className="bike-app-button bike-app-button-secondary" disabled={locked} onClick={()=>{setReport(null);restore();}}>{t('common.cancel')}</button></div></form></AppPanel>:null}
   <dialog ref={dialog} className="bike-app-club-dialog" aria-labelledby="dm-confirm" onCancel={e=>{if(state.busy)e.preventDefault();}} onClose={()=>{const id=confirm?.focusId;setConfirm(null);requestAnimationFrame(()=>{const target=id?document.getElementById(id):null;(target??editor.current)?.focus({preventScroll:true});});}}>{confirm?<><h2 id="dm-confirm">{confirm.title}</h2><p>{confirm.body}</p><div className="bike-app-actions"><button autoFocus className="bike-app-button bike-app-button-secondary" onClick={()=>dialog.current?.close()}>{t('common.cancel')}</button><button className="bike-app-button bike-app-button-danger" disabled={locked} onClick={()=>{const c=confirm.command;dialog.current?.close();void store.run(c);}}>{ct('confirm')}</button></div></>:null}</dialog>
  </>}
  </StableAccessRegion>
  {conversationId||state.error||state.notice||state.pending?<AppPanel className="bike-app-section-gap" key="persistent-composer">
   <div className="bike-app-chat-feedback">{state.error&&state.error!=='network'?<p role="alert">{state.error==='access'?dm(conversationId?'cannotSend':'noPeople'):state.error==='blocked'?dm('blocked'):ct(error)}</p>:null}
   {state.notice?<p role="status">{state.notice==='sent'?ch('saved'):state.notice==='reported'?dm('reported'):dm('saved')}</p>:null}
   {state.sendState==='unknown'?<p role="alert">{dm('pending')}</p>:null}
   {state.pending?<button className="bike-app-button" disabled={state.busy||!ready} onClick={()=>void store.retry()}>{ct('retryAction')}</button>:null}
   </div>
   {conversationId?<div className="bike-app-chat-composer">
    {state.edit||state.replyId?<div className="bike-app-chat-quote"><strong>{ch(state.edit?'edit':'quote')}</strong><p className="bike-app-content-body">{available?selected?.body:ch('unavailable')}</p><button className="bike-app-button bike-app-button-secondary" disabled={locked} onClick={()=>{store.cancel();restore();}}>{ch('cancelReply')}</button></div>:null}
    {state.conflict&&selected?<div className="bike-app-chat-quote"><p>{ch('conflict')}</p><strong>{ch('latest')} · {selected.version}</strong><p className="bike-app-content-body">{selected.body}</p><button className="bike-app-button" disabled={locked} onClick={()=>store.rebase()}>{ch('rebase')}</button></div>:null}
    <form onSubmit={event=>{
      event.preventDefault();
      if(valid&&canWrite&&available&&!event.currentTarget.querySelector('dialog[open]')){
       void store.submit().then(saved=>{if(saved)editor.current?.focus({preventScroll:true});});
      }
    }}>
     <div className="bike-app-dm-input">
      <ComposerEmoji locale={locale} editor={editor} disabled={!canWrite||checking||minimized} onChange={store.text}/>
      <label className="bike-app-field">
       <span className={floating?'sr-only':undefined}>{ch('message')}</span>
       <textarea id="dm-composer" ref={editor} rows={floating?2:3} placeholder={floating?ch('message'):undefined}
        value={state.draft} readOnly={!canWrite} onChange={event=>store.text(event.target.value)}
        aria-invalid={tooLong||undefined} aria-describedby={tooLong?'dm-draft-limit':undefined}/>
      </label>
     </div>
     <div className="bike-app-chat-send">
      {!floating&&<span>{ch('count').replace('{count}',String(Array.from(state.draft).length))}</span>}
      <button className="bike-app-button" disabled={!canWrite||!valid||!available||state.conflict}>
       {state.busy?ch('sending'):state.edit?t('common.save'):ch('send')}
      </button>
     </div>
     {tooLong&&<p id="dm-draft-limit" className="bike-app-dm-draft-limit" role="status">
      {dm('tooLong').replace('{max}',String(SHORT_CONTENT_LIMIT))}
     </p>}
    </form>
   </div>:null}
  </AppPanel>:null}
 </div></ReactionScope>;
}
