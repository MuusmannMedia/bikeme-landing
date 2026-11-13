'use client';
import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';

// Presentation only: no names, profiles, image paths, blobs, messages or drafts.
const Presentation=createContext(false);
export function useParentAccess(){return useContext(Presentation);}
export function StableAccessRegion({ready,denied=false,fallback,children}:{ready:boolean;denied?:boolean;fallback:ReactNode;children:ReactNode}){
 const node=useRef<HTMLDivElement>(null),[height,setHeight]=useState(0);
 const bookmark=useRef<{x:number;y:number;focus:string;selection:[number,number]|null}|null>(null),interacted=useRef(false);
 useLayoutEffect(()=>{if(denied){bookmark.current=null;}},[denied]);
 useLayoutEffect(()=>{
  if(!ready||!node.current)return;
  const measure=()=>{if(node.current)setHeight(node.current.getBoundingClientRect().height);};measure();
  const observer=new ResizeObserver(measure);observer.observe(node.current);return()=>observer.disconnect();
 },[ready]);
 useEffect(()=>{
  if(!ready){interacted.current=false;const user=()=>{interacted.current=true;};window.addEventListener('wheel',user,{passive:true});window.addEventListener('touchmove',user,{passive:true});window.addEventListener('keydown',user);return()=>{window.removeEventListener('wheel',user);window.removeEventListener('touchmove',user);window.removeEventListener('keydown',user);};}
  const capture=()=>{const el=document.activeElement,inside=el instanceof HTMLElement&&node.current?.contains(el);bookmark.current={x:window.scrollX,y:window.scrollY,focus:inside?el.id:'',selection:inside&&(el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement)&&el.selectionStart!==null?[el.selectionStart,el.selectionEnd!]:null};};
  capture();window.addEventListener('scroll',capture,{passive:true});window.addEventListener('blur',capture);document.addEventListener('focusin',capture);document.addEventListener('selectionchange',capture);document.addEventListener('input',capture);document.addEventListener('visibilitychange',capture);
  return()=>{window.removeEventListener('scroll',capture);window.removeEventListener('blur',capture);document.removeEventListener('focusin',capture);document.removeEventListener('selectionchange',capture);document.removeEventListener('input',capture);document.removeEventListener('visibilitychange',capture);};
 },[ready]);
 useLayoutEffect(()=>{
  if(!ready||!bookmark.current||interacted.current)return;const b=bookmark.current;
  // A remounted authorized control may regain focus, never browser auto-scroll.
  const el=b.focus?document.getElementById(b.focus):null;
  if(el&&(document.activeElement===document.body||document.activeElement?.id===b.focus)){el.focus({preventScroll:true});if(b.selection&&(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement))el.setSelectionRange(...b.selection);}
  if(window.scrollX!==b.x||window.scrollY!==b.y)window.scrollTo({left:b.x,top:b.y,behavior:'instant'});
 },[ready]);
 return <Presentation.Provider value={true}><div ref={node} className="bike-app-access-region" data-access-layout={ready?'ready':'neutral'}>{ready?children:<div className="bike-app-access-placeholder" style={{minHeight:height||undefined}}><div className="bike-app-access-feedback">{fallback}</div></div>}</div></Presentation.Provider>;
}
