import {visitError,type VisitProfile,type VisitSnapshot} from './contract';
import type {VisitData} from './store';
import {createCatalogQueue,type CatalogLedger,type CatalogKind} from './catalog-queue';
export type CatalogState={status:'loading'|'ready'|'error'|'access'|'auth';data:VisitData|null;waiting:boolean;concealed:boolean;error:string|null};
const empty:CatalogState={status:'loading',data:null,waiting:false,concealed:false,error:null};
export function createCatalogStore(o:{actor:string;identityLost?:()=>void;read:(club:string,signal:AbortSignal)=>Promise<VisitProfile>;watch:(club:string,signal:AbortSignal)=>Promise<unknown>;image:(club:string,slot:'cover'|'logo',revision:number,signal:AbortSignal)=>Promise<Blob>;ledger?:CatalogLedger;saveLedger?:(l:CatalogLedger)=>void;queue?:ReturnType<typeof createCatalogQueue>}){
 const queue=o.queue??createCatalogQueue({ledger:o.ledger,save:o.saveLedger});
 type Entry={id:string;state:CatalogState;listeners:Set<()=>void>;visible:boolean;watched:boolean;version:number;running:Promise<void>|null;again:boolean;controller:AbortController;cache:VisitData|null};
 const entries=new Map<string,Entry>();let stopped=false,connected=false,suspended=false;
 const get=(id:string)=>{let e=entries.get(id);if(!e){e={id,state:{...empty},listeners:new Set(),visible:false,watched:false,version:0,running:null,again:false,controller:new AbortController(),cache:null};entries.set(id,e);}return e;};
 const patch=(e:Entry,p:Partial<CatalogState>)=>{e.state={...e.state,...p};e.listeners.forEach(f=>f());};
 function request<T>(e:Entry,key:string,kind:CatalogKind,run:()=>Promise<T>){return queue.request(`${o.actor}:${e.id}:${e.version}:${key}`,kind,()=>e.visible?100:0,e.controller.signal,run);}
 async function load(e:Entry){if(stopped||!connected||suspended||!e.visible)return;if(e.running){e.again=true;return;}const version=e.version,signal=e.controller.signal;patch(e,{waiting:true,error:null});
  const work=async()=>{try{
   // Subscribe before the authorized catch-up read. Never display an unwatched
   // cached projection after a registration gap.
   if(!e.watched){await request(e,'watch','watch',()=>o.watch(e.id,signal));if(version!==e.version||stopped)return;e.watched=true;}
   const profile=await request(e,'profile','read',()=>o.read(e.id,signal));if(version!==e.version||stopped)return;
   const old=e.cache,previous=old&&'profile'in old.snapshot?old.snapshot.profile:null;
   if(previous?.revision!==profile.revision){e.cache=null;patch(e,{data:null,status:'loading'});}
   const pair=await Promise.all((['cover','logo'] as const).map(slot=>!(slot==='cover'?profile.has_cover:profile.has_logo)?null:previous?.revision===profile.revision&&old?.[slot]?old[slot]:request(e,`${slot}:${profile.revision}`,'image',()=>o.image(e.id,slot,profile.revision,signal))));
   if(stopped||version!==e.version||suspended||signal.aborted)return;
   const snapshot:VisitSnapshot={profile,rides:[],applications:[],invitation:null,applicationsEnabled:false};
   e.cache={snapshot,cover:pair[0],logo:pair[1]};patch(e,{data:e.cache,status:'ready',waiting:false,concealed:false,error:null});
  }catch(error){if(stopped||version!==e.version||signal.aborted)return;const kind=visitError(error).kind;e.cache=null;patch(e,{data:null,status:kind==='auth'?'auth':kind==='access'?'access':'error',error:kind,waiting:false,concealed:false});if(kind==='auth')revoke();}
  };
  e.running=work().finally(()=>{e.running=null;if(e.again){e.again=false;if(e.visible&&!stopped&&!suspended)void load(e);}});await e.running;
 }
 function invalidate(e:Entry,discard:boolean){e.version++;e.controller.abort();e.controller=new AbortController();e.again=false;queue.prioritize();if(discard)patch(e,{data:null,status:'loading'});if(e.running){e.again=e.visible;return;}if(e.visible)void load(e);}
 function revoke(notify=true){if(stopped)return;stopped=true;queue.stop();for(const e of entries.values()){e.version++;e.controller.abort();e.cache=null;patch(e,{...empty,status:'auth'});}if(notify)o.identityLost?.();}
 return{
  subscribe(id:string,f:()=>void){const e=get(id);e.listeners.add(f);return()=>{e.listeners.delete(f);};},snapshot:(id:string)=>get(id).state,serverSnapshot:()=>empty,
  visible(id:string,value:boolean){const e=get(id);e.visible=value;queue.prioritize();if(value&&(e.state.status!=='ready'||e.state.concealed)&&!e.running)void load(e);},
  ready(){if(stopped)return;const reconnect=connected;connected=true;if(!suspended)queue.resume();for(const e of entries.values()){if(reconnect)invalidate(e,true);else if(e.visible)void load(e);}},
  signal(){if(stopped)return;for(const e of entries.values())invalidate(e,true);},
  unavailable(){if(stopped)return;connected=false;queue.pause();for(const e of entries.values()){e.version++;e.controller.abort();e.controller=new AbortController();e.cache=null;patch(e,{data:null,status:'error',waiting:false,error:'network',concealed:false});}},
  suspend(hidden:boolean){if(stopped||suspended)return;suspended=true;queue.pause();for(const e of entries.values()){if(hidden)patch(e,{concealed:true});} },
  conceal(){if(stopped)return;for(const e of entries.values())patch(e,{concealed:true});},
  resume(){if(stopped||!suspended)return;suspended=false;for(const e of entries.values()){
    // Keep mounted DOM/Blob objects. Fresh profile authorization and revision
    // must succeed before a truly hidden card is revealed again.
    if(e.visible||e.cache)invalidate(e,false);
   }queue.resume();},
  retry(id:string){const e=get(id);invalidate(e,true);},revoke,stop(){revoke(false);entries.clear();},
 };
}
