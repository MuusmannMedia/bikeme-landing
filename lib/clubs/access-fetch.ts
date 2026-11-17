// A short burst boundary may be crossed by navigation/focus. Retry once, with
// the server's delay; a minute quota remains an explicit error, never a loop.
export async function fetchClubAccess(url:string,signal:AbortSignal,send:typeof fetch=fetch,wait:(ms:number,signal:AbortSignal)=>Promise<void>=abortableWait){
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 let response=await send(url,{cache:'no-store',credentials:'same-origin',signal});
 if(response.status===429){const raw=response.headers.get('Retry-After'),seconds=Number(raw);if(raw!==null&&Number.isFinite(seconds)&&seconds>0&&seconds<=2){await wait(seconds*1000,signal);response=await send(url,{cache:'no-store',credentials:'same-origin',signal});}}
 return response;
}
function abortableWait(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}const stop=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);reject(new DOMException('Aborted','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},ms);signal.addEventListener('abort',stop,{once:true});});}
