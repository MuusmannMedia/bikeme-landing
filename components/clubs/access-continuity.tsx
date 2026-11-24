'use client';
import {flushSync} from 'react-dom';
import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {createAccessRefresh} from '@/lib/clubs/access-refresh';
import type {Locale} from '@/lib/locales';
const checkingText:Record<Locale,string>={en:'Checking connection and access…',da:'Kontrollerer forbindelse og adgang…',de:'Verbindung und Zugriff werden geprüft…',es:'Comprobando conexión y acceso…',it:'Verifica di connessione e accesso…',fr:'Vérification de la connexion et de l’accès…',nl:'Verbinding en toegang controleren…'};
// An unconfirmed check is not a new authorization. A truly hidden page stays
// concealed on return until the fresh check settles. Failures still purge stores.
export function useAccessContinuity(){
 const [state,setState]=useState({checking:false,concealed:false});
 const bind=useMemo(()=> (pause:()=>void,verify:()=>Promise<void>,invalidateSignals:()=>void=()=>{})=>createAccessRefresh({
  visible:()=>document.visibilityState==='visible',focused:()=>document.hasFocus(),
  pause,retain:checking=>{invalidateSignals();const update=()=>setState(s=>({checking,concealed:s.concealed||document.hidden}));if(document.hidden)flushSync(update);else update();},
  settled:()=>setState({checking:false,concealed:false}),verify
 }),[]);
 return {...state,bind};
}
export function AccessContinuity({checking,concealed,locale,children}:{checking:boolean;concealed:boolean;locale:Locale;children:ReactNode}){
 const [showStatus,setShowStatus]=useState(false);
 useEffect(()=>{
  if(!checking)return;
  const timer=setTimeout(()=>setShowStatus(true),450);
  return()=>{clearTimeout(timer);setShowStatus(false);};
 },[checking]);
 return <div className="bike-app-continuity" data-access-checking={checking} data-access-concealed={concealed}>
  <div style={concealed?{visibility:'hidden'}:undefined} inert={concealed}>{children}</div>
  {checking&&showStatus?<span className="bike-app-continuity-status" role="status">{checkingText[locale]}</span>:null}
 </div>;
}
