'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {reactionEmojis} from '@/lib/messages/reactions';
import dynamic from 'next/dynamic';
const EmojiPalette=dynamic(()=>import('./emoji-palette'),{ssr:false});
import {messageText,reactionText} from '@/lib/messages/web-i18n';
import type {Locale} from '@/lib/locales';
import {useReactions} from './reactions';
import {MessageActionIcon} from './message-action-icon';
export type MessageAction={key:'edit'|'delete'|'reply'|'report'|'dm'|'block';label:string;run:()=>void;disabled?:boolean;danger?:boolean};
export function MessageBubble({id,own,body,locale,actions,disabled=false,actionIcons=false,children}:{id:string;own:boolean;body:string;locale:Locale;actions:MessageAction[];disabled?:boolean;actionIcons?:boolean;children:ReactNode}){const {store,state}=useReactions(),[open,setOpen]=useState(false),[palette,setPalette]=useState(false),[copied,setCopied]=useState(false);const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),hold=useRef<ReturnType<typeof setTimeout>|null>(null),origin=useRef<{x:number;y:number}|null>(null);const rows=state.messages[id],canReact=!!rows&&state.supported&&!own&&!disabled,entry=useRef<HTMLElement|null>(null);const close=()=>{dialog.current?.close();setOpen(false);setPalette(false);requestAnimationFrame(()=>{const t=entry.current;if(t?.isConnected)t.focus({preventScroll:true});else trigger.current?.focus({preventScroll:true});});};
 useEffect(()=>{if(disabled||open&&state.supported&&!rows||palette&&state.emoji_version!=='15.1'){dialog.current?.close();}},[disabled,state.supported,palette,state.emoji_version,rows,open]);
 useEffect(()=>()=>{if(hold.current)clearTimeout(hold.current);},[]);
 const show=()=>{if(disabled||window.getSelection()?.toString())return;entry.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setOpen(true);setCopied(false);setPalette(false);};
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 const choose=(emoji:string)=>{const mine=rows?.find(r=>r.mine)?.emoji;if(disabled||state.busy||state.pending||own&&mine!==emoji||!reactionEmojis.includes(emoji as typeof reactionEmojis[number])&&state.emoji_version!=='15.1'&&mine!==emoji)return;close();void store?.set(id,mine===emoji?null:emoji);};

 return <div className="bike-message-wrap" data-own={own} data-menu-open={open}>
  <div className="bike-message-bubble" onPointerDown={e=>{if(e.pointerType==='mouse'||(e.target as HTMLElement).closest('button,a'))return;origin.current={x:e.clientX,y:e.clientY};hold.current=setTimeout(()=>{if(!window.getSelection()?.toString())show();},650);}} onPointerMove={e=>{if(origin.current&&Math.hypot(e.clientX-origin.current.x,e.clientY-origin.current.y)>8&&hold.current)clearTimeout(hold.current);}} onPointerUp={()=>{if(hold.current)clearTimeout(hold.current);}} onPointerCancel={()=>{if(hold.current)clearTimeout(hold.current);}} onContextMenu={e=>{if(!window.getSelection()?.toString()&&!(e.target as HTMLElement).closest('a,button')){e.preventDefault();show();}}}>
   {children}
   <button ref={trigger} id={`message-menu-${id}`} type="button" className="bike-message-menu-trigger" disabled={disabled} aria-label={messageText(locale,'menu')} aria-haspopup="dialog" aria-expanded={open} onClick={show}>…</button>
  </div>
  {rows?.length?<div className="bike-reaction-chips">{rows.map(r=>own&&!r.mine?<span key={r.emoji} className="bike-reaction-chip" aria-label={reactionText(locale,'reactions.count',{emoji:r.emoji,count:r.count})}>{r.emoji}{r.count>1?' '+r.count:''}</span>:<button key={r.emoji} className="bike-reaction-chip" aria-pressed={r.mine} aria-label={reactionText(locale,'reactions.count',{emoji:r.emoji,count:r.count})} disabled={disabled||state.busy||state.pending} onClick={()=>choose(r.emoji)}>{r.emoji}{r.count>1?' '+r.count:''}</button>)}</div>:null}
  {state.pending&&state.error&&state.pendingId===id?<button className="bike-app-button bike-app-button-small" onClick={()=>void store?.retry()}>{messageText(locale,'retry')}</button>:null}
  {open?<dialog ref={dialog} className="bike-message-dialog" aria-label={messageText(locale,'menu')} onCancel={e=>{e.preventDefault();close();}} onClose={()=>{setOpen(false);setPalette(false);}}>
   <button className="bike-message-close" onClick={close} aria-label={messageText(locale,'close')}>×</button>
   {palette&&canReact&&state.emoji_version==='15.1'?<EmojiPalette locale={locale} disabled={state.busy||state.pending} onChoose={choose} onBack={()=>setPalette(false)}/>:<>
    {canReact?<div className="bike-quick-emoji">{reactionEmojis.map(emoji=><button key={emoji} disabled={state.busy||state.pending} aria-label={reactionText(locale,'reactions.chooseEmoji',{emoji})} onClick={()=>choose(emoji)}>{emoji}</button>)}{state.emoji_version==='15.1'?<button aria-label={reactionText(locale,'reactions.more')} onClick={()=>setPalette(true)}>…</button>:null}</div>:null}
    <p className="bike-message-preview">{body}</p>
    <div className="bike-message-menu-actions">{actions.map(a=><button key={a.key} disabled={a.disabled} data-danger={a.danger} onClick={()=>{close();a.run();}}>{actionIcons&&<MessageActionIcon name={a.key}/>} {a.label}</button>)}<button onClick={()=>{void navigator.clipboard.writeText(body).then(()=>setCopied(true)).catch(()=>setCopied(false));}}>{actionIcons&&<MessageActionIcon name="copy"/>} {messageText(locale,'copy')}</button>{copied?<span role="status">{messageText(locale,'copied')}</span>:null}</div>
   </>}
  </dialog>:null}
 </div>;
}
