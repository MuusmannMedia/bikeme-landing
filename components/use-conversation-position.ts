'use client';
import {useEffect,useLayoutEffect,useRef} from 'react';
import {readingTop,readingIntent,type ReadingPosition} from '@/lib/conversation-position';
type Bookmark={x:number;y:number;reading:ReadingPosition|null;focus:string;selection:[number,number]|null};
// A hidden focused editor can make Chrome scroll the whole page when its tab
// returns, even when ready never changes. Freeze BEFORE concealment, blur the
// editor, and restore only after fresh authorization, with preventScroll.
export function useConversationPosition({ready,checking,items,scrollRevision}:{ready:boolean;checking:boolean;items:unknown;scrollRevision:number}){
 const root=useRef<HTMLDivElement>(null),history=useRef<HTMLDivElement>(null);
 const saved=useRef<Bookmark|null>(null),frozen=useRef(false),interacted=useRef(false),focusIntent=useRef(false),frame=useRef<number|null>(null),seen=useRef(scrollRevision),latest=useRef({ready,checking});
 const capture=useRef(()=>{}),freeze=useRef(()=>{});
 useLayoutEffect(()=>{latest.current={ready,checking};
 capture.current=()=>{if(frozen.current||!latest.current.ready||latest.current.checking)return;const h=history.current,active=document.activeElement,inside=active instanceof HTMLElement&&!!root.current?.contains(active);let reading:ReadingPosition|null=null;
  if(h){const rect=h.getBoundingClientRect();const row=Array.from(h.querySelectorAll<HTMLElement>('[data-chat-id],[data-dm-message]')).find(r=>r.getBoundingClientRect().bottom>rect.top+h.clientTop);reading={top:h.scrollTop,bottom:h.scrollHeight-h.scrollTop-h.clientHeight<90,anchor:row?.dataset.chatId??row?.dataset.dmMessage??null,offset:row?row.getBoundingClientRect().top-rect.top-h.clientTop:0};}
  saved.current={x:window.scrollX,y:window.scrollY,reading,focus:inside?active.id:'',selection:inside&&(active instanceof HTMLTextAreaElement||active instanceof HTMLInputElement)&&active.selectionStart!==null?[active.selectionStart,active.selectionEnd!]:null};
 };
 freeze.current=()=>{if(frozen.current)return;capture.current();frozen.current=true;interacted.current=false;focusIntent.current=false;const el=document.activeElement;if(el instanceof HTMLElement&&root.current?.contains(el)&&(el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement))el.blur();};
 },[ready,checking]);
 useEffect(()=>{const captureEvent=()=>capture.current(),deactivate=()=>freeze.current(),visibility=()=>{if(document.visibilityState==='hidden')freeze.current();},intent=(event:Event)=>{if(!frozen.current)return;const editable=event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement;if(readingIntent(event.type,event instanceof KeyboardEvent?event.key:'',editable)==='scroll')interacted.current=true;else focusIntent.current=true;};
  window.addEventListener('blur',deactivate);window.addEventListener('pagehide',deactivate);document.addEventListener('visibilitychange',visibility);window.addEventListener('scroll',captureEvent,true);document.addEventListener('selectionchange',captureEvent);document.addEventListener('focusin',captureEvent);document.addEventListener('input',captureEvent);
  window.addEventListener('wheel',intent,{passive:true});window.addEventListener('touchmove',intent,{passive:true});window.addEventListener('pointerdown',intent);window.addEventListener('keydown',intent);
  return()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);saved.current=null;window.removeEventListener('blur',deactivate);window.removeEventListener('pagehide',deactivate);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('scroll',captureEvent,true);document.removeEventListener('selectionchange',captureEvent);document.removeEventListener('focusin',captureEvent);document.removeEventListener('input',captureEvent);window.removeEventListener('wheel',intent);window.removeEventListener('touchmove',intent);window.removeEventListener('pointerdown',intent);window.removeEventListener('keydown',intent);};
 },[root]);
 useLayoutEffect(()=>{
  if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}
  if(!ready||checking){freeze.current();return;}
  const b=saved.current,h=history.current,returning=frozen.current,follow=seen.current!==scrollRevision;seen.current=scrollRevision;frozen.current=true;
  if(!interacted.current&&b){if(h&&b.reading){const row=b.reading.anchor?Array.from(h.querySelectorAll<HTMLElement>('[data-chat-id],[data-dm-message]')).find(r=>(r.dataset.chatId??r.dataset.dmMessage)===b.reading!.anchor):null;h.scrollTop=readingTop(b.reading,{height:h.scrollHeight,viewport:h.clientHeight,anchorTop:row?row.getBoundingClientRect().top-h.getBoundingClientRect().top-h.clientTop+h.scrollTop:null},follow);}
   const el=returning&&!focusIntent.current&&b.focus?document.getElementById(b.focus):null;if(el&&root.current?.contains(el)&&(document.activeElement===document.body||document.activeElement?.id===b.focus)){el.focus({preventScroll:true});if(b.selection&&(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement))el.setSelectionRange(...b.selection);}
   window.scrollTo({left:b.x,top:b.y,behavior:'instant'});
  }else if(!b&&h)h.scrollTop=h.scrollHeight;
  // Browser scroll anchoring may run after layout. Keep the same page position
  // through that frame, unless the user deliberately moved while checking.
  frame.current=requestAnimationFrame(()=>{frame.current=null;if(b&&!interacted.current)window.scrollTo({left:b.x,top:b.y,behavior:'instant'});frozen.current=false;interacted.current=false;focusIntent.current=false;capture.current();});
 },[ready,checking,items,scrollRevision,root,history]);
 return {root,history};
}
