'use client';
import {createContext,useContext,useState,useEffect,type ReactNode} from 'react';
const Scope=createContext<{visitor:boolean;setVisitor:(value:boolean)=>void}>({visitor:false,setVisitor:()=>{}});
export function ClubNavScope({children}:{children:ReactNode}){const[visitor,setVisitor]=useState(false);return <Scope.Provider value={{visitor,setVisitor}}>{children}</Scope.Provider>;}
export function useVisitorNav(){return useContext(Scope).visitor;}
export function VisitorNavMarker(){const{setVisitor}=useContext(Scope);useEffect(()=>{setVisitor(true);return()=>setVisitor(false);},[setVisitor]);return null;}
