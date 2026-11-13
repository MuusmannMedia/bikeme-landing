// Allocate URLs only during the committed lifecycle, never speculative render.
export function createBlobLease(create:(blob:Blob)=>string=blob=>URL.createObjectURL(blob),revoke:(url:string)=>void=url=>URL.revokeObjectURL(url)){
 const empty:{blob:Blob|null;url:string|null}={blob:null,url:null};let state=empty;const listeners=new Set<()=>void>();
 function clear(){if(state.url)revoke(state.url);state=empty;listeners.forEach(f=>f());}
 return{getSnapshot:()=>state,getServerSnapshot:()=>empty,subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f);};},clear,set(blob:Blob|null){if(state.blob===blob)return;clear();if(blob){const url=create(blob);state={blob,url};listeners.forEach(f=>f());}}};
}
