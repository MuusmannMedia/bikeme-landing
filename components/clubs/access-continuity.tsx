'use client';
import {flushSync} from 'react-dom';
import {useMemo,useState,type ReactNode} from 'react';
import {createAccessRefresh} from '@/lib/clubs/access-refresh';
import type {Locale} from '@/lib/locales';
const checkingText:Record<Locale,string>={en:'Checking connection and access…',da:'Kontrollerer forbindelse og adgang…',de:'Verbindung und Zugriff werden geprüft…',es:'Comprobando conexión y acceso…',it:'Verifica di connessione e accesso…',fr:'Vérification de la connexion et de l’accès…',nl:'Verbinding en toegang controleren…'};
// An unconfirmed check is not a new authorization. A truly hidden page stays
// concealed on return until the fresh check settles. Failures still purge stores.
export function useAccessContinuity(){
 const [state,setState]=useState({checking:false,concealed:false});
 const bind=useMemo(()=> (pause:()=>void,verify:()=>Promise<void>,invalidateSignals:()=>void=()=>{})=>createAccessRefresh({
  visible:()=>document.visibilityState==='visible',focused:()=>document.hasFocus(),
  pause,retain:()=>{invalidateSignals();const update=()=>setState(s=>({checking:true,concealed:s.concealed||document.visibilityState==='hidden'}));if(document.visibilityState==='hidden')flushSync(update);else update();},
  settled:()=>setState({checking:false,concealed:false}),verify
 }),[]);
 return {...state,bind};
}
export function AccessContinuity({checking,concealed,locale,children}:{checking:boolean;concealed:boolean;locale:Locale;children:ReactNode}){
 return <div className="bike-app-continuity" data-access-checking={checking} data-access-concealed={concealed}>
  <div style={concealed?{visibility:'hidden'}:undefined} aria-hidden={concealed||undefined}>{children}</div>
  {checking?<span className="bike-app-continuity-status" role="status">{checkingText[locale]}</span>:null}
 </div>;
}
