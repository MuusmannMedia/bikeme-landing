import {verifyWebWakeup} from './wakeup';
import {deliverBrowserPush,type TransportRow} from './worker';
export type BrowserWorkerDependencies={env:(name:string)=>string|undefined;createRpc:(url:string,key:string)=>(name:string,args?:Record<string,unknown>)=>Promise<unknown>;createSend:(subject:string,publicKey:string,privateKey:string)=>(row:TransportRow,payload:string)=>Promise<unknown>};
// Separate browser transport bound to the production Supabase project.
export async function handleBrowserPush(request:Request,d:BrowserWorkerDependencies){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 const wake=verifyWebWakeup(request.headers,d.env('WEB_PUSH_WORKER_SECRET')??'');if(!wake)return new Response(null,{status:403});
 const url=d.env('SUPABASE_URL'),key=d.env('SUPABASE_SERVICE_ROLE_KEY'),pub=d.env('WEB_PUSH_VAPID_PUBLIC_KEY'),priv=d.env('WEB_PUSH_VAPID_PRIVATE_KEY'),subject=d.env('WEB_PUSH_VAPID_SUBJECT');
 if(d.env('BIKE_ME_WEB_PUSH_ENABLED')!=='true'||url!=='https://zawilafvdwlnwsdeufts.supabase.co'||!key||!pub||!priv||!subject)return new Response(null,{status:503});
 try{const rpc=d.createRpc(url,key);if(await rpc('web_push_consume',{p_nonce:wake.nonce,p_issued:wake.issued})!==true)return new Response(null,{status:409});
 const counts=await deliverBrowserPush({claim:async()=>await rpc('web_push_claim') as {id:string;claim:string}[],payload:async(id,claim)=>await rpc('web_push_payload',{p_delivery:id,p_claim:claim}) as TransportRow|null,finish:async(id,claim,state,wait)=>{await rpc('web_push_finish',{p_delivery:id,p_claim:claim,p_state:state,p_wait:wait});},send:d.createSend(subject,pub,priv)});
 await rpc('web_push_maintenance');return Response.json(counts,{status:counts.failed||counts.unknown?502:200,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'delivery_failed'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
