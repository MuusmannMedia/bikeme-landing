import {VisitError,visitError,type VisitProfile} from './contract';
import type {VisitData} from './store';
import type {CatalogState} from './catalog-store';
export type CatalogProfile=VisitProfile&{cover_revision:string|null;logo_revision:string|null};
export type Manifest={userId:string;profiles:Record<string,CatalogProfile|null>;revision:number};
export type MediaItem={id:string;revision:number;images:Partial<Record<'cover'|'logo',{mime:string;data:string;media_revision:string}>>};
export class CatalogRetry extends Error{constructor(public seconds:number){super('quota');}}
const empty:CatalogState={status:'loading',data:null,waiting:false,concealed:false,error:null};
export function createBatchCatalogStore(o:{actor:string;manifest:(ids:string[],signal:AbortSignal)=>Promise<Manifest>;media:(profiles:CatalogProfile[],signal:AbortSignal)=>Promise<{userId:string;items:MediaItem[]}>;identityLost?:()=>void}){
 type E={state:CatalogState;listeners:Set<()=>void>;visible:boolean;profile:CatalogProfile|null;cache:{cover:Blob|null;logo:Blob|null;key:string}|null};
 const entries=new Map<string,E>();let ids:string[]=[],controller=new AbortController(),generation=0,connected=false,suspended=false,stopped=false,authorized=false,inflight:Promise<void>|null=null,again=false,active=0,ackEpoch=0,directoryPending=0,mediaRetries=0,manifestRetries=0;
 let schedule:ReturnType<typeof setTimeout>|undefined,refreshTimer:ReturnType<typeof setTimeout>|undefined,nextMedia=0;
 const loading=new Set<string>(),stamps:{at:number;bytes:number}[]=[],manifestStamps:number[]=[];
 const get=(id:string)=>{let e=entries.get(id);if(!e){e={state:{...empty},listeners:new Set(),visible:false,profile:null,cache:null};entries.set(id,e);}return e;};
 const patch=(e:E,p:Partial<CatalogState>)=>{e.state={...e.state,...p};e.listeners.forEach(f=>f());};
 const key=(p:CatalogProfile)=>`${p.cover_revision??''}:${p.logo_revision??''}`;
 const current=(g:number)=>!stopped&&g===generation&&!controller.signal.aborted;
 function clear(clearView=false){for(const e of entries.values()){e.profile=null;e.cache=null;patch(e,{...empty,concealed:true});}if(clearView){view.query='';view.scroll=0;}}
 function reveal(e:E){const p=e.profile;if(!authorized||!connected||suspended||!p)return;if(e.cache?.key===key(p)){
  const data:VisitData={snapshot:{profile:p,rides:[],applications:[],invitation:null,applicationsEnabled:false},cover:p.has_cover?e.cache.cover:null,logo:p.has_logo?e.cache.logo:null};patch(e,{status:'ready',data,waiting:false,concealed:false,error:null});
 }}
 function hide(){authorized=false;for(const e of entries.values())patch(e,{concealed:true});}
 function failure(error:unknown){const k=visitError(error).kind;clear(k==='auth'||k==='access');for(const e of entries.values())patch(e,{status:k==='auth'?'auth':k==='access'?'access':'error',data:null,waiting:false,concealed:false,error:k});if(k==='auth')revoke();}
 const view={query:'',scroll:0};
 async function refresh(){if(stopped||suspended||!ids.length)return;if(directoryPending){refreshTimer=setTimeout(()=>void refresh(),100);return;}if(inflight){again=true;return inflight;}
  const g=generation,startedConnected=connected,signal=controller.signal,now=Date.now();while(manifestStamps[0]<now-61000)manifestStamps.shift();
  if(manifestStamps.length>=12){refreshTimer=setTimeout(()=>void refresh(),Math.max(1,manifestStamps[0]+61001-now));return;}
  manifestStamps.push(now);
  inflight=(async()=>{try{
   const r=await o.manifest(ids,signal);if(!current(g))return;if(r.userId!==o.actor)throw new VisitError('auth');manifestRetries=0;
   for(const id of ids){const e=get(id),p=r.profiles[id];if(p===undefined)throw new VisitError('network');e.profile=p;
    if(!p){e.cache=null;patch(e,{status:'access',data:null,waiting:false,concealed:false,error:null});continue;}
    if(e.cache?.key!==key(p)){e.cache=null;patch(e,{data:null,status:'loading',waiting:true,concealed:!connected});}
    if(!p.has_cover&&!p.has_logo)e.cache={key:key(p),cover:null,logo:null};
    if(p.has_cover&&!p.cover_revision||p.has_logo&&!p.logo_revision)throw new VisitError('image');
   }
   authorized=connected&&startedConnected;for(const e of entries.values())reveal(e);pump();
  }catch(e){if(!current(g))return;if(e instanceof CatalogRetry&&manifestRetries++<3){refreshTimer=setTimeout(()=>void refresh(),e.seconds*1000);return;}failure(e instanceof CatalogRetry?new VisitError('quota'):e);}
  })().finally(()=>{inflight=null;if(again&&!stopped&&!suspended){again=false;void refresh();}});return inflight;
 }
 function pump(){clearTimeout(schedule);if(stopped||suspended||active>=2)return;
  const wanted=ids.filter(id=>{const e=get(id);return e.visible&&e.profile&&!e.cache&&!loading.has(id);});if(!wanted.length)return;
  const now=Date.now();while(stamps[0]?.at<now-61000)stamps.shift();
  const wait=Math.max(nextMedia-now,stamps.length>=20?stamps[0].at+61001-now:0,stamps.reduce((n,s)=>n+s.bytes,0)+458752>10485760&&stamps.length?stamps[0].at+61001-now:0);
  if(wait>0){schedule=setTimeout(pump,wait);return;}
  const start=ids.indexOf(wanted[0]),batch=wanted.slice(0,4);
  // One bounded look-ahead group near visible demand, never the whole catalogue.
  for(const id of [...ids.slice(start),...ids.slice(0,start)]){if(batch.length===4)break;const e=get(id);if(e.profile&&!e.cache&&!loading.has(id)&&!batch.includes(id))batch.push(id);}
  const profiles=batch.map(id=>get(id).profile!),g=generation,signal=controller.signal;
  const stamp={at:now,bytes:458752};stamps.push(stamp);nextMedia=now+550;active++;batch.forEach(id=>{loading.add(id);patch(get(id),{waiting:true});});
  void o.media(profiles,signal).then(r=>{
   if(!current(g))return;if(r.userId!==o.actor)throw new VisitError('auth');mediaRetries=0;let bytes=0;
   for(const p of profiles){const e=get(p.id),item=r.items.find(i=>i.id===p.id);if(!item||item.revision!==p.revision)throw new VisitError('conflict');if(!e.profile||key(e.profile)!==key(p)||e.profile.revision!==p.revision)continue;
    const blobs=Object.fromEntries((['cover','logo'] as const).map(slot=>{const image=item.images[slot],needed=slot==='cover'?p.has_cover:p.has_logo;
     if(!needed)return[slot,null];if(!image||image.mime!=='image/webp'||image.media_revision!==(slot==='cover'?p.cover_revision:p.logo_revision))throw new VisitError('conflict');
     const raw=Uint8Array.from(atob(image.data),c=>c.charCodeAt(0));if(raw.byteLength>(slot==='cover'?98304:12288))throw new VisitError('network');bytes+=raw.byteLength;return[slot,new Blob([raw],{type:'image/webp'})];
    })) as {cover:Blob|null;logo:Blob|null};e.cache={key:key(p),...blobs};reveal(e);
   }stamp.bytes=bytes;
   if([...entries.values()].reduce((n,e)=>n+(e.cache?.cover?.size??0)+(e.cache?.logo?.size??0),0)>3145728)throw new VisitError('network');
  }).catch(e=>{if(!current(g))return;if(e instanceof CatalogRetry&&mediaRetries++<3){nextMedia=Math.max(nextMedia,Date.now()+e.seconds*1000);return;}if(visitError(e).kind==='conflict'){hide();requestRefresh();return;}failure(e instanceof CatalogRetry?new VisitError('quota'):e);}).finally(()=>{active--;batch.forEach(id=>loading.delete(id));if(current(g))pump();});pump();
 }
 function requestRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refresh(),80);}
 function revoke(notify=true){if(stopped)return;stopped=true;generation++;controller.abort();clearTimeout(schedule);clearTimeout(refreshTimer);clear(true);if(notify)o.identityLost?.();}
 return{
  view,
  configure(next:string[],seed?:Record<string,CatalogProfile|null>){const unique=[...new Set(next)];if(unique.length>20)throw new VisitError('invalid');if(ids.join()===unique.join())return;generation++;controller.abort();controller=new AbortController();loading.clear();ids=unique;for(const [id,e] of entries)if(!ids.includes(id)){e.cache=null;e.profile=null;patch(e,{...empty});}if(seed){for(const id of ids){const e=get(id),p=seed[id];if(p){e.profile=p;if(e.cache?.key!==key(p))e.cache=null;if(!p.has_cover&&!p.has_logo)e.cache={key:key(p),cover:null,logo:null};}else{e.profile=null;e.cache=null;patch(e,{status:'access',data:null,waiting:false,concealed:false});}}pump();if(connected)requestRefresh();}else requestRefresh();},
  directoryReadStarted(){directoryPending++;return{generation,ack:connected?ackEpoch:0};},
  directoryReadFinished(token:{generation:number;ack:number},seed?:Record<string,CatalogProfile|null>,order?:string[],error?:unknown){
   directoryPending=Math.max(0,directoryPending-1);if(stopped||token.generation!==generation)return;
   if(error){failure(error);return;}if(!seed||!order)return;
   generation++;controller.abort();controller=new AbortController();loading.clear();clearTimeout(refreshTimer);again=false;
   ids=order.filter(id=>Object.hasOwn(seed,id));
   if(ids.length>20){failure(new VisitError('network'));return;}
   for(const [id,e]of entries)if(!ids.includes(id)){e.profile=null;e.cache=null;patch(e,{...empty});}
   for(const id of ids){const e=get(id),p=seed[id];e.profile=p;
    if(!p){e.cache=null;patch(e,{status:'access',data:null,waiting:false,concealed:false});continue;}
    if(e.cache?.key!==key(p)){e.cache=null;patch(e,{status:'loading',data:null,waiting:true});}
    if(!p.has_cover&&!p.has_logo)e.cache={key:key(p),cover:null,logo:null};
   }
   authorized=connected&&token.ack>0&&token.ack===ackEpoch;
   for(const e of entries.values())reveal(e);pump();if(!authorized&&connected)requestRefresh();
  },
  enter(){hide();},
  subscribe(id:string,f:()=>void){const e=get(id);e.listeners.add(f);return()=>{e.listeners.delete(f);};},snapshot:(id:string)=>get(id).state,serverSnapshot:()=>empty,
  visible(id:string,value:boolean){get(id).visible=value;if(value){reveal(get(id));clearTimeout(schedule);schedule=setTimeout(pump,30);}},
  ready(){if(stopped)return;connected=true;ackEpoch++;hide();requestRefresh();},
  signal(){if(stopped)return;generation++;controller.abort();controller=new AbortController();loading.clear();hide();requestRefresh();},
  unavailable(){connected=false;generation++;controller.abort();controller=new AbortController();loading.clear();hide();failure(new VisitError('network'));},
  suspend(hidden:boolean){suspended=true;clearTimeout(schedule);if(hidden)hide();},conceal:hide,
  resume(){if(stopped||!suspended)return;suspended=false;hide();requestRefresh();},
  retry(){mediaRetries=0;manifestRetries=0;hide();requestRefresh();},revoke,stop(){revoke(false);entries.clear();}
 };
}
