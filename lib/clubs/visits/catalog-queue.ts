// Per-actor, in-memory work queue. Only rate timestamps (never content) may be
// persisted by its owner. Leave headroom for a detail page using the same actor.
export type CatalogKind = 'read'|'image'|'watch';
type Stamp = {at:number;amount:number};
export type CatalogLedger = Record<CatalogKind,Stamp[]>;
export class CatalogWait extends Error {constructor(public delay:number){super('catalog retry');}}
export function retryDelay(value:string|null,now:number){
 const seconds=value===null?NaN:Number(value),date=value===null?NaN:Date.parse(value);
 return Math.max(61000,Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-now:0);
}
export function createCatalogQueue(o:{now?:()=>number;timer?:(f:()=>void,ms:number)=>ReturnType<typeof setTimeout>;clear?:(t:ReturnType<typeof setTimeout>)=>void;ledger?:CatalogLedger;save?:(v:CatalogLedger)=>void}={}){
 const now=o.now??Date.now,timer=o.timer??setTimeout,clear=o.clear??clearTimeout;
 const ledger=o.ledger??{read:[],image:[],watch:[]},blocked={read:0,image:0,watch:0};
 type Job={key:string;kind:CatalogKind;priority:()=>number;signal:AbortSignal;run:()=>Promise<unknown>;resolve:(v:unknown)=>void;reject:(e:unknown)=>void;tries:number};
 const pending=new Map<string,Promise<unknown>>(),jobs:Job[]=[];let active=0,stopped=false,paused=false,wake:ReturnType<typeof setTimeout>|undefined;
 const abort=()=>new DOMException('Aborted','AbortError');
 function available(kind:CatalogKind){const t=now();ledger[kind]=ledger[kind].filter(x=>x.at>t-61000);const rows=ledger[kind],cap={read:90,image:28,watch:11}[kind];let at=blocked[kind];if(rows.length>=cap)at=Math.max(at,rows[rows.length-cap].at+61001);if(kind==='image'){
  if(rows.length)at=Math.max(at,rows.at(-1)!.at+250);
  let bytes=rows.reduce((n,x)=>n+x.amount,0)+3145728;for(const row of rows){if(bytes<=59768832)break;at=Math.max(at,row.at+61001);bytes-=row.amount;}
 }return at;}
 function pump(){if(wake!==undefined){clear(wake);wake=undefined;}if(stopped||paused)return;for(let i=jobs.length-1;i>=0;i--)if(jobs[i].signal.aborted){jobs.splice(i,1)[0].reject(abort());}
  while(active<2&&jobs.length){jobs.sort((a,b)=>b.priority()-a.priority());const i=jobs.findIndex(j=>available(j.kind)<=now());if(i<0)break;const j=jobs.splice(i,1)[0],stamp={at:now(),amount:j.kind==='image'?3145728:1};ledger[j.kind].push(stamp);o.save?.(ledger);active++;
   void j.run().then(value=>{if(j.signal.aborted)throw abort();if(j.kind==='image'&&value instanceof Blob){stamp.amount=value.size;o.save?.(ledger);}j.resolve(value);}).catch(error=>{if(error instanceof CatalogWait&&!j.signal.aborted&&j.tries++<3&&!stopped){blocked[j.kind]=Math.max(blocked[j.kind],now()+error.delay);jobs.push(j);}else j.reject(error);}).finally(()=>{active--;pump();});
  }
  if(jobs.length&&active<2)wake=timer(pump,Math.max(1,Math.min(...jobs.map(j=>available(j.kind)))-now()));
 }
 return{
  request<T>(key:string,kind:CatalogKind,priority:()=>number,signal:AbortSignal,run:()=>Promise<T>):Promise<T>{const old=pending.get(key);if(old)return old as Promise<T>;if(stopped)return Promise.reject(abort());const task=new Promise<unknown>((resolve,reject)=>jobs.push({key,kind,priority,signal,run,resolve,reject,tries:0}));pending.set(key,task);void task.finally(()=>{if(pending.get(key)===task)pending.delete(key);}).catch(()=>{});pump();return task as Promise<T>;},
  prioritize:pump,pause(){paused=true;if(wake!==undefined)clear(wake);},resume(){paused=false;pump();},stop(){stopped=true;if(wake!==undefined)clear(wake);jobs.splice(0).forEach(j=>j.reject(abort()));pending.clear();},
 };
}
